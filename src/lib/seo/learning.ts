// Vòng phản hồi tự học (feedback loop v2).
//
//   cơ hội SEO (điểm thành phần) ─► bản nháp AI ─► người duyệt xuất bản ─► THÍ NGHIỆM (chụp số liệu nền)
//                                                                              │ 28 ngày
//   trọng số chấm điểm ◄── học lại (tương quan yếu tố ↔ kết quả) ◄── KẾT LUẬN thắng / thua / hoà
//   bộ hướng dẫn viết  ◄── AI đề xuất phiên bản mới (căn cứ: tỷ lệ thắng theo phiên bản) — người duyệt kích hoạt
//
// Nguyên tắc an toàn:
//  - Hệ thống KHÔNG tự sửa mã nguồn, KHÔNG tự xuất bản. Thứ "tự nâng cấp" là: trọng số chấm điểm (trong biên 0.5–2,
//    mỗi lần đổi tối đa ±20%, có thể khoá/hoàn tác) và ĐỀ XUẤT phiên bản hướng dẫn viết (cần người duyệt).
//  - Mọi lần tự điều chỉnh ghi vào learning_log kèm số liệu làm căn cứ.
import "server-only";
import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { getSetting, setSetting, WEIGHT_KEYS, type ScoringWeights } from "../settings";
import { pagePerformance, periodRange } from "./metrics";
import { rowsOf } from "../db/rows";
import { judge, pearson, type Snapshot } from "./learning-core";
export { judge };

export const EVAL_DAYS = 28;
const MIN_EXPERIMENTS_FOR_WEIGHTS = 6;
const MAX_STEP = 0.2;

const articlePath = (a: { kind: string; slug: string }) => `/${a.kind === "news" ? "tin-tuc" : "kien-thuc"}/${a.slug}`;

function snap(p?: { impressions: number; clicks: number; ctr: number; position: number | null; views: number; marketplaceClicks: number; consultClicks: number; leads: number }): Snapshot {
  if (!p) return { impressions: 0, clicks: 0, ctr: null, position: null, views: 0, conversions: 0 };
  return { impressions: p.impressions, clicks: p.clicks, ctr: p.impressions ? p.clicks / p.impressions : null, position: p.position, views: p.views, conversions: p.marketplaceClicks + p.consultClicks + p.leads };
}

/** Gọi sau khi một bài được xuất bản: mở thí nghiệm để 28 ngày sau đo lại (chạy lặp an toàn theo revision). */
export async function startExperimentOnPublish(articleId: string) {
  const db = await getDb();
  const [a] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId));
  if (!a?.publishedRevisionId) return null;
  const [dup] = await db.select({ id: schema.experiments.id }).from(schema.experiments).where(eq(schema.experiments.revisionId, a.publishedRevisionId));
  if (dup) return dup.id;
  const [rev] = await db.select().from(schema.revisions).where(eq(schema.revisions.id, a.publishedRevisionId));
  const [opp] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.draftArticleId, a.id)).orderBy(desc(schema.opportunities.createdAt)).limit(1);
  const firstPublish = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.experiments).where(eq(schema.experiments.articleId, a.id)))[0].n === 0 && opp?.type !== "update" && opp?.type !== "ctr_fix";
  const kind = opp?.type === "ctr_fix" ? "ctr_fix" : opp?.type === "update" ? "update" : firstPublish ? "new_article" : "update";
  const perf = await pagePerformance(EVAL_DAYS);
  const [e] = await db.insert(schema.experiments).values({
    kind, articleId: a.id, opportunityId: opp?.id ?? null, revisionId: a.publishedRevisionId, promptVersion: rev?.origin === "ai" ? a.promptVersion : null,
    hypothesis: opp ? `${opp.title} — ${opp.rationale.slice(0, 300)}` : rev?.origin === "ai" ? "Bài do AI viết nháp, người duyệt xuất bản" : "Bài do biên tập viên viết",
    baseline: kind === "new_article" ? snap() : snap(perf.get(articlePath(a))),
    factors: (opp?.factors as Record<string, number>) ?? {},
    evaluateAfter: new Date(Date.now() + EVAL_DAYS * 86400_000),
  }).returning();
  return e.id;
}

