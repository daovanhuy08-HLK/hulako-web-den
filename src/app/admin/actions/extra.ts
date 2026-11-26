"use server";
// Server Actions bổ sung cho các màn quản trị mới (mã ảnh ghi ở từng hàm).
// Mọi thao tác ghi đều kiểm quyền phía máy chủ qua adminAction()/requireUser(); thao tác xuất bản,
// đổi quyền và thay link mua được ghi nhật ký (audit).
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { adminAction, lines, num, str, UserError } from "@/lib/admin";
import { ForbiddenError, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { isAllowedMarketUrl, getSetting, setSetting } from "@/lib/settings";
import { normalizeVi, parseVNLocal, slugify } from "@/lib/text";
import { transitionArticle } from "@/lib/workflow";
import { recommend, recommendInput } from "@/lib/recommend";
import { enqueue, runJob, JOB_TYPES, type JobType } from "@/lib/ai/jobs";
import { gscConfigured, accessToken } from "@/lib/seo/gsc";
import { checkClaims } from "@/lib/guardrails";
import { getAdminSetting, setAdminSetting, type ScheduleItem } from "@/lib/admin-settings";
import { createResetToken, resetLink, RESET_TTL_MIN } from "@/lib/admin-password";

// ───────── 030 Lịch xuất bản: lên lịch từ form ngày + giờ (giờ Việt Nam) ─────────
export async function scheduleFromCalendar(fd: FormData) {
  return adminAction("content.review", async (u) => {
    const id = str(fd, "id");
    if (!id) throw new UserError("Chọn bài viết đã duyệt");
    const date = str(fd, "date"), time = str(fd, "time") || "08:00";
    const at = parseVNLocal(`${date}T${time}`);
    if (!at) throw new UserError("Chọn ngày và giờ đăng");
    await transitionArticle(u, id, "schedule", { scheduledAt: at });
    return { ok: true, message: `Đã lên lịch đăng lúc ${time} ngày ${date.split("-").reverse().join("/")} (giờ Việt Nam)` };
  });
}

// ───────── 058 Chạy thử quy tắc chọn đèn — trả kết quả có cấu trúc ─────────
export type RuleTestResult = {
  ok: boolean; message?: string; version?: number | null; ruleName?: string | null; priority?: number | null;
  setup?: string | null; products?: string[]; advice?: string; needsConsultation?: boolean; reason?: string;
};
export async function runRuleTest(fd: FormData): Promise<RuleTestResult> {
  try {
    await requireUser("setup.edit");
    const input = recommendInput.parse({ area: str(fd, "area"), industry: str(fd, "industry"), style: str(fd, "style"), owned: fd.getAll("owned").map(String) });
    const version = num(fd, "version") || undefined;
    const r = await recommend(input, version);
    let ruleName: string | null = null, priority: number | null = null;
    if (r.ruleId) {
      const db = await getDb();
      const [rule] = await db.select().from(schema.recommendationRules).where(eq(schema.recommendationRules.id, r.ruleId));
      ruleName = rule?.name ?? null; priority = rule?.priority ?? null;
    }
    const REASON: Record<string, string> = { no_active_rules: "Chưa có bảng quy tắc đang hiệu lực", no_match: "Không quy tắc nào khớp → chuyển tư vấn", missing_products: "Quy tắc khớp nhưng thiết bị gợi ý chưa công khai → chuyển tư vấn", ok: "Có gợi ý" };
    return {
      ok: true, version: r.ruleVersion, ruleName, priority, setup: r.setup?.title ?? null, products: r.products.map((p) => `${p.name} (${p.sku})`),
      advice: r.advice, needsConsultation: r.needsConsultation, reason: REASON[r.reason] ?? r.reason,
    };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, message: e instanceof ForbiddenError ? e.message : "Đầu vào chưa hợp lệ hoặc lỗi máy chủ" };
  }
}

