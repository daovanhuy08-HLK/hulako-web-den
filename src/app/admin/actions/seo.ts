"use server";
// Server Actions cho A09 SEO & AI Agent và A10 cấu hình Agent
import { after } from "next/server";
import { and, eq, max } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import { adminAction, num, str, UserError } from "@/lib/admin";
import { cancelJob, enqueue, retryJob, runJob, JOB_TYPES, type JobType } from "@/lib/ai/jobs";
import { importKeywordsCsv } from "@/lib/seo/pipeline";
import { getSetting, setSetting } from "@/lib/settings";
import { normalizeVi, slugify } from "@/lib/text";
import { audit } from "@/lib/audit";
import { checkClaims } from "@/lib/guardrails";

export async function runAgentJob(fd: FormData) {
  return adminAction("seo.run_ai", async (u) => {
    const type = str(fd, "type") as JobType;
    if (!(type in JOB_TYPES)) throw new UserError("Loại tác vụ không hợp lệ");
    const scope: Record<string, unknown> = {};
    if (str(fd, "opportunityId")) scope.opportunityId = str(fd, "opportunityId");
    const key = type === "write_draft" ? String(scope.opportunityId) : randomUUID();
    const { job, created } = await enqueue(type, scope, key, u.id);
    if (!created) return { ok: true, message: `Tác vụ đã tồn tại (${job.status}) — không chạy trùng` };
    after(() => runJob(job.id)); // chạy nền sau khi trả phản hồi
    await audit(u.id, "ai_job.create", "ai_job", job.id, { type });
    return { ok: true, message: `Đã đưa vào hàng chờ: ${JOB_TYPES[type]}. Tải lại sau ít phút để xem kết quả.` };
  });
}

export async function retryAgentJob(fd: FormData) {
  return adminAction("seo.run_ai", async () => {
    const id = str(fd, "id");
    await retryJob(id);
    after(() => runJob(id));
    return { ok: true, message: "Đã chạy lại" };
  });
}

export async function cancelAgentJob(fd: FormData) {
  return adminAction("seo.run_ai", async () => { await cancelJob(str(fd, "id")); return { ok: true, message: "Đã huỷ" }; });
}

export async function dismissOpportunity(fd: FormData) {
  return adminAction("seo.view", async (u) => {
    const db = await getDb();
    await db.update(schema.opportunities).set({ status: "dismissed" }).where(eq(schema.opportunities.id, str(fd, "id")));
    await audit(u.id, "opportunity.dismiss", "opportunity", str(fd, "id"));
    return { ok: true, message: "Đã bỏ qua cơ hội" };
  });
}

export async function addKeyword(fd: FormData) {
  return adminAction("seo.view", async () => {
    const db = await getDb();
    const query = str(fd, "query");
    const normalized = normalizeVi(query);
    if (!normalized) throw new UserError("Nhập từ khoá");
    await db.insert(schema.keywords).values({
      query, normalized, cluster: slugify(str(fd, "cluster")), intent: str(fd, "intent"), source: str(fd, "source") || "manual", variantsSeen: [query],
      searchVolume: str(fd, "searchVolume") ? num(fd, "searchVolume") : null,
    }).onConflictDoUpdate({ target: schema.keywords.normalized, set: { cluster: slugify(str(fd, "cluster")), intent: str(fd, "intent") } });
    return { ok: true, message: "Đã thêm từ khoá" };
  });
}

export async function importCsv(fd: FormData) {
  return adminAction("seo.view", async () => {
    const f = fd.get("csv");
    const text = f instanceof File && f.size ? await f.text() : str(fd, "csvText");
    if (!text) throw new UserError("Chọn tệp CSV hoặc dán nội dung");
    if (text.length > 2_000_000) throw new UserError("Tệp quá lớn");
    const n = await importKeywordsCsv(text);
    return { ok: true, message: `Đã nhập ${n} từ khoá` };
  });
}

export async function skipKeyword(fd: FormData) {
  return adminAction("seo.view", async () => {
    const db = await getDb();
    await db.update(schema.keywords).set({ status: "skipped" }).where(eq(schema.keywords.id, str(fd, "id")));
    return { ok: true, message: "Đã bỏ qua từ khoá" };
  });
}

