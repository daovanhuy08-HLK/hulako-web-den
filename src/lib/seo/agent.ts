// Phía WEBSITE của SEO Agent chạy trên máy (tools/seo-agent.mjs). Agent gọi /api/agent/* bằng RUNNER_TOKEN.
//
//   Agent trên máy (Claude CLI có tìm kiếm web)            Website (Vercel + Neon)
//   ─────────────────────────────────────────────           ───────────────────────────────────────────
//   R&D từ khoá 7 nhóm + Google Trends + gợi ý tìm kiếm  ──► keywords (kind, note, trendScore)
//   Decode cấu trúc bài top cho từ khoá                   ──► serp_snapshots (chỉ cấu trúc, không chép nội dung)
//   Theo dõi sitemap đối thủ, trang mới/sửa               ──► competitors / competitor_pages / agent_insights(spy)
//   Kế hoạch 5–20 bài/ngày                                ──► opportunities + giao runner viết N bản nháp (CHỜ DUYỆT)
//   Tới giờ báo cáo                                       ──► Telegram (bot của chủ website)
//
// AI không tự xuất bản. Mọi bài vào trạng thái nháp để người duyệt kiểm và đăng.
import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { getSetting, setSetting, SITE_URL } from "../settings";
import { BRAND_SYSTEM } from "../ai/prompts";
import { GUARDRAIL_TEXT } from "../guardrails";
import { normalizeVi, slugify } from "../text";
import { enqueue, runJob } from "../ai/jobs";
import { esc, notifyAdmin, siteUrl } from "../notify";

