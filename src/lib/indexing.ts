// HỖ TRỢ INDEX bài viết — chỉ dùng kênh CHÍNH THỨC:
// 1) IndexNow (Bing, Cốc Cốc, Yandex, Naver, Seznam…): báo ngay URL mới/đổi/gỡ. Khoá tự sinh, phục vụ tại /indexnow.txt.
// 2) Google: gửi lại sitemap qua Search Console API + kiểm tra trạng thái index bằng URL Inspection API.
//    KHÔNG dùng Google Indexing API cho bài viết (Google chỉ cho phép với JobPosting/BroadcastEvent — dùng sai có thể bị phạt).
//    Nút "Yêu cầu lập chỉ mục" của Google chỉ bấm tay được trong Search Console → trang quản trị có link mở thẳng tới đó.
// Mọi trạng thái lưu ở bảng index_status; cron hằng ngày gọi indexMaintenance() để gửi lại bài chưa index và kiểm tra lại.
import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { SITE_URL } from "./settings";
import { accessToken, gscConfigured } from "./seo/gsc";
import { audit } from "./audit";

const isLocal = () => /localhost|127\.0\.0\.1/.test(SITE_URL);
const DAY = 86400_000;
/** Bài chưa index: gửi lại tối đa MAX_SUBMITS lần, cách nhau RESUBMIT_DAYS ngày (tránh bị coi là spam) */
export const RESUBMIT_DAYS = 3;
export const MAX_SUBMITS = 8;

/** Khoá IndexNow: ưu tiên biến môi trường, không có thì tự sinh 1 lần và lưu trong bảng settings. */
export async function indexNowKey(): Promise<string> {
  const env = (process.env.INDEXNOW_KEY ?? "").trim();
  if (env) return env;
  const db = await getDb();
  const read = async () => {
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "indexNow"));
    return ((row?.value as { key?: string } | undefined)?.key ?? "").trim();
  };
  const cur = await read();
  if (cur) return cur;
  // 32 ký tự hex (IndexNow yêu cầu 8–128 ký tự a-z, A-Z, 0-9, -). onConflictDoNothing để 2 request song song không sinh 2 khoá khác nhau.
  await db.insert(schema.settings).values({ key: "indexNow", value: { key: randomBytes(16).toString("hex") } }).onConflictDoNothing();
  return read();
}

export const articlePath = (kind: string, slug: string) => `/${kind === "news" ? "tin-tuc" : "kien-thuc"}/${slug}`;

/** Link mở công cụ "Kiểm tra URL" của Search Console — tại đó bấm "Yêu cầu lập chỉ mục" (Google chỉ cho làm tay) */
export function gscInspectLink(path: string) {
  const site = process.env.GSC_SITE_URL || `${SITE_URL}/`;
  return `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(site)}&id=${encodeURIComponent(`${SITE_URL}${path}`)}`;
}