/** Kích hoạt một phiên bản hướng dẫn viết (kể cả bản AI đề xuất) — chỉ người duyệt/quản trị */
export async function activatePrompt(fd: FormData) {
  return adminAction("content.review", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [p] = await db.select().from(schema.promptVersions).where(eq(schema.promptVersions.id, id));
    if (!p) throw new UserError("Không tìm thấy phiên bản");
    if (!p.content.includes("LUẬT") && !p.content.toLowerCase().includes("template")) {
      // không chặn, chỉ nhắc — luật cứng thương hiệu luôn nằm trong system prompt cố định
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.promptVersions).set({ status: "retired" }).where(and(eq(schema.promptVersions.key, p.key), eq(schema.promptVersions.status, "active")));
      await tx.update(schema.promptVersions).set({ status: "active", activatedAt: new Date() }).where(eq(schema.promptVersions.id, id));
    });
    await audit(u.id, "prompt.activate", "prompt_version", id, { version: p.version, origin: p.origin });
    return { ok: true, message: `Đã kích hoạt hướng dẫn viết v${p.version}` };
  });
}

export async function savePromptVersion(fd: FormData) {
  return adminAction("content.review", async (u) => {
    const db = await getDb();
    const content = str(fd, "content");
    if (content.length < 100) throw new UserError("Hướng dẫn quá ngắn");
    if (checkClaims({ content }).length) throw new UserError("Hướng dẫn chứa cụm từ bị chặn theo quy tắc thương hiệu");
    const [{ v }] = await db.select({ v: max(schema.promptVersions.version) }).from(schema.promptVersions).where(eq(schema.promptVersions.key, "article_writer"));
    await db.insert(schema.promptVersions).values({ key: "article_writer", version: (v ?? 0) + 1, content, status: "draft", origin: "human", rationale: str(fd, "rationale") });
    await audit(u.id, "prompt.create", "prompt_version", null);
    return { ok: true, message: "Đã lưu phiên bản nháp — bấm Kích hoạt để dùng" };
  });
}

export async function saveRedirect(fd: FormData) {
  return adminAction("seo.view", async (u) => {
    const db = await getDb();
    const from = str(fd, "fromPath"), to = str(fd, "toPath");
    if (!from.startsWith("/") || !to.startsWith("/")) throw new UserError("Đường dẫn phải bắt đầu bằng /");
    if (from === to) throw new UserError("URL cũ và mới trùng nhau");
    // Chống vòng lặp & chuỗi: trỏ thẳng tới URL cuối
    const [loop] = await db.select().from(schema.redirects).where(eq(schema.redirects.fromPath, to));
    const final = loop ? loop.toPath : to;
    if (final === from) throw new UserError("Tạo vòng lặp chuyển hướng");
    await db.update(schema.redirects).set({ toPath: final }).where(eq(schema.redirects.toPath, from));
    await db.insert(schema.redirects).values({ fromPath: from, toPath: final }).onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: final } });
    await audit(u.id, "redirect.save", "redirect", from, { to: final });
    return { ok: true, message: `Đã lưu 301: ${from} → ${final}` };
  });
}

export async function deleteRedirect(fd: FormData) {
  return adminAction("seo.view", async () => {
    const db = await getDb();
    await db.delete(schema.redirects).where(eq(schema.redirects.id, str(fd, "id")));
    return { ok: true, message: "Đã xoá chuyển hướng" };
  });
}

export async function saveAgentConfig(fd: FormData) {
  return adminAction("settings.edit", async (u) => {
    const cur = await getSetting("agent");
    const next = {
      ...cur, paused: fd.get("paused") === "on", autoDraftsPerWeek: Math.min(10, Math.max(0, num(fd, "autoDraftsPerWeek", 2))),
      minScoreForAutoDraft: Math.min(100, Math.max(0, num(fd, "minScoreForAutoDraft", 55))),
      suggestKeywordsWeekly: fd.get("suggestKeywordsWeekly") === "on", improvePromptMonthly: fd.get("improvePromptMonthly") === "on",
    };
    await setSetting("agent", next);
    await audit(u.id, "settings.agent", "settings", "agent", next);
    return { ok: true, message: "Đã lưu cấu hình AI Agent" };
  });
}