/** Đánh giá các thí nghiệm đã đủ 28 ngày (chạy hằng ngày/tuần, an toàn khi chạy lặp). */
export async function evaluateExperiments() {
  const db = await getDb();
  const due = await db.select({ e: schema.experiments, kind: schema.articles.kind, slug: schema.articles.slug })
    .from(schema.experiments).innerJoin(schema.articles, eq(schema.articles.id, schema.experiments.articleId))
    .where(and(eq(schema.experiments.verdict, "running"), lte(schema.experiments.evaluateAfter, new Date())));
  if (!due.length) return { evaluated: 0 };
  const perf = await pagePerformance(EVAL_DAYS);
  const counts: Record<string, number> = {};
  for (const { e, kind, slug } of due) {
    const after = snap(perf.get(articlePath({ kind, slug })));
    const { verdict, score } = judge(e.kind, e.baseline, after);
    await db.update(schema.experiments).set({ result: { ...after, score }, verdict, evaluatedAt: new Date() }).where(eq(schema.experiments.id, e.id));
    counts[verdict] = (counts[verdict] ?? 0) + 1;
  }
  await db.insert(schema.learningLog).values({
    kind: "experiment_verdict", applied: true,
    summary: `Đánh giá ${due.length} thí nghiệm sau ${EVAL_DAYS} ngày: ${Object.entries(counts).map(([k, v]) => `${VERDICT_LABEL[k] ?? k} ${v}`).join(", ")}`,
    evidence: { counts, ids: due.map((d) => d.e.id) },
  });
  return { evaluated: due.length, counts };
}

export const VERDICT_LABEL: Record<string, string> = { running: "Đang đo", win: "Thắng", loss: "Thua", neutral: "Hoà", insufficient: "Chưa đủ dữ liệu" };
export const KIND_LABEL: Record<string, string> = { new_article: "Bài mới", ctr_fix: "Viết lại tiêu đề/mô tả", update: "Cập nhật nội dung", prompt_version: "Bộ hướng dẫn viết", weights: "Trọng số chấm điểm" };

/**
 * Học lại trọng số chấm điểm cơ hội: yếu tố nào đi kèm bài "thắng" nhiều hơn thì được tăng trọng số (và ngược lại).
 * Mỗi lần chỉnh tối đa ±20%, kẹp trong [0.5, 2]. Khi bị khoá hoặc tắt tự áp dụng → chỉ ghi đề xuất vào nhật ký học.
 */
export async function learnWeights() {
  const db = await getDb();
  const rows = await db.select().from(schema.experiments)
    .where(and(eq(schema.experiments.kind, "new_article"), inArray(schema.experiments.verdict, ["win", "loss", "neutral"])));
  const usable = rows.filter((r) => Object.keys(r.factors).length > 0);
  if (usable.length < MIN_EXPERIMENTS_FOR_WEIGHTS) {
    return { skipped: `Cần ít nhất ${MIN_EXPERIMENTS_FOR_WEIGHTS} bài mới đã có kết luận (đang có ${usable.length}).` };
  }
  const cur = await getSetting("scoringWeights");
  const outcome = usable.map((r) => r.verdict === "win" ? 1 : r.verdict === "loss" ? -1 : 0);
  const next: ScoringWeights = { ...cur };
  const corr: Record<string, number> = {};
  for (const k of WEIGHT_KEYS) {
    const xs = usable.map((r) => Number(r.factors[k] ?? 0));
    const c = pearson(xs, outcome);
    corr[k] = Number(c.toFixed(3));
    const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, c * MAX_STEP));
    next[k] = Number(Math.max(0.5, Math.min(2, cur[k] * (1 + step))).toFixed(3));
  }
  next.basedOn = usable.length;
  next.updatedAt = new Date().toISOString();
  const apply = cur.autoApply && !cur.locked;
  if (apply) await setSetting("scoringWeights", next);
  const before = Object.fromEntries(WEIGHT_KEYS.map((k) => [k, cur[k]]));
  const after = Object.fromEntries(WEIGHT_KEYS.map((k) => [k, next[k]]));
  await db.insert(schema.learningLog).values({
    kind: "weights", applied: apply, before, after,
    summary: `${apply ? "Đã tự điều chỉnh" : "Đề xuất (chưa áp dụng vì đang khoá/tắt tự áp dụng)"} trọng số chấm điểm từ ${usable.length} bài có kết luận`,
    evidence: { correlation: corr, wins: outcome.filter((x) => x > 0).length, losses: outcome.filter((x) => x < 0).length },
  });
  return { applied: apply, before, after, correlation: corr };
}