/** Báo IndexNow danh sách URL (tuyệt đối, cùng host với SITE_URL). Trả mã HTTP để ghi nhận. */
export async function submitIndexNow(urls: string[]): Promise<{ ok: boolean; status: number | null; note: string }> {
  if (isLocal()) return { ok: false, status: null, note: "Bỏ qua IndexNow khi chạy local" };
  const key = await indexNowKey().catch(() => "");
  if (!key) return { ok: false, status: null, note: "Chưa có khoá IndexNow" };
  const host = new URL(SITE_URL).host;
  const urlList = [...new Set(urls)].filter((u) => { try { return new URL(u).host === host; } catch { return false; } }).slice(0, 10000);
  if (!urlList.length) return { ok: false, status: null, note: "Không có URL hợp lệ" };
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/indexnow.txt`, urlList }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  // 200/202 = đã nhận; 403 = khoá chưa xác minh; 422 = URL không thuộc host; 429 = gửi quá nhiều
  const note = !res ? "Không kết nối được IndexNow"
    : res.status === 200 || res.status === 202 ? `IndexNow đã nhận (${res.status})`
    : res.status === 403 ? "IndexNow 403: khoá chưa xác minh được — kiểm tra /indexnow.txt"
    : res.status === 429 ? "IndexNow 429: gửi quá nhiều, để lần sau"
    : `IndexNow ${res.status}`;
  return { ok: !!res && (res.status === 200 || res.status === 202), status: res?.status ?? null, note };
}

/** Gửi lại sitemap lên Google Search Console (cần service account có quyền Chủ sở hữu/Toàn quyền) */
export async function submitSitemapToGoogle(): Promise<{ ok: boolean; note: string }> {
  if (!gscConfigured()) return { ok: false, note: "Google: Search Console chưa cấu hình" };
  if (isLocal()) return { ok: false, note: "Google: bỏ qua khi chạy local" };
  try {
    const token = await accessToken("full");
    const site = encodeURIComponent(process.env.GSC_SITE_URL!);
    const feed = encodeURIComponent(`${SITE_URL}/sitemap.xml`);
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${site}/sitemaps/${feed}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
    });
    if (res.status === 403) return { ok: false, note: "Google 403: service account cần quyền Toàn quyền để gửi sitemap" };
    return { ok: res.ok, note: res.ok ? "Google: đã gửi lại sitemap" : `Google sitemap ${res.status}` };
  } catch (e) {
    return { ok: false, note: `Google: ${(e as Error).message}` };
  }
}

export type IndexStatus = { url: string; verdict: string; coverage: string; lastCrawl: string | null; indexed: boolean };

/** Kiểm tra 1 URL đã được Google index chưa (URL Inspection API, hạn mức ~2.000 lượt/ngày/property) */
export async function inspectUrl(url: string): Promise<IndexStatus | null> {
  if (!gscConfigured()) return null;
  const token = await accessToken("readonly");
  const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: process.env.GSC_SITE_URL, languageCode: "vi" }),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 403) throw new Error("URL Inspection 403: thêm email service account vào Search Console");
  if (res.status === 429) throw new Error("URL Inspection 429: hết hạn mức hôm nay");
  if (!res.ok) throw new Error(`URL Inspection ${res.status}`);
  const r = ((await res.json()) as { inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string } } }).inspectionResult?.indexStatusResult;
  return { url, verdict: r?.verdict ?? "UNKNOWN", coverage: r?.coverageState ?? "", lastCrawl: r?.lastCrawlTime ?? null, indexed: r?.verdict === "PASS" };
}

/** Kiểm tra 1 đường dẫn và lưu kết quả vào index_status */
export async function inspectAndStore(path: string) {
  const r = await inspectUrl(`${SITE_URL}${path}`);
  if (!r) return null;
  const db = await getDb();
  const now = new Date();
  await db.insert(schema.indexStatus).values({ path, inspectedAt: now, verdict: r.verdict, coverage: r.coverage, lastCrawlAt: r.lastCrawl ? new Date(r.lastCrawl) : null, indexedAt: r.indexed ? now : null })
    .onConflictDoUpdate({
      target: schema.indexStatus.path,
      set: {
        inspectedAt: now, verdict: r.verdict, coverage: r.coverage, lastCrawlAt: r.lastCrawl ? new Date(r.lastCrawl) : null,
        // giữ ngày index đầu tiên; nếu Google bỏ index thì xoá để hệ thống gửi lại
        indexedAt: r.indexed ? sql`coalesce(${schema.indexStatus.indexedAt}, now())` : null,
        updatedAt: now,
      },
    });
  return r;
}

/** Ghi nhận một lần gửi (IndexNow + sitemap) cho các đường dẫn */
async function recordSubmit(paths: string[], code: number | null, note: string) {
  if (!paths.length || isLocal()) return; // chạy local không gửi thật → không tính là một lần gửi
  const db = await getDb();
  const now = new Date();
  await db.insert(schema.indexStatus).values(paths.map((path) => ({ path, submitCount: 1, lastSubmittedAt: now, indexNowCode: code, submitNote: note })))
    .onConflictDoUpdate({
      target: schema.indexStatus.path,
      set: { submitCount: sql`${schema.indexStatus.submitCount} + 1`, lastSubmittedAt: now, indexNowCode: code, submitNote: note, updatedAt: now },
    });
}

/** Gửi index cho nhiều đường dẫn trong 1 lần: 1 request IndexNow + 1 lần gửi lại sitemap Google */
export async function submitPaths(paths: string[]) {
  const [inow, google] = await Promise.all([submitIndexNow(paths.map((p) => `${SITE_URL}${p}`)), submitSitemapToGoogle()]);
  const note = `${inow.note} · ${google.note}`;
  await recordSubmit(paths, inow.status, note);
  return { indexNow: inow, google, note };
}

/** Gọi sau khi đăng / gỡ / cập nhật bài: báo IndexNow + gửi lại sitemap Google. Không bao giờ làm hỏng thao tác xuất bản. */
export async function announceUrl(path: string, reason: "publish" | "update" | "unpublish", articleId?: string) {
  const url = `${SITE_URL}${path}`;
  try {
    const db = await getDb();
    if (reason === "unpublish") {
      const inow = await submitIndexNow([url]); // IndexNow nhận cả URL đã gỡ (trả 404/410) để công cụ tìm kiếm xoá nhanh
      await db.insert(schema.indexStatus).values({ path, articleId, removed: true, submitNote: inow.note })
        .onConflictDoUpdate({ target: schema.indexStatus.path, set: { removed: true, submitNote: inow.note, updatedAt: new Date() } });
      await audit(null, "index.unpublish", "url", path, { indexNow: inow.note });
      return { url, indexNow: inow };
    }
    await db.insert(schema.indexStatus).values({ path, articleId, removed: false })
      .onConflictDoUpdate({ target: schema.indexStatus.path, set: { articleId, removed: false, updatedAt: new Date() } });
    // Báo kèm trang danh sách để bot thấy liên kết nội bộ tới bài mới
    const listPath = path.startsWith("/tin-tuc") ? "/tin-tuc" : "/kien-thuc";
    const r = await submitPaths([path, listPath]);
    await audit(null, `index.${reason}`, "url", path, { indexNow: r.indexNow.note, google: r.google.note });
    return { url, ...r };
  } catch (e) {
    console.error("[indexing]", (e as Error).message);
    return { url, error: (e as Error).message };
  }
}

/**
 * Bảo trì index hằng ngày (cron daily), chạy lặp an toàn:
 * 1) đồng bộ danh sách bài đang công khai vào index_status (đánh dấu bài đã gỡ);
 * 2) bài CHƯA index: gửi lại IndexNow + sitemap, cách nhau ≥ RESUBMIT_DAYS ngày, tối đa MAX_SUBMITS lần;
 * 3) nếu có Search Console: kiểm tra trạng thái index (ưu tiên bài chưa kiểm tra), bài đã index thì 14 ngày kiểm lại 1 lần.
 */
export async function indexMaintenance(opts: { inspectLimit?: number; deadline?: number } = {}) {
  const db = await getDb();
  const deadline = opts.deadline ?? Date.now() + 60_000;
  const now = Date.now();
  const out = { tracked: 0, removed: 0, resubmitted: 0, inspected: 0, newlyIndexed: 0, note: "" };

  // 1) đồng bộ
  const live = await db.select({ id: schema.articles.id, kind: schema.articles.kind, slug: schema.articles.slug })
    .from(schema.articles).where(isNotNull(schema.articles.publishedRevisionId));
  const livePaths = live.map((a) => articlePath(a.kind, a.slug));
  if (live.length) {
    await db.insert(schema.indexStatus).values(live.map((a) => ({ path: articlePath(a.kind, a.slug), articleId: a.id })))
      .onConflictDoUpdate({ target: schema.indexStatus.path, set: { articleId: sql`excluded.article_id`, removed: false } });
  }
  const tracked = await db.select().from(schema.indexStatus).where(eq(schema.indexStatus.removed, false));
  const stale = tracked.filter((t) => !livePaths.includes(t.path)).map((t) => t.path);
  if (stale.length) await db.update(schema.indexStatus).set({ removed: true }).where(inArray(schema.indexStatus.path, stale));
  out.tracked = livePaths.length;
  out.removed = stale.length;

  // 2) gửi lại bài chưa index
  const due = await db.select({ path: schema.indexStatus.path }).from(schema.indexStatus).where(and(
    eq(schema.indexStatus.removed, false), isNull(schema.indexStatus.indexedAt), lt(schema.indexStatus.submitCount, MAX_SUBMITS),
    or(isNull(schema.indexStatus.lastSubmittedAt), lt(schema.indexStatus.lastSubmittedAt, new Date(now - RESUBMIT_DAYS * DAY))),
  ));
  if (due.length) {
    const r = await submitPaths(due.map((d) => d.path));
    out.resubmitted = due.length;
    out.note = r.note;
  }

  // 3) kiểm tra trạng thái trên Google
  if (gscConfigured() && !isLocal()) {
    const limit = opts.inspectLimit ?? 40;
    const notIndexed = await db.select({ path: schema.indexStatus.path }).from(schema.indexStatus).where(and(
      eq(schema.indexStatus.removed, false), isNull(schema.indexStatus.indexedAt),
      or(isNull(schema.indexStatus.inspectedAt), lt(schema.indexStatus.inspectedAt, new Date(now - DAY))),
    )).orderBy(sql`${schema.indexStatus.inspectedAt} asc nulls first`).limit(limit);
    const recheck = await db.select({ path: schema.indexStatus.path }).from(schema.indexStatus).where(and(
      eq(schema.indexStatus.removed, false), isNotNull(schema.indexStatus.indexedAt), lt(schema.indexStatus.inspectedAt, new Date(now - 14 * DAY)),
    )).orderBy(asc(schema.indexStatus.inspectedAt)).limit(10);
    for (const { path } of [...notIndexed, ...recheck]) {
      if (Date.now() > deadline) break;
      try {
        const r = await inspectAndStore(path);
        out.inspected++;
        if (r?.indexed && notIndexed.some((n) => n.path === path)) out.newlyIndexed++;
      } catch (e) {
        out.note += ` · ${(e as Error).message}`;
        if (/403|429/.test((e as Error).message)) break; // thiếu quyền / hết hạn mức: dừng, mai chạy tiếp
      }
    }
  }
  return out;
}