// ───────── 071 Quy tắc trùng: chỉ đổi mức ưu tiên (không ghi đè điều kiện) ─────────
export async function setRulePriority(fd: FormData) {
  return adminAction("setup.edit", async () => {
    const db = await getDb();
    const version = num(fd, "version");
    const [set] = await db.select().from(schema.ruleSets).where(eq(schema.ruleSets.version, version));
    if (!set || set.status !== "draft") throw new UserError("Chỉ sửa được phiên bản nháp");
    await db.update(schema.recommendationRules).set({ priority: num(fd, "priority") })
      .where(and(eq(schema.recommendationRules.id, str(fd, "id")), eq(schema.recommendationRules.ruleSetVersion, version)));
    return { ok: true, message: "Đã đổi mức ưu tiên — bấm Kiểm tra lại" };
  });
}

// ───────── 054 Chính sách theo sản phẩm / phiên bản / kênh ─────────
export async function savePolicy(fd: FormData) {
  return adminAction("product.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [scope, refId] = str(fd, "target").split(":");
    if (!["product", "variant", "channel"].includes(scope) || !refId) throw new UserError("Chọn phạm vi áp dụng");
    const title = str(fd, "title"), content = str(fd, "content");
    if (title.length < 3) throw new UserError("Nhập tên chính sách");
    if (content.length < 10) throw new UserError("Nhập nội dung chính sách đã được xác nhận");
    const wantApproved = str(fd, "then") === "approve" || str(fd, "status") === "approved";
    if (wantApproved && !can(u.roles, "product.publish")) throw new UserError("Duyệt chính sách cần quyền xuất bản sản phẩm — đã lưu dạng nháp nếu bạn bấm Lưu nháp");
    const issues = checkClaims({ title, content });
    if (issues.length && wantApproved) throw new UserError(`Claim bị chặn: ${issues.map((i) => `“${i.match}” — ${i.hint}`).join("; ")}`);
    const d = (k: string) => (str(fd, k) ? new Date(`${str(fd, k)}T00:00:00+07:00`) : null);
    const values = { scope, refId, title, content, status: wantApproved ? "approved" : "draft", validFrom: d("validFrom"), validTo: d("validTo") };
    let pid = id;
    if (id) await db.update(schema.policies).set(values).where(eq(schema.policies.id, id));
    else pid = (await db.insert(schema.policies).values(values).returning({ id: schema.policies.id }))[0].id;
    await audit(u.id, wantApproved ? "policy.approve" : "policy.save", "policy", pid, { scope, refId, status: values.status });
    return { ok: true, message: wantApproved ? "Đã duyệt chính sách" : "Đã lưu nháp chính sách", redirect: `/admin/products/policies?id=${pid}` };
  });
}

export async function deletePolicy(fd: FormData) {
  return adminAction("product.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [p] = await db.select().from(schema.policies).where(eq(schema.policies.id, id));
    if (p?.status === "approved" && !can(u.roles, "product.publish")) throw new UserError("Gỡ chính sách đã duyệt cần quyền xuất bản");
    await db.delete(schema.policies).where(eq(schema.policies.id, id));
    await audit(u.id, "policy.delete", "policy", id);
    return { ok: true, message: "Đã xoá chính sách", redirect: "/admin/products/policies" };
  });
}

// ───────── 055 Kiểm tra liên kết mua ─────────
async function linkWithVariant(id: string) {
  const db = await getDb();
  const [row] = await db.select({ l: schema.channelLinks, vstatus: schema.variants.status, pstatus: schema.products.status, slug: schema.products.slug })
    .from(schema.channelLinks).innerJoin(schema.variants, eq(schema.variants.id, schema.channelLinks.variantId))
    .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId)).where(eq(schema.channelLinks.id, id));
  if (!row) throw new UserError("Không tìm thấy liên kết");
  return row;
}

