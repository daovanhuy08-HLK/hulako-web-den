// Hàng đợi tác vụ AI/SEO (mục 10): Chờ → Đang chạy → Hoàn thành / Thất bại / Bỏ qua / Huỷ.
// Khoá chống trùng theo (loại, nguồn, kỳ đo, phạm vi). Retry giới hạn cho lỗi tạm thời.
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { AiBudgetError, AiNotConfiguredError, AiOutputError, AiPendingError, AI_MODEL, aiContext, isTransient } from "./claude";
import { getActivePrompt } from "./prompts";
import { collectGsc } from "../seo/gsc";
import { periodRange } from "../seo/metrics";
import { harvestKeywords, improvePrompt, scoreOpportunities, suggestKeywords, writeDraft, type StepResult } from "../seo/pipeline";

export const JOB_TYPES = {
  collect_gsc: "Thu số liệu Search Console",
  harvest_keywords: "Gom từ khoá từ Search Console",
  suggest_keywords: "AI đề xuất từ khoá",
  score_opportunities: "Chấm điểm cơ hội",
  write_draft: "AI viết brief + bản nháp",
  improve_prompt: "AI đề xuất nâng cấp hướng dẫn viết",
  learning_cycle: "Vòng học: đánh giá thí nghiệm + học trọng số",
} as const;
export type JobType = keyof typeof JOB_TYPES;

const MAX_ATTEMPTS = 3;
const USES_AI: JobType[] = ["suggest_keywords", "write_draft", "improve_prompt"];

const HANDLERS: Record<JobType, (scope: Record<string, unknown>, createdBy: string) => Promise<StepResult>> = {
  collect_gsc: async (scope) => {
    const r = periodRange(Number(scope.days ?? 3));
    return { result: await collectGsc(String(scope.start ?? r.start), String(scope.end ?? r.end)) };
  },
  harvest_keywords: () => harvestKeywords(),
  suggest_keywords: () => suggestKeywords(),
  score_opportunities: () => scoreOpportunities(),
  write_draft: (scope, by) => writeDraft(String(scope.opportunityId), /^[0-9a-f-]{36}$/.test(by) ? by : null), // system/cron/agent → không gắn tác giả
  improve_prompt: () => improvePrompt(),
  learning_cycle: async () => ({ result: await import("../seo/learning").then((m) => m.runLearningCycle()) as unknown as Record<string, unknown> }),
};

export async function enqueue(type: JobType, scope: Record<string, unknown>, idempotencyKey: string, createdBy = "system") {
  const db = await getDb();
  const [job] = await db.insert(schema.aiJobs).values({ type, scope, idempotencyKey: `${type}:${idempotencyKey}`, createdBy })
    .onConflictDoNothing({ target: schema.aiJobs.idempotencyKey }).returning();
  if (job) return { job, created: true };
  const [existing] = await db.select().from(schema.aiJobs).where(eq(schema.aiJobs.idempotencyKey, `${type}:${idempotencyKey}`));
  return { job: existing, created: false };
}

/** Chạy lại tác vụ thất bại: cho phép thêm lượt (người quản trị bấm ở A09) */
export async function retryJob(id: string) {
  const db = await getDb();
  await db.update(schema.aiJobs).set({ status: "queued", error: null, attempts: 0, aiResponse: null, aiRequest: null, result: null })
    .where(and(eq(schema.aiJobs.id, id), inArray(schema.aiJobs.status, ["failed", "skipped", "cancelled"])));
}

export async function cancelJob(id: string) {
  const db = await getDb();
  await db.update(schema.aiJobs).set({ status: "cancelled", finishedAt: new Date() }).where(and(eq(schema.aiJobs.id, id), eq(schema.aiJobs.status, "queued")));
}

