// Báo cáo AI SEO gửi Telegram (bot của chủ website): hằng ngày (cron daily, gửi im lặng) và hằng tuần (sau vòng SEO thứ Hai).
// Chỉ đọc số liệu đã có — không gọi AI, không tốn hạn mức.
import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { getSetting } from "../settings";
import { gscConfigured } from "./gsc";
import { esc, notifyAdmin, siteUrl } from "../notify";

const DAY = 86400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const n = (x: unknown) => Number(x ?? 0);
const fmt = (x: number) => x.toLocaleString("vi-VN");
const trend = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? " 🆕" : "") : ` (${cur >= prev ? "▲" : "▼"} ${Math.abs(Math.round(((cur - prev) / prev) * 100))}%)`);

async function gscWindow(fromDaysAgo: number, toDaysAgo: number) {
  const db = await getDb();
  const [r] = await db.select({
    clicks: sql<number>`coalesce(sum(${schema.gscMetrics.clicks}),0)::int`,
    impressions: sql<number>`coalesce(sum(${schema.gscMetrics.impressions}),0)::int`,
    pos: sql<number>`case when sum(${schema.gscMetrics.impressions}) > 0 then sum(${schema.gscMetrics.position} * ${schema.gscMetrics.impressions}) / sum(${schema.gscMetrics.impressions}) end`,
  }).from(schema.gscMetrics).where(and(
    gte(schema.gscMetrics.date, ymd(new Date(Date.now() - fromDaysAgo * DAY))),
    lt(schema.gscMetrics.date, ymd(new Date(Date.now() - toDaysAgo * DAY))),
  ));
  return { clicks: n(r?.clicks), impressions: n(r?.impressions), pos: r?.pos == null ? null : Number(r.pos) };
}