export async function updateChannelLink(fd: FormData) {
  return adminAction("product.edit", async (u) => {
    const db = await getDb();
    const row = await linkWithVariant(str(fd, "id"));
    const url = str(fd, "url");
    if (!isAllowedMarketUrl(url)) throw new UserError("Link phải là HTTPS và thuộc tên miền sàn được phép (Shopee / TikTok Shop)");
    if (url === row.l.url) return { ok: true, message: "Liên kết không đổi" };
    // Thay link mua của phiên bản đang công khai cần người có quyền xuất bản (mục 07)
    if (row.vstatus === "public" && row.pstatus === "public" && !can(u.roles, "product.publish")) throw new UserError("Thay link mua của phiên bản đang công khai cần quyền xuất bản");
    await db.update(schema.channelLinks).set({ url, status: "pending_check", checkedAt: null }).where(eq(schema.channelLinks.id, row.l.id));
    await audit(u.id, "channel_link.change", "variant", row.l.variantId, { channel: row.l.channel, from: row.l.url, to: url });
    revalidatePath(`/thiet-bi/${row.slug}`);
    return { ok: true, message: "Đã lưu liên kết — bấm Kiểm tra thủ công để xác nhận đích" };
  });
}

/** Kiểm tra đích: gọi thử URL công khai (chỉ tên miền sàn được phép), cập nhật trạng thái + ngày kiểm tra */
export async function checkChannelLink(fd: FormData) {
  return adminAction("product.edit", async (u) => {
    const db = await getDb();
    const row = await linkWithVariant(str(fd, "id"));
    if (!isAllowedMarketUrl(row.l.url)) {
      await db.update(schema.channelLinks).set({ status: "broken", checkedAt: new Date() }).where(eq(schema.channelLinks.id, row.l.id));
      return { ok: false, message: "Liên kết không thuộc tên miền sàn được phép → đánh dấu lỗi" };
    }
    let status = "pending_check", note = "";
    try {
      const res = await fetch(row.l.url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (HULAKO link check)" } });
      if (res.ok) { status = "ok"; note = `HTTP ${res.status}`; }
      else if (res.status === 404 || res.status === 410) { status = "broken"; note = `HTTP ${res.status} — trang không tồn tại`; }
      else note = `HTTP ${res.status} — sàn chặn kiểm tra tự động, hãy mở thử bằng tay`;
    } catch {
      note = "Không kết nối được (hết thời gian) — hãy mở thử bằng tay";
    }
    await db.update(schema.channelLinks).set({ status, checkedAt: new Date() }).where(eq(schema.channelLinks.id, row.l.id));
    await audit(u.id, "channel_link.check", "variant", row.l.variantId, { channel: row.l.channel, status });
    return { ok: status === "ok", message: `${status === "ok" ? "Liên kết hoạt động" : status === "broken" ? "Liên kết lỗi" : "Cần kiểm tra lại"} · ${note}` };
  });
}

/** Người kiểm tra bằng tay xác nhận link mở đúng sản phẩm */
export async function confirmChannelLink(fd: FormData) {
  return adminAction("product.edit", async (u) => {
    const db = await getDb();
    const row = await linkWithVariant(str(fd, "id"));
    await db.update(schema.channelLinks).set({ status: "ok", checkedAt: new Date() }).where(eq(schema.channelLinks.id, row.l.id));
    await audit(u.id, "channel_link.confirm", "variant", row.l.variantId, { channel: row.l.channel });
    return { ok: true, message: "Đã xác nhận liên kết mở đúng sản phẩm" };
  });
}

// ───────── 046 Chủ đề & cụm nội dung ─────────
export async function saveTopic(fd: FormData) {
  return adminAction("content.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const name = str(fd, "name");
    if (name.length < 3) throw new UserError("Nhập tên chủ đề");
    const slug = slugify(str(fd, "slug") || name);
    const [dup] = await db.select({ id: schema.topics.id }).from(schema.topics).where(and(eq(schema.topics.slug, slug), ...(id ? [ne(schema.topics.id, id)] : [])));
    if (dup) throw new UserError(`Đường dẫn "${slug}" đã được dùng cho chủ đề khác`);
    const values = { name, slug, intro: str(fd, "intro"), sortOrder: num(fd, "sortOrder") };
    let tid = id;
    if (id) await db.update(schema.topics).set(values).where(eq(schema.topics.id, id));
    else tid = (await db.insert(schema.topics).values(values).returning({ id: schema.topics.id }))[0].id;
    await audit(u.id, "topic.save", "topic", tid, { slug });
    revalidatePath("/kien-thuc"); revalidatePath(`/kien-thuc/chu-de/${slug}`);
    return { ok: true, message: "Đã lưu chủ đề", redirect: `/admin/seo/topics?id=${tid}` };
  });
}