export const KEYWORD_KINDS = {
  "sieu-rong": "Siêu rộng (ra khách nhưng không nói thẳng về sản phẩm)",
  dai: "Từ khoá dài",
  nganh: "Từ khoá ngành",
  "san-pham": "Từ khoá sản phẩm",
  ngan: "Từ khoá ngắn",
  "dia-ly": "Từ khoá địa lý",
  trend: "Xu hướng 24–72h",
} as const;
export type KeywordKind = keyof typeof KEYWORD_KINDS;
const KIND_ICON: Record<string, string> = { "sieu-rong": "🌐", dai: "🧵", nganh: "🏭", "san-pham": "💡", ngan: "🔤", "dia-ly": "📍", trend: "🔥" };

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // ngày theo giờ VN
const ourHost = () => new URL(SITE_URL).host.replace(/^www\./, "");
export const domainOf = (u: string) => { try { return new URL(u).host.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

/** Ghi nhận agent còn sống + kết quả lần chạy của một việc */
export async function agentHeartbeat(host: string, job?: { name: string; ok: boolean; note: string }) {
  const st = await getSetting("seoAgentStatus");
  const next = { ...st, lastSeen: new Date().toISOString(), host: host.slice(0, 80) };
  if (job) next.jobs = { ...st.jobs, [job.name.slice(0, 40)]: { at: new Date().toISOString(), ok: job.ok, note: job.note.slice(0, 300) } };
  await setSetting("seoAgentStatus", next);
}

/** Agent hỏi mỗi phút: cấu hình + lệnh "chạy ngay" (đọc xong thì xoá) — nhẹ, không tải dữ liệu lớn */
export async function agentPoll() {
  const [config, cmds] = await Promise.all([getSetting("seoAgent"), getSetting("seoAgentCommands")]);
  if (cmds.pending.length) await setSetting("seoAgentCommands", { pending: [] });
  return { ok: true, config, commands: cmds.pending };
}

/** Bối cảnh cho agent: cấu hình, DNA thương hiệu, từ khoá/bài đã có, số liệu Google, đối thủ, lệnh "chạy ngay" đang chờ */
export async function agentContext() {
  const db = await getDb();
  const [config, insights, kws, arts, gsc, comps] = await Promise.all([
    getSetting("seoAgent"),
    db.select({ kind: schema.agentInsights.kind, day: schema.agentInsights.day, title: schema.agentInsights.title, data: schema.agentInsights.data })
      .from(schema.agentInsights).where(and(inArray(schema.agentInsights.kind, ["trend", "spy"]), gte(schema.agentInsights.createdAt, new Date(Date.now() - 3 * 86400_000))))
      .orderBy(desc(schema.agentInsights.createdAt)).limit(6),
    db.select({ q: schema.keywords.query, kind: schema.keywords.kind, status: schema.keywords.status, pos: schema.keywords.position })
      .from(schema.keywords).orderBy(desc(schema.keywords.createdAt)).limit(1500),
    db.select({ title: schema.revisions.title, slug: schema.articles.slug, kind: schema.articles.kind, kw: schema.articles.targetKeyword, status: schema.articles.status, published: isNotNull(schema.articles.publishedRevisionId) })
      .from(schema.articles).leftJoin(schema.revisions, eq(schema.revisions.id, sql`coalesce(${schema.articles.publishedRevisionId}, ${schema.articles.draftRevisionId})`)).limit(500),
    db.select({
      query: schema.gscMetrics.query,
      impressions: sql<number>`sum(${schema.gscMetrics.impressions})::int`, clicks: sql<number>`sum(${schema.gscMetrics.clicks})::int`,
      pos: sql<number>`sum(${schema.gscMetrics.position} * ${schema.gscMetrics.impressions}) / nullif(sum(${schema.gscMetrics.impressions}),0)`,
    }).from(schema.gscMetrics).where(gte(schema.gscMetrics.date, new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10)))
      .groupBy(schema.gscMetrics.query).orderBy(desc(sql`sum(${schema.gscMetrics.impressions})`)).limit(150),
    db.select({ domain: schema.competitors.domain, name: schema.competitors.name, status: schema.competitors.status, pageCount: schema.competitors.pageCount })
      .from(schema.competitors).where(inArray(schema.competitors.status, ["active", "suggested"])),
  ]);
  return {
    site: SITE_URL, host: ourHost(), today: today(), config,
    recentInsights: insights.map((i) => ({ kind: i.kind, day: i.day, title: i.title, data: JSON.stringify(i.data).slice(0, 3000) })),
    brand: BRAND_SYSTEM, guardrails: GUARDRAIL_TEXT, kinds: KEYWORD_KINDS,
    keywords: kws.map((k) => ({ q: k.q, kind: k.kind, status: k.status, pos: k.pos })),
    articles: arts.map((a) => ({ title: a.title, url: `/${a.kind === "news" ? "tin-tuc" : "kien-thuc"}/${a.slug}`, keyword: a.kw, status: a.status, published: a.published })),
    gsc: gsc.map((g) => ({ query: g.query, impressions: Number(g.impressions), clicks: Number(g.clicks), pos: g.pos == null ? null : Math.round(Number(g.pos) * 10) / 10 })),
    competitors: comps,
  };
}

export type AgentKeyword = { query: string; kind?: string; intent?: string; cluster?: string; trendScore?: number | null; note?: string };

/** Lưu từ khoá agent nghiên cứu. Từ khoá đã có thì chỉ bổ sung nhóm/ghi chú/điểm xu hướng còn trống. */
export async function saveKeywords(items: AgentKeyword[], source: string) {
  const db = await getDb();
  let added = 0, updated = 0;
  for (const k of items.slice(0, 300)) {
    const query = String(k.query ?? "").trim().slice(0, 200);
    const normalized = normalizeVi(query);
    if (!normalized || normalized.length < 3) continue;
    const kind = k.kind && k.kind in KEYWORD_KINDS ? k.kind : "";
    const values = {
      query, normalized, variantsSeen: [query], source: source.slice(0, 40), kind, intent: String(k.intent ?? "").slice(0, 30),
      cluster: slugify(String(k.cluster ?? "")).slice(0, 60), note: String(k.note ?? "").slice(0, 400),
      trendScore: typeof k.trendScore === "number" ? Math.max(0, Math.min(100, k.trendScore)) : null,
    };
    const ins = await db.insert(schema.keywords).values(values).onConflictDoNothing({ target: schema.keywords.normalized }).returning({ id: schema.keywords.id });
    if (ins.length) { added++; continue; }
    const set: Record<string, unknown> = {};
    if (kind) set.kind = sql`case when ${schema.keywords.kind} = '' then ${kind} else ${schema.keywords.kind} end`;
    if (values.note) set.note = sql`case when ${schema.keywords.note} = '' then ${values.note} else ${schema.keywords.note} end`;
    if (values.trendScore != null) set.trendScore = values.trendScore; // xu hướng luôn lấy số mới nhất
    if (Object.keys(set).length) { await db.update(schema.keywords).set(set).where(eq(schema.keywords.normalized, normalized)); updated++; }
  }
  return { added, updated };
}

/** Lưu kết quả tìm kiếm + cấu trúc decode cho 1 từ khoá; tự ghi nhận tên miền hay xuất hiện thành đối thủ gợi ý */
export async function saveSerp(input: { keyword: string; results: { url: string; title: string }[]; decode: Record<string, unknown> }) {
  const db = await getDb();
  const host = ourHost();
  const results = input.results.slice(0, 10).map((r, i) => ({ position: i + 1, url: String(r.url).slice(0, 500), title: String(r.title ?? "").slice(0, 200), domain: domainOf(r.url) }));
  const our = results.find((r) => r.domain === host);
  const [row] = await db.insert(schema.serpSnapshots).values({
    keyword: input.keyword.slice(0, 200), normalized: normalizeVi(input.keyword), results, ourPosition: our?.position ?? null, decode: input.decode ?? {},
  }).returning({ id: schema.serpSnapshots.id });
  // Sàn TMĐT, mạng xã hội, báo lớn không tính là đối thủ nội dung
  const SKIP = /(shopee|lazada|tiki|tiktok|facebook|youtube|google|wikipedia|amazon|vnexpress|dantri|zingnews|kenh14|24h\.com|cellphones|thegioididong|dienmayxanh|fptshop|sendo|chotot|pinterest|instagram|reddit|quora)/;
  for (const r of results) {
    if (!r.domain || r.domain === host || SKIP.test(r.domain)) continue;
    await db.insert(schema.competitors).values({ domain: r.domain, status: "suggested", discoveredBy: "agent", seenInSerp: 1 })
      .onConflictDoUpdate({ target: schema.competitors.domain, set: { seenInSerp: sql`${schema.competitors.seenInSerp} + 1` } });
  }
  return { id: row.id, ourPosition: our?.position ?? null };
}

/**
 * So danh sách URL trong sitemap đối thủ với lần trước. Lần đầu: chỉ lưu làm mốc (không báo).
 * Trả về các URL MỚI hoặc có lastmod đổi để agent đọc kỹ.
 */
export async function diffCompetitorUrls(domain: string, urls: { url: string; lastmod?: string | null }[]) {
  const db = await getDb();
  const [c] = await db.select().from(schema.competitors).where(eq(schema.competitors.domain, domain));
  if (!c || c.status !== "active") return { baseline: false, changed: [] as string[], note: "Đối thủ chưa bật theo dõi" };
  const list = urls.filter((u) => domainOf(u.url) === domain).slice(0, 5000);
  const known = await db.select({ url: schema.competitorPages.url, lastmod: schema.competitorPages.lastmod }).from(schema.competitorPages).where(eq(schema.competitorPages.competitorId, c.id));
  const map = new Map(known.map((k) => [k.url, k.lastmod]));
  if (!known.length) {
    for (let i = 0; i < list.length; i += 500) {
      await db.insert(schema.competitorPages).values(list.slice(i, i + 500).map((u) => ({ competitorId: c.id, url: u.url.slice(0, 500), lastmod: u.lastmod ?? null, state: "seen" })))
        .onConflictDoNothing({ target: schema.competitorPages.url });
    }
    await db.update(schema.competitors).set({ pageCount: list.length, lastCrawledAt: new Date(), lastError: null }).where(eq(schema.competitors.id, c.id));
    return { baseline: true, changed: [] as string[], note: `Lưu mốc ${list.length} URL` };
  }
  const changed = list.filter((u) => !map.has(u.url) || (u.lastmod && map.get(u.url) !== u.lastmod)).map((u) => u.url);
  await db.update(schema.competitors).set({ pageCount: Math.max(list.length, known.length), lastCrawledAt: new Date(), lastError: null }).where(eq(schema.competitors.id, c.id));
  return { baseline: false, changed: changed.slice(0, 40), note: `${changed.length} URL mới/sửa` };
}

export async function saveCompetitorPages(domain: string, pages: { url: string; title: string; lastmod?: string | null; hash?: string; wordCount?: number; headings?: string[] }[]) {
  const db = await getDb();
  const [c] = await db.select().from(schema.competitors).where(eq(schema.competitors.domain, domain));
  if (!c) return { saved: 0 };
  let saved = 0;
  for (const p of pages.slice(0, 40)) {
    const [old] = await db.select().from(schema.competitorPages).where(eq(schema.competitorPages.url, p.url));
    const values = { title: String(p.title ?? "").slice(0, 300), lastmod: p.lastmod ?? null, hash: p.hash ?? null, wordCount: p.wordCount ?? null, headings: (p.headings ?? []).slice(0, 40).map((h) => String(h).slice(0, 200)) };
    if (!old) await db.insert(schema.competitorPages).values({ competitorId: c.id, url: p.url.slice(0, 500), ...values, state: "new", changedAt: new Date() }).onConflictDoNothing();
    else await db.update(schema.competitorPages).set({ ...values, state: old.hash && p.hash && old.hash !== p.hash ? "updated" : old.state === "new" ? "new" : "seen", changedAt: old.hash !== p.hash ? new Date() : old.changedAt }).where(eq(schema.competitorPages.id, old.id));
    saved++;
  }
  return { saved };
}

export async function markCompetitorError(domain: string, error: string) {
  const db = await getDb();
  await db.update(schema.competitors).set({ lastError: error.slice(0, 300), lastCrawledAt: new Date() }).where(eq(schema.competitors.domain, domain));
}

export async function saveInsight(kind: string, title: string, data: Record<string, unknown>, sendHtml?: string) {
  const db = await getDb();
  const [row] = await db.insert(schema.agentInsights).values({ kind: kind.slice(0, 20), day: today(), title: title.slice(0, 200), data }).returning({ id: schema.agentInsights.id });
  let sent: string | null = null;
  if (sendHtml) {
    sent = await notifyAdmin("seoReport", sendHtml);
    if (sent === "sent") await db.update(schema.agentInsights).set({ sentAt: new Date() }).where(eq(schema.agentInsights.id, row.id));
  }
  return { id: row.id, sent };
}

export type Proposal = {
  keyword: string; kind: string; title: string; angle: string; why: string; priority: number;
  type?: "new" | "update"; updateUrl?: string; decode?: Record<string, unknown> | null; competitorUrls?: string[];
};

/**
 * Kế hoạch bài viết hằng ngày: tạo/cập nhật cơ hội cho từng đề xuất, giao runner viết bản nháp cho N bài ưu tiên cao nhất
 * (theo cấu trúc decode, nội dung mới), rồi gửi Telegram danh sách việc trong ngày.
 */
export async function createDailyPlan(proposals: Proposal[], summary: string) {
  const db = await getDb();
  const cfg = await getSetting("seoAgent");
  const day = today();
  const list = proposals.filter((p) => p.keyword && p.title).sort((a, b) => b.priority - a.priority).slice(0, Math.max(1, cfg.proposalsMax));
  const created: { id: string; title: string; keyword: string; kind: string; why: string; type: string; priority: number; writing: boolean }[] = [];
  await saveKeywords(list.map((p) => ({ query: p.keyword, kind: p.kind, note: p.why })), "agent_research");

  // bài đã có nháp AI hôm nay (kể cả lần chạy trước) → không vượt hạn mức viết/ngày
  const [{ n: writtenToday }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.aiJobs)
    .where(and(eq(schema.aiJobs.type, "write_draft"), eq(schema.aiJobs.createdBy, "agent"), gte(schema.aiJobs.createdAt, new Date(`${day}T00:00:00+07:00`))));
  let quota = Math.max(0, cfg.autoWritePerDay - Number(writtenToday));

  for (const p of list) {
    const normalized = normalizeVi(p.keyword);
    const [kw] = await db.select({ id: schema.keywords.id, status: schema.keywords.status }).from(schema.keywords).where(eq(schema.keywords.normalized, normalized));
    let targetArticleId: string | null = null;
    if (p.type === "update" && p.updateUrl) {
      const slug = p.updateUrl.split("/").filter(Boolean).pop() ?? "";
      const [a] = await db.select({ id: schema.articles.id }).from(schema.articles).where(eq(schema.articles.slug, slug));
      targetArticleId = a?.id ?? null;
    }
    const type = targetArticleId ? "update" : "new";
    const evidence = { source: "seo-agent", day, kind: p.kind, why: p.why, angle: p.angle, serpStructure: p.decode ?? null, competitorUrls: p.competitorUrls ?? [] };
    const [opp] = await db.insert(schema.opportunities).values({
      type, title: `${type === "update" ? "Cập nhật" : "Viết mới"}: ${p.title}`.slice(0, 200), keywordIds: kw ? [kw.id] : [], targetArticleId,
      competingUrls: (p.competitorUrls ?? []).slice(0, 10), score: Math.max(0, Math.min(100, p.priority)), rationale: `${p.why}\nGóc viết: ${p.angle}`.slice(0, 1000),
      evidence, factors: {}, dedupeKey: `agent:${type}:${normalized}`,
    }).onConflictDoUpdate({
      target: schema.opportunities.dedupeKey,
      set: { score: Math.max(0, Math.min(100, p.priority)), rationale: `${p.why}\nGóc viết: ${p.angle}`.slice(0, 1000), evidence },
      setWhere: eq(schema.opportunities.status, "open"),
    }).returning({ id: schema.opportunities.id, status: schema.opportunities.status });
    if (!opp) continue; // cơ hội này đã viết rồi
    let writing = false;
    if (quota > 0 && opp.status === "open") {
      const { job, created: isNew } = await enqueue("write_draft", { opportunityId: opp.id }, `agent:${opp.id}`, "agent");
      if (isNew) { quota--; writing = true; await runJob(job.id).catch(() => null); } // bước cần AI → chuyển sang hàng chờ runner trên máy
    }
    created.push({ id: opp.id, title: p.title, keyword: p.keyword, kind: p.kind, why: p.why, type, priority: p.priority, writing });
  }

  const site = siteUrl();
  const lines = [
    `☀️ <b>Đề xuất công việc SEO hôm nay — ${day.split("-").reverse().join("/")}</b>`,
    summary ? esc(summary.slice(0, 600)) : "",
    "",
    `<b>${created.length} bài nên viết/cập nhật</b> (✍️ = AI đang viết nháp theo cấu trúc bài top, nội dung mới):`,
    ...created.map((c, i) => `${i + 1}. ${c.writing ? "✍️ " : ""}${KIND_ICON[c.kind] ?? "•"} <b>${esc(c.title)}</b>\n   🔑 ${esc(c.keyword)} · ${c.type === "update" ? "cập nhật bài cũ" : "bài mới"} · ưu tiên ${Math.round(c.priority)}\n   ↳ ${esc(c.why.slice(0, 160))}`),
    "",
    "<b>Việc của bạn hôm nay</b>",
    "1. Duyệt các bản nháp AI viết xong (bot sẽ báo từng bài).",
    "2. Bài còn lại: bấm “Viết bài” trong AI SEO nếu muốn AI viết thêm.",
    `👉 <a href="${site}/admin/seo/agent">Mở Agent SEO</a> · <a href="${site}/admin/content">Duyệt bài</a>`,
  ].filter((x, k, arr) => x !== "" || arr[k - 1] !== "");
  const ins = await saveInsight("plan", `Kế hoạch ${created.length} bài`, { summary, items: created }, lines.join("\n"));
  return { created: created.length, writing: created.filter((c) => c.writing).length, sent: ins.sent };
}

/** Phần "thứ hạng & tối ưu" của báo cáo: số liệu Search Console + vị trí agent thấy khi decode (tham khảo) */
export async function buildRankSection() {
  const db = await getDb();
  const d = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
  const agg = (from: number, to: number) => db.select({
    query: schema.gscMetrics.query,
    impressions: sql<number>`sum(${schema.gscMetrics.impressions})::int`, clicks: sql<number>`sum(${schema.gscMetrics.clicks})::int`,
    pos: sql<number>`sum(${schema.gscMetrics.position} * ${schema.gscMetrics.impressions}) / nullif(sum(${schema.gscMetrics.impressions}),0)`,
  }).from(schema.gscMetrics).where(and(gte(schema.gscMetrics.date, d(from)), sql`${schema.gscMetrics.date} < ${d(to)}`)).groupBy(schema.gscMetrics.query);
  const [cur, prev, serps] = await Promise.all([
    agg(10, 3), agg(17, 10),
    db.select({ keyword: schema.serpSnapshots.keyword, our: schema.serpSnapshots.ourPosition, at: schema.serpSnapshots.createdAt })
      .from(schema.serpSnapshots).where(gte(schema.serpSnapshots.createdAt, new Date(Date.now() - 7 * 86400_000))).orderBy(desc(schema.serpSnapshots.createdAt)).limit(60),
  ]);
  const prevMap = new Map(prev.map((p) => [p.query, Number(p.pos)]));
  const rows = cur.filter((c) => c.pos != null).map((c) => ({ q: c.query, impr: Number(c.impressions), clicks: Number(c.clicks), pos: Number(c.pos), before: prevMap.get(c.query) ?? null }));
  const lines: string[] = ["<b>📈 Thứ hạng từ khoá (Google Search Console, 7 ngày)</b>"];
  if (!rows.length) lines.push("Chưa có từ khoá nào có lượt hiển thị — Google cần thêm thời gian, hoặc Search Console chưa kết nối.");
  else {
    const top = [...rows].sort((a, b) => b.impr - a.impr).slice(0, 8);
    lines.push(...top.map((r) => `• ${esc(r.q)} — hạng <b>${r.pos.toFixed(1)}</b>${r.before != null ? ` (${r.pos <= r.before ? "▲" : "▼"} từ ${r.before.toFixed(1)})` : " 🆕"} · ${r.impr} hiển thị, ${r.clicks} nhấp`));
    const up = rows.filter((r) => r.before != null && r.before - r.pos >= 3).sort((a, b) => (b.before! - b.pos) - (a.before! - a.pos)).slice(0, 3);
    const down = rows.filter((r) => r.before != null && r.pos - r.before >= 3).sort((a, b) => (b.pos - b.before!) - (a.pos - a.before!)).slice(0, 3);
    if (up.length) lines.push(`🚀 Tăng mạnh: ${up.map((r) => `${esc(r.q)} (${r.before!.toFixed(0)}→${r.pos.toFixed(0)})`).join(", ")}`);
    if (down.length) lines.push(`⚠️ Tụt: ${down.map((r) => `${esc(r.q)} (${r.before!.toFixed(0)}→${r.pos.toFixed(0)})`).join(", ")}`);
    lines.push("", "<b>🛠 Tối ưu đề xuất</b>");
    const near = rows.filter((r) => r.pos > 7 && r.pos <= 20 && r.impr >= 10).sort((a, b) => b.impr - a.impr).slice(0, 3);
    const lowCtr = rows.filter((r) => r.pos <= 10 && r.impr >= 50 && r.clicks / r.impr < 0.02).sort((a, b) => b.impr - a.impr).slice(0, 3);
    if (near.length) lines.push(`• Sắp vào top 1 trang — bổ sung nội dung, thêm liên kết nội bộ: ${near.map((r) => `${esc(r.q)} (hạng ${r.pos.toFixed(0)})`).join(", ")}`);
    if (lowCtr.length) lines.push(`• Hiển thị nhiều nhưng ít nhấp — viết lại tiêu đề/mô tả: ${lowCtr.map((r) => esc(r.q)).join(", ")}`);
    if (!near.length && !lowCtr.length) lines.push("• Chưa có từ khoá nào cần tối ưu gấp.");
  }
  const seen = new Map<string, number | null>();
  for (const s of serps) if (!seen.has(s.keyword)) seen.set(s.keyword, s.our);
  if (seen.size) {
    const inTop = [...seen.entries()].filter(([, p]) => p != null);
    lines.push("", `<b>🔎 Agent kiểm tra ${seen.size} từ khoá trên web (tham khảo)</b>`,
      inTop.length ? inTop.slice(0, 6).map(([k, p]) => `• ${esc(k)}: website đang ở vị trí ${p}`).join("\n") : "• Website chưa xuất hiện trong top 10 các từ khoá này — đúng mục tiêu cần viết bài.");
  }
  return lines.join("\n");
}

// ───────────── Bot Telegram hai chiều (tools/telegram-bot.mjs) ─────────────
/** Trạng thái tổng quát cho lệnh /trangthai và để bot biết lệnh đã chạy xong chưa */
export async function agentStatusSummary() {
  const db = await getDb();
  const [cfg, st, runner, cmds, [q], [drafts]] = await Promise.all([
    getSetting("seoAgent"), getSetting("seoAgentStatus"), getSetting("runnerStatus"), getSetting("seoAgentCommands"),
    db.select({ waiting: sql<number>`count(*) filter (where ${schema.aiJobs.status} in ('waiting_runner','runner_running','queued'))::int`, failed: sql<number>`count(*) filter (where ${schema.aiJobs.status} = 'failed' and ${schema.aiJobs.createdAt} > now() - interval '3 days')::int` }).from(schema.aiJobs),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.articles).where(inArray(schema.articles.status, ["draft", "review"])),
  ]);
  return { config: cfg, agent: st, runner, pendingCommands: cmds.pending, queue: { waiting: Number(q?.waiting ?? 0), failed: Number(q?.failed ?? 0) }, draftsToReview: Number(drafts?.n ?? 0) };
}