export async function buildSeoReport(kind: "daily" | "weekly", extra: string[] = []) {
  const db = await getDb();
  const since7 = new Date(Date.now() - 7 * DAY);
  const [cur, prev, [latest], [lastCollect], idx, [drafts], [openOpp], topOpp, ev, [leads], runner, [waiting], agent] = await Promise.all([
    gscWindow(10, 3), gscWindow(17, 10), // Google trễ ~2–3 ngày: so 7 ngày gần nhất có số liệu với 7 ngày trước đó
    db.select({ d: sql<string>`max(${schema.gscMetrics.date})` }).from(schema.gscMetrics),
    db.select({ status: schema.aiJobs.status, error: schema.aiJobs.error }).from(schema.aiJobs).where(eq(schema.aiJobs.type, "collect_gsc")).orderBy(desc(schema.aiJobs.createdAt)).limit(1),
    db.select({ indexed: sql<number>`count(*) filter (where ${schema.indexStatus.indexedAt} is not null)::int`, total: sql<number>`count(*)::int`, checked: sql<number>`count(*) filter (where ${schema.indexStatus.inspectedAt} is not null)::int` })
      .from(schema.indexStatus).where(eq(schema.indexStatus.removed, false)),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.articles).where(inArray(schema.articles.status, ["draft", "review"])),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.opportunities).where(eq(schema.opportunities.status, "open")),
    db.select({ title: schema.opportunities.title, score: schema.opportunities.score }).from(schema.opportunities).where(eq(schema.opportunities.status, "open")).orderBy(desc(schema.opportunities.score)).limit(3),
    db.select({ type: schema.events.type, c: sql<number>`count(*)::int` }).from(schema.events).where(gte(schema.events.createdAt, since7)).groupBy(schema.events.type),
    db.select({ all: sql<number>`count(*)::int`, gift: sql<number>`count(*) filter (where ${schema.leads.source} = 'lead_magnet')::int` }).from(schema.leads).where(gte(schema.leads.createdAt, since7)),
    getSetting("runnerStatus"),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.aiJobs).where(eq(schema.aiJobs.status, "waiting_runner")),
    getSetting("agent"),
  ]);
  const e = Object.fromEntries(ev.map((x) => [x.type, n(x.c)])) as Record<string, number>;
  const i = idx[0] ?? { indexed: 0, total: 0, checked: 0 };
  const site = siteUrl();
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit" });

  // Google
  let google: string[];
  if (!gscConfigured()) google = ["🔌 Search Console chưa kết nối — chưa có số liệu Google."];
  else if (!latest?.d) google = [lastCollect?.status === "failed" ? `⚠️ Chưa đọc được Search Console: ${esc((lastCollect.error ?? "").slice(0, 160))}` : "⏳ Search Console đã kết nối, Google chưa có số liệu (web mới thường cần vài ngày)."];
  else google = [
    `👁 Lượt hiển thị: <b>${fmt(cur.impressions)}</b>${trend(cur.impressions, prev.impressions)}`,
    `🖱 Lượt nhấp: <b>${fmt(cur.clicks)}</b>${trend(cur.clicks, prev.clicks)}${cur.impressions ? ` · CTR ${((cur.clicks / cur.impressions) * 100).toFixed(1)}%` : ""}`,
    cur.pos != null ? `📍 Vị trí trung bình: <b>${cur.pos.toFixed(1)}</b>${prev.pos != null ? ` (trước ${prev.pos.toFixed(1)})` : ""}` : "",
    `<i>Số liệu tới ngày ${latest.d.split("-").reverse().join("/")}</i>`,
  ];

  const runnerAge = runner.lastSeen ? Math.round((Date.now() - new Date(runner.lastSeen).getTime()) / 60000) : null;
  const runnerLine = runnerAge == null ? "🔴 Runner AI trên máy: chưa từng kết nối"
    : runnerAge < 30 ? `🟢 Runner AI trên máy: đang chạy${n(waiting?.c) ? ` · ${n(waiting?.c)} việc đang chờ` : ""}`
    : `🟠 Runner AI trên máy: im lặng ${runnerAge < 1440 ? `${Math.round(runnerAge / 60)} giờ` : `${Math.round(runnerAge / 1440)} ngày`}${n(waiting?.c) ? ` · ${n(waiting?.c)} việc đang chờ — bật máy để AI làm tiếp` : ""}`;

  return [
    `🤖 <b>${kind === "weekly" ? "Báo cáo AI SEO tuần" : "Báo cáo AI SEO"} — ${today}</b>`,
    agent.paused ? "⏸ AI Agent đang TẠM DỪNG (Quản trị › AI SEO)." : "",
    "",
    "<b>Google (7 ngày)</b>", ...google,
    "",
    "<b>Index</b>",
    !i.total ? "Chưa có bài công khai."
      : !gscConfigured() ? `📤 Đang theo dõi ${fmt(n(i.total))} bài (đã báo IndexNow). Cần Search Console để biết bài nào Google đã index.`
      : `✅ Google đã index <b>${fmt(n(i.indexed))}/${fmt(n(i.total))}</b> bài${n(i.checked) < n(i.total) ? ` (đã kiểm tra ${fmt(n(i.checked))}, còn lại kiểm tra dần mỗi ngày)` : ""}`,
    "",
    "<b>Chuyển đổi (7 ngày)</b>",
    `🎁 Đăng ký nhận quà: <b>${fmt(n(leads?.gift))}</b> · 📩 Tổng liên hệ: <b>${fmt(n(leads?.all))}</b>`,
    `🛒 Bấm sang sàn: ${fmt(e.marketplace_click ?? 0)} · 💬 Bấm tư vấn: ${fmt(e.consult_click ?? 0)} · 👀 Lượt xem trang: ${fmt(e.page_view ?? 0)}`,
    "",
    "<b>Việc của AI</b>",
    `📝 Bài chờ bạn duyệt: <b>${fmt(n(drafts?.c))}</b>${n(drafts?.c) ? ` → <a href="${site}/admin/content">duyệt bài</a>` : ""}`,
    `💡 Cơ hội từ khoá đang mở: ${fmt(n(openOpp?.c))}`,
    ...topOpp.map((o, k) => `   ${k + 1}. ${esc(o.title)} (${Math.round(o.score)} điểm)`),
    runnerLine,
    ...(extra.length ? ["", ...extra] : []),
    "",
    `<a href="${site}/admin/seo">Mở AI SEO</a> · <a href="${site}/admin/seo/learning">Vòng học</a> · <a href="${site}/admin/seo/indexing">Index</a>`,
  ].filter((x, k, arr) => x !== "" || (arr[k - 1] !== "" && k > 0)).join("\n");
}

export async function sendSeoReport(kind: "daily" | "weekly", extra: string[] = []) {
  const text = await buildSeoReport(kind, extra);
  return notifyAdmin("seoReport", text, { silent: kind === "daily" });
}