export async function deleteTopic(fd: FormData) {
  return adminAction("content.review", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.articles).where(eq(schema.articles.topicId, id));
    if (Number(n)) throw new UserError(`Chủ đề đang có ${n} bài — chuyển bài sang chủ đề khác trước khi xoá`);
    await db.delete(schema.topics).where(eq(schema.topics.id, id));
    await audit(u.id, "topic.delete", "topic", id);
    return { ok: true, message: "Đã xoá chủ đề", redirect: "/admin/seo/topics" };
  });
}

// ───────── 066 Chi tiết cơ hội từ khoá ─────────
export async function updateOpportunity(fd: FormData) {
  return adminAction("seo.view", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [o] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id));
    if (!o) throw new UserError("Không tìm thấy cơ hội");
    if (o.draftArticleId) throw new UserError("Cơ hội đã có bản nháp — sửa trực tiếp trong bài viết");
    const type = ["new", "update", "merge", "ctr_fix"].includes(str(fd, "type")) ? str(fd, "type") : o.type;
    const targetArticleId = str(fd, "targetArticleId") || null;
    if ((type === "update" || type === "ctr_fix") && !targetArticleId) throw new UserError("Cập nhật bài cần chọn trang mục tiêu");
    await db.update(schema.opportunities).set({ type, targetArticleId }).where(eq(schema.opportunities.id, id));
    if (o.keywordIds[0]) {
      await db.update(schema.keywords).set({ kind: str(fd, "kind"), intent: str(fd, "intent"), cluster: slugify(str(fd, "cluster")) })
        .where(eq(schema.keywords.id, o.keywordIds[0]));
    }
    await audit(u.id, "opportunity.update", "opportunity", id, { type });
    return { ok: true, message: "Đã lưu thay đổi" };
  });
}

// ───────── 036 Tạo đề cương bằng AI: tạo cơ hội thủ công → (tuỳ chọn) chạy AI viết brief + nháp ─────────
export async function createOutline(fd: FormData) {
  const run = str(fd, "then") === "run";
  return adminAction(run ? "seo.run_ai" : "seo.view", async (u) => {
    const db = await getDb();
    const topic = str(fd, "topic"), query = str(fd, "keyword");
    if (topic.length < 5) throw new UserError("Nhập chủ đề bài viết (≥ 5 ký tự)");
    const normalized = normalizeVi(query);
    if (!normalized) throw new UserError("Nhập từ khoá chính");
    const cluster = slugify(str(fd, "cluster"));
    const [kw] = await db.insert(schema.keywords).values({
      query, normalized, cluster, intent: str(fd, "intent"), source: "manual", variantsSeen: [query],
    }).onConflictDoUpdate({ target: schema.keywords.normalized, set: { intent: str(fd, "intent"), ...(cluster ? { cluster } : {}) } }).returning();
    const evidence = { nguon: "Biên tập viên nhập tay", nguonThamKhao: lines(fd, "references"), sanPham: fd.getAll("productIds").map(String) };
    const dedupeKey = `manual:${normalized}`;
    const [opp] = await db.insert(schema.opportunities).values({
      type: "new", title: topic, keywordIds: [kw.id], score: 50, rationale: `Tạo thủ công bởi ${u.name || u.email}. Ý định: ${str(fd, "intent") || "—"}.`, evidence, dedupeKey,
    }).onConflictDoUpdate({ target: schema.opportunities.dedupeKey, set: { title: topic, evidence } }).returning();
    await audit(u.id, "opportunity.manual", "opportunity", opp.id);
    if (!run) return { ok: true, message: "Đã lưu brief vào danh sách cơ hội", redirect: `/admin/seo/outline?opp=${opp.id}` };
    if (opp.draftArticleId) return { ok: true, message: "Cơ hội này đã có bản nháp", redirect: `/admin/content/${opp.draftArticleId}` };
    const { job, created } = await enqueue("write_draft", { opportunityId: opp.id }, opp.id, u.id);
    if (created) after(() => runJob(job.id));
    return { ok: true, message: created ? "Đã gửi AI lập đề cương + bản nháp. Tải lại sau ít phút." : `Tác vụ đã tồn tại (${job.status})`, redirect: `/admin/seo/outline?opp=${opp.id}&job=${job.id}` };
  });
}