export async function runJob(id: string) {
  const db = await getDb();
  // Giành quyền chạy nguyên tử: chỉ một tiến trình chuyển được queued → running
  const [job] = await db.update(schema.aiJobs).set({ status: "running", startedAt: new Date(), attempts: sql`${schema.aiJobs.attempts} + 1` })
    .where(and(eq(schema.aiJobs.id, id), eq(schema.aiJobs.status, "queued"))).returning();
  if (!job) return null;
  const type = job.type as JobType;
  try {
    const pv = USES_AI.includes(type) ? await getActivePrompt() : null;
    // Có kết quả runner gửi về → chạy lại bước với kết quả đó (generateStructured đọc từ aiContext)
    const out = await aiContext.run({ response: job.aiResponse ?? undefined }, () => HANDLERS[type](job.scope, job.createdBy));
    const [done] = await db.update(schema.aiJobs).set({
      status: out.result.skipped ? "skipped" : "done", result: out.result, finishedAt: new Date(), error: null,
      needsReview: !!out.needsReview, promptVersion: pv?.version ?? null,
      model: out.usage?.model ?? (USES_AI.includes(type) ? AI_MODEL : null),
      inputTokens: out.usage?.inputTokens ?? 0, outputTokens: out.usage?.outputTokens ?? 0, costUsd: out.usage?.costUsd ?? 0,
    }).where(eq(schema.aiJobs.id, id)).returning();
    if (done?.status === "done") await announceJob(done.type, done.result).catch(() => null);
    return done;
  } catch (e) {
    if (e instanceof AiPendingError) {
      // Bước cần AI: lưu yêu cầu, chờ runner Claude CLI trên máy nhận việc
      await db.update(schema.aiJobs).set({ status: "waiting_runner", aiRequest: e.request, aiResponse: null, error: null, finishedAt: null, runner: null, claimedAt: null })
        .where(eq(schema.aiJobs.id, id));
      return null;
    }
    const err = e as Error;
    let status: string = "failed";
    let message = err.message;
    if (e instanceof AiNotConfiguredError || message.startsWith("not_configured")) message = `Chưa cấu hình nguồn: ${message.replace("not_configured: ", "")}`;
    else if (e instanceof AiBudgetError) status = "skipped";
    else if (e instanceof AiOutputError) message = `Kết quả sai cấu trúc — đưa vào hàng kiểm tra: ${message}`;
    else if (isTransient(e) && job.attempts < MAX_ATTEMPTS) status = "queued"; // thử lại ở lượt sau
    await db.update(schema.aiJobs).set({ status, error: message.slice(0, 1000), finishedAt: status === "queued" ? null : new Date(), needsReview: e instanceof AiOutputError })
      .where(eq(schema.aiJobs.id, id));
    if (status === "failed") await announceFailure(id, type, message).catch(() => null);
    return null;
  }
}

/** Chạy các tác vụ đang chờ cho tới khi hết thời gian cho phép của một lần gọi serverless */
export async function drainQueue(budgetMs = 240_000) {
  const db = await getDb();
  const started = Date.now();
  // Tác vụ "running" quá 15 phút coi như chết giữa chừng → đưa lại hàng đợi
  await db.update(schema.aiJobs).set({ status: "queued" })
    .where(and(eq(schema.aiJobs.status, "running"), lt(schema.aiJobs.startedAt, new Date(Date.now() - 15 * 60_000)), lt(schema.aiJobs.attempts, MAX_ATTEMPTS)));
  // Runner nhận việc nhưng quá 20 phút không gửi kết quả (máy tắt, mất mạng) → trả lại hàng chờ runner
  await db.update(schema.aiJobs).set({ status: "waiting_runner", runner: null, claimedAt: null })
    .where(and(eq(schema.aiJobs.status, "runner_running"), lt(schema.aiJobs.claimedAt, new Date(Date.now() - 20 * 60_000))));
  const ran: string[] = [];
  while (Date.now() - started < budgetMs) {
    const [next] = await db.select({ id: schema.aiJobs.id }).from(schema.aiJobs)
      .where(or(eq(schema.aiJobs.status, "queued"))).orderBy(asc(schema.aiJobs.createdAt)).limit(1);
    if (!next) break;
    await runJob(next.id);
    ran.push(next.id);
  }
  return ran;
}

// ───────────── Hàng chờ cho runner Claude CLI trên máy ─────────────
const RUNNER_MAX_ATTEMPTS = 3;

/** Runner nhận 1 việc (nguyên tử: chỉ một runner giành được). Trả null nếu không có việc. */
export async function claimForRunner(runner: string) {
  const db = await getDb();
  const rows = await db.execute(sql`
    update ai_jobs set status = 'runner_running', runner = ${runner.slice(0, 80)}, claimed_at = now()
    where id = (select id from ai_jobs where status = 'waiting_runner' order by created_at limit 1 for update skip locked)
    returning id, type, ai_request, attempts`);
  const list = (Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows) as { id: string; type: string; ai_request: { system: string; user: string; schema: unknown; effort: string } | null; attempts: number }[];
  const j = list[0];
  if (!j || !j.ai_request) return null;
  return { id: j.id, type: j.type, label: JOB_TYPES[j.type as JobType] ?? j.type, attempts: j.attempts, ...j.ai_request };
}