/** Lệnh "chạy ngay" từ bot (cùng hàng lệnh với nút trên trang quản trị) */
export async function queueAgentCommand(job: string, by: string) {
  const cmds = await getSetting("seoAgentCommands");
  if (!cmds.pending.some((c) => c.job === job)) cmds.pending.push({ job, at: new Date().toISOString(), by: by.slice(0, 60) });
  await setSetting("seoAgentCommands", { pending: cmds.pending.slice(-10) });
  return { queued: true, at: new Date().toISOString() };
}

/** /viet <từ khoá>: tạo cơ hội + giao runner viết bản nháp ngay (không tính hạn mức tự động/ngày vì chủ website ra lệnh) */
export async function writeForKeyword(keyword: string, title?: string) {
  const db = await getDb();
  const kw = keyword.trim().slice(0, 200);
  const normalized = normalizeVi(kw);
  if (normalized.length < 3) throw new Error("Từ khoá quá ngắn");
  await saveKeywords([{ query: kw, note: "Chủ website yêu cầu qua Telegram" }], "telegram");
  const [k] = await db.select({ id: schema.keywords.id }).from(schema.keywords).where(eq(schema.keywords.normalized, normalized));
  const [opp] = await db.insert(schema.opportunities).values({
    type: "new", title: `Viết mới: ${(title || kw).slice(0, 180)}`, keywordIds: k ? [k.id] : [], score: 90,
    rationale: "Chủ website yêu cầu viết qua bot Telegram", evidence: { source: "telegram", keyword: kw }, factors: {}, dedupeKey: `telegram:new:${normalized}`,
  }).onConflictDoUpdate({ target: schema.opportunities.dedupeKey, set: { score: 90 } })
    .returning({ id: schema.opportunities.id, status: schema.opportunities.status, draftArticleId: schema.opportunities.draftArticleId });
  if (opp.draftArticleId) return { already: true, articleId: opp.draftArticleId };
  const { job, created } = await enqueue("write_draft", { opportunityId: opp.id }, `telegram:${opp.id}`, "agent");
  if (created) await runJob(job.id).catch(() => null);
  return { already: false, jobId: job.id, created };
}