// ───────── 040 Kiểm tra chuyển hướng trước khi lưu ─────────
export type RedirectCheck = { ok: boolean; message: string; exists: boolean | null; loop: boolean; chain: boolean; final: string };
const STATIC = ["/", "/thiet-bi", "/goc-livestream", "/kien-thuc", "/tin-tuc", "/ho-tro", "/lien-he", "/tuyen-dung", "/ve-hulako", "/chon-den", "/tim-kiem"];
export async function checkRedirect(fd: FormData): Promise<RedirectCheck> {
  try {
    await requireUser("seo.view");
    const from = str(fd, "fromPath"), to = str(fd, "toPath");
    if (!from.startsWith("/") || !to.startsWith("/")) return { ok: false, message: "Đường dẫn phải bắt đầu bằng /", exists: null, loop: false, chain: false, final: to };
    const db = await getDb();
    const all = await db.select().from(schema.redirects);
    const map = new Map(all.map((r) => [r.fromPath, r.toPath]));
    let final = to, hops = 0, loop = from === to;
    while (map.has(final) && hops < 10) { final = map.get(final)!; hops++; if (final === from) { loop = true; break; } }
    const chain = hops > 0 || all.some((r) => r.toPath === from);
    const path = final.split(/[?#]/)[0].replace(/\/$/, "") || "/";
    let exists: boolean | null = STATIC.includes(path);
    const m = path.match(/^\/(kien-thuc|tin-tuc|thiet-bi|goc-livestream|tuyen-dung)\/([^/]+)$/);
    if (!exists && m) {
      const [, base, slug] = m;
      const q = base === "kien-thuc" || base === "tin-tuc"
        ? db.select({ id: schema.articles.id }).from(schema.articles).where(and(eq(schema.articles.kind, base === "tin-tuc" ? "news" : "guide"), eq(schema.articles.slug, slug), sql`${schema.articles.publishedRevisionId} is not null`))
        : base === "thiet-bi" ? db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.slug, slug), inArray(schema.products.status, ["public", "paused"])))
        : base === "goc-livestream" ? db.select({ id: schema.setups.id }).from(schema.setups).where(and(eq(schema.setups.slug, slug), eq(schema.setups.status, "public")))
        : db.select({ id: schema.jobs.id }).from(schema.jobs).where(and(eq(schema.jobs.slug, slug), ne(schema.jobs.status, "draft")));
      exists = (await q).length > 0;
    } else if (!exists && /^\/kien-thuc\/chu-de\/[^/]+$/.test(path)) {
      exists = (await db.select({ id: schema.topics.id }).from(schema.topics).where(eq(schema.topics.slug, path.split("/").pop()!))).length > 0;
    } else if (!exists) exists = null; // đường dẫn ngoài danh mục đã biết → không xác định
    const msg = loop ? "Tạo vòng lặp chuyển hướng — không thể lưu"
      : exists === false ? "Trang đích chưa công khai hoặc không tồn tại"
      : chain ? `Có chuỗi chuyển hướng — khi lưu sẽ trỏ thẳng tới ${final}` : "Đường dẫn hợp lệ";
    return { ok: !loop && exists !== false, message: msg, exists, loop, chain, final };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, message: "Không kiểm tra được (thiếu quyền hoặc lỗi máy chủ)", exists: null, loop: false, chain: false, final: "" };
  }
}