/** Runner gửi kết quả: lưu rồi chạy lại bước để lưu nháp/đề xuất. Trả trạng thái cuối. */
export async function completeFromRunner(id: string, output: unknown, model: string) {
  const db = await getDb();
  const [j] = await db.update(schema.aiJobs).set({ status: "queued", aiResponse: output as Record<string, unknown>, model: model.slice(0, 60) })
    .where(and(eq(schema.aiJobs.id, id), eq(schema.aiJobs.status, "runner_running"))).returning({ id: schema.aiJobs.id });
  if (!j) return { ok: false as const, error: "Tác vụ không ở trạng thái chờ kết quả" };
  const done = await runJob(id);
  const [after] = await db.select({ status: schema.aiJobs.status, error: schema.aiJobs.error, result: schema.aiJobs.result }).from(schema.aiJobs).where(eq(schema.aiJobs.id, id));
  return { ok: !!done, status: after?.status, error: after?.error, result: after?.result };
}

/** Runner báo lỗi (CLI lỗi, hết giới hạn gói...): thử lại tối đa 3 lần rồi đánh dấu thất bại để hiện ở A09 */
export async function failFromRunner(id: string, error: string) {
  const db = await getDb();
  const [j] = await db.select().from(schema.aiJobs).where(eq(schema.aiJobs.id, id));
  if (!j || j.status !== "runner_running") return;
  const tries = (j.result as { runnerTries?: number } | null)?.runnerTries ?? 0;
  const failed = tries + 1 >= RUNNER_MAX_ATTEMPTS;
  await db.update(schema.aiJobs).set({
    status: failed ? "failed" : "waiting_runner", runner: null, claimedAt: null, error: `Runner: ${error.slice(0, 800)}`,
    result: { ...(j.result ?? {}), runnerTries: tries + 1 }, finishedAt: failed ? new Date() : null,
  }).where(eq(schema.aiJobs.id, id));
  if (failed) await announceFailure(id, j.type, `Runner: ${error}`).catch(() => null);
}

// ───────────── Báo Telegram cho chủ website ─────────────
/** AI viết xong bản nháp → báo "bài chờ duyệt" kèm link mở trong quản trị (AI không tự đăng) */
async function announceJob(type: string, result: Record<string, unknown> | null) {
  if (!["write_draft", "write_brief", "refresh_article"].includes(type) || !result?.articleId) return;
  const db = await getDb();
  const [a] = await db.select({ id: schema.articles.id, kw: schema.articles.targetKeyword, title: schema.revisions.title })
    .from(schema.articles).leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId))
    .where(eq(schema.articles.id, String(result.articleId)));
  if (!a) return;
  const { notifyAdmin, esc, siteUrl } = await import("../notify");
  await notifyAdmin("review", [
    `📝 <b>AI vừa viết xong ${type === "refresh_article" ? "bản cập nhật" : "bản nháp"} — chờ bạn duyệt</b>`,
    `“${esc(a.title ?? String(result.slug ?? ""))}”`,
    a.kw ? `🔑 Từ khoá: ${esc(a.kw)}` : "",
    `🔍 ${Number(result.factChecks ?? 0)} dữ kiện cần kiểm chứng · ${Number(result.blockedClaims ?? 0)} câu bị bộ lọc DNA chặn`,
    `👉 <a href="${siteUrl()}/admin/content/${a.id}">Mở bài để duyệt</a> (AI không tự đăng)`,
  ].filter(Boolean).join("\n"));
}

async function announceFailure(id: string, type: string, message: string) {
  const { notifyAdmin, esc, siteUrl } = await import("../notify");
  await notifyAdmin("aiFailed", [
    `⚠️ <b>Tác vụ AI thất bại:</b> ${esc(JOB_TYPES[type as JobType] ?? type)}`,
    esc(message.slice(0, 300)),
    `👉 <a href="${siteUrl()}/admin/seo/jobs/${id}">Xem và chạy lại</a>`,
  ].join("\n"));
}

export async function runnerQueueCount() {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.aiJobs).where(eq(schema.aiJobs.status, "waiting_runner"));
  return Number(r?.n ?? 0);
}