/** Hoàn tác một lần tự điều chỉnh trọng số (về giá trị "before" của bản ghi nhật ký) */
export async function revertWeights(logId: string) {
  const db = await getDb();
  const [log] = await db.select().from(schema.learningLog).where(and(eq(schema.learningLog.id, logId), eq(schema.learningLog.kind, "weights"), isNull(schema.learningLog.revertedAt)));
  if (!log?.before) throw new Error("Không tìm thấy lần điều chỉnh có thể hoàn tác");
  const cur = await getSetting("scoringWeights");
  await setSetting("scoringWeights", { ...cur, ...(log.before as Partial<ScoringWeights>), updatedAt: new Date().toISOString() });
  await db.update(schema.learningLog).set({ revertedAt: new Date() }).where(eq(schema.learningLog.id, logId));
}

/** Tỷ lệ thắng theo phiên bản hướng dẫn viết — căn cứ để AI đề xuất bản mới và để người duyệt so sánh */
export async function promptPerformance() {
  const db = await getDb();
  return rowsOf<{ version: number | null; total: number; wins: number; losses: number; running: number }>(await db.execute(sql`
    select prompt_version as version, count(*)::int as total,
      count(*) filter (where verdict = 'win')::int as wins, count(*) filter (where verdict = 'loss')::int as losses,
      count(*) filter (where verdict = 'running')::int as running
    from experiments where prompt_version is not null group by prompt_version order by prompt_version`));
}

/** Phễu đo lường toàn site: Google (hiển thị → nhấp) → website (xem → bấm sàn / tư vấn / gửi form). */
export async function funnel(days = 28) {
  const db = await getDb();
  const r = periodRange(days);
  const [g] = rowsOf<{ impressions: number; clicks: number; pos: number | null }>(await db.execute(sql`
    select coalesce(sum(impressions),0)::int as impressions, coalesce(sum(clicks),0)::int as clicks,
      sum(position * impressions) / nullif(sum(impressions),0) as pos
    from gsc_metrics where date between ${r.start} and ${r.end}`));
  const since = new Date(Date.now() - days * 86400_000);
  const ev = await db.select({ type: schema.events.type, n: sql<number>`count(*)::int` }).from(schema.events)
    .where(sql`${schema.events.createdAt} >= ${since}`).groupBy(schema.events.type);
  const c = (t: string) => Number(ev.find((e) => e.type === t)?.n ?? 0);
  const views = c("page_view");
  const conversions = c("marketplace_click") + c("consult_click") + c("lead_submit");
  return {
    days, impressions: Number(g?.impressions ?? 0), clicks: Number(g?.clicks ?? 0), position: g?.pos == null ? null : Number(g.pos),
    views, marketplaceClicks: c("marketplace_click"), consultClicks: c("consult_click"), leads: c("lead_submit"), selector: c("selector_complete"), applies: c("job_apply"),
    ctr: g?.impressions ? Number(g.clicks) / Number(g.impressions) : null,
    conversionRate: views ? conversions / views : null,
  };
}

/** Một vòng học đầy đủ (cron tuần gọi): đánh giá thí nghiệm → học trọng số. */
export async function runLearningCycle() {
  const evaluated = await evaluateExperiments();
  const weights = await learnWeights();
  return { evaluated, weights };
}