// ───────── 057 Lịch tự động AI SEO ─────────
export async function saveSchedule(fd: FormData) {
  return adminAction("settings.edit", async (u) => {
    const cur = await getAdminSetting("admin.schedule");
    const key = str(fd, "key");
    const type = str(fd, "type") as JobType;
    if (!(type in JOB_TYPES)) throw new UserError("Loại tác vụ không hợp lệ");
    const freq = (["daily", "weekly", "monthly"].includes(str(fd, "frequency")) ? str(fd, "frequency") : "weekly") as ScheduleItem["frequency"];
    const hour = /^\d{2}:\d{2}$/.test(str(fd, "hour")) ? str(fd, "hour") : "03:00";
    const item: ScheduleItem = {
      key: key || `s${Date.now().toString(36)}`, name: str(fd, "name") || JOB_TYPES[type], type, source: str(fd, "source") || "gsc", frequency: freq,
      weekday: Math.min(7, Math.max(1, num(fd, "weekday", 1))), monthDay: Math.min(28, Math.max(1, num(fd, "monthDay", 1))), hour, enabled: fd.get("enabled") === "on",
    };
    const items = cur.items.some((i) => i.key === item.key) ? cur.items.map((i) => (i.key === item.key ? item : i)) : [...cur.items, item];
    const maxRuns = str(fd, "maxRunsPerDay"), maxBudget = str(fd, "maxBudgetUsd");
    const next = { items, maxRunsPerDay: maxRuns ? Math.max(0, Number(maxRuns) || 0) : null, maxBudgetUsd: maxBudget ? Math.max(0, Number(maxBudget) || 0) : null };
    await setAdminSetting("admin.schedule", next);
    // Công tắc "Tạm dừng toàn bộ" dùng chung cấu hình agent mà cron đang đọc
    if (fd.has("pausedAll")) {
      const agent = await getSetting("agent");
      await setSetting("agent", { ...agent, paused: fd.get("pausedAll") === "1" });
    }
    await audit(u.id, "settings.schedule", "settings", "admin.schedule", { key: item.key, type, enabled: item.enabled, frequency: freq });
    return { ok: true, message: "Đã lưu cấu hình lịch", redirect: `/admin/seo/schedule?key=${item.key}` };
  });
}

// ───────── 068 Thông báo nội bộ ─────────
export async function saveNotify(fd: FormData) {
  return adminAction("settings.edit", async (u) => {
    const emails = str(fd, "emails").split(/[,\s;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const e of emails) if (!/^\S+@\S+\.\S+$/.test(e)) throw new UserError(`Email không hợp lệ: ${e}`);
    const chat = str(fd, "telegramChatId");
    if (chat && !/^-?\d{4,20}$|^@[\w]{4,}$/.test(chat)) throw new UserError("Chat ID Telegram chỉ gồm số (vd -1001234567890) hoặc @tenkenh");
    const next = {
      events: { lead: fd.get("ev_lead") === "on", application: fd.get("ev_application") === "on", review: fd.get("ev_review") === "on", aiFailed: fd.get("ev_aiFailed") === "on", seoReport: fd.get("ev_seoReport") === "on" },
      emails: emails.slice(0, 10), telegramChatId: chat,
    };
    await setAdminSetting("admin.notify", next);
    await audit(u.id, "settings.notify", "settings", "admin.notify", { events: next.events, recipients: next.emails.length, telegram: !!chat });
    return { ok: true, message: "Đã lưu cấu hình thông báo" };
  });
}

export async function testNotify() {
  return adminAction("settings.edit", async () => {
    const cfg = await getAdminSetting("admin.notify");
    const results: string[] = [];
    const key = process.env.RESEND_API_KEY;
    const to = cfg.emails.length ? cfg.emails : (process.env.NOTIFY_EMAIL_TO ?? "").split(",").filter(Boolean);
    if (key && to.length) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.NOTIFY_EMAIL_FROM ?? "HULAKO Website <onboarding@resend.dev>", to, subject: "[HULAKO] Thử thông báo nội bộ", text: "Đây là email gửi thử từ trang quản trị HULAKO." }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      results.push(r?.ok ? `Email: đã gửi tới ${to.length} người nhận` : `Email: gửi lỗi${r ? ` (${r.status})` : ""}`);
    } else results.push(key ? "Email: chưa có người nhận" : "Email: chưa cấu hình RESEND_API_KEY");
    const token = process.env.TELEGRAM_BOT_TOKEN, chat = cfg.telegramChatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (token && chat) {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: "✅ Thử thông báo nội bộ từ quản trị HULAKO" }), signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      results.push(r?.ok ? "Telegram: đã gửi" : `Telegram: gửi lỗi${r ? ` (${r.status})` : ""}`);
    } else results.push(token ? "Telegram: chưa có chat ID" : "Telegram: chưa cấu hình TELEGRAM_BOT_TOKEN");
    const ok = results.some((r) => r.includes("đã gửi"));
    return { ok, message: results.join(" · ") };
  });
}

// ───────── 032/051 Quản trị tạo link đặt lại mật khẩu cho người dùng ─────────
export async function createResetLink(fd: FormData) {
  return adminAction("users.manage", async (u) => {
    const db = await getDb();
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, str(fd, "id")));
    if (!target) throw new UserError("Không tìm thấy tài khoản");
    if (target.status !== "active") throw new UserError("Tài khoản đang bị khoá — mở khoá trước");
    const link = resetLink(await createResetToken(target));
    await audit(u.id, "user.reset_link", "user", target.id);
    return { ok: true, message: `Link đặt lại mật khẩu (hiệu lực ${RESET_TTL_MIN} phút, dùng 1 lần) — gửi riêng cho người dùng: ${link}` };
  });
}

// ───────── 034 Kiểm tra kết nối Search Console (không trả bí mật) ─────────
export async function testGscConnection() {
  return adminAction("seo.view", async () => {
    if (!gscConfigured()) return { ok: false, message: "Chưa cấu hình GSC_SITE_URL, GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY trên máy chủ" };
    try {
      const token = await accessToken();
      const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(process.env.GSC_SITE_URL!)}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
      });
      if (res.status === 403) return { ok: false, message: "Đăng nhập được nhưng chưa có quyền với website — thêm email service account vào Search Console" };
      if (!res.ok) return { ok: false, message: `Search Console trả lỗi ${res.status}` };
      return { ok: true, message: "Kết nối Search Console hoạt động" };
    } catch (e) {
      return { ok: false, message: (e as Error).message.slice(0, 200) };
    }
  });
}

// Gửi ngay báo cáo AI SEO qua Telegram (cùng nội dung báo cáo hằng ngày) — để chủ website xem thử bất cứ lúc nào
export async function sendSeoReportNow(_fd?: FormData) {
  return adminAction("seo.view", async (u) => {
    if (!process.env.TELEGRAM_BOT_TOKEN) throw new UserError("Chưa cấu hình bot Telegram (TELEGRAM_BOT_TOKEN)");
    const { buildSeoReport } = await import("@/lib/seo/report");
    const { esc } = await import("@/lib/notify");
    const text = await buildSeoReport("daily", [`<i>Gửi theo yêu cầu từ quản trị (${esc(u.name || u.email)})</i>`]);
    const cfg = await getAdminSetting("admin.notify");
    const chat = cfg.telegramChatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!chat) throw new UserError("Chưa có chat Telegram nhận tin");
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }), signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!r?.ok) throw new UserError(`Telegram gửi lỗi${r ? ` (${r.status})` : ""}`);
    await audit(u.id, "notify.seo_report", "settings", "admin.notify");
    return { ok: true, message: "Đã gửi báo cáo AI SEO về Telegram" };
  });
}
