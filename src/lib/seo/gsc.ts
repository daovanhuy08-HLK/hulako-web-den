// Google Search Console: đọc số liệu truy vấn × trang bằng service account (JWT RS256 → OAuth token).
// Không cần thư viện googleapis (nặng) — chỉ dùng fetch + jose.
import { SignJWT, importPKCS8 } from "jose";
import { sql } from "drizzle-orm";
import { getDb, schema } from "../db";

export function gscConfigured(): boolean {
  return !!(process.env.GSC_SITE_URL && process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY);
}

/** scope "full" cần quyền Chủ sở hữu/Toàn quyền trên property (để gửi sitemap); "readonly" đủ để đọc số liệu & kiểm tra index */
export async function accessToken(scope: "readonly" | "full" = "readonly"): Promise<string> {
  const key = await importPKCS8(process.env.GSC_PRIVATE_KEY!.replace(/\\n/g, "\n"), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: `https://www.googleapis.com/auth/webmasters${scope === "readonly" ? ".readonly" : ""}` })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(process.env.GSC_CLIENT_EMAIL!)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now).setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GSC auth lỗi ${res.status} — kiểm tra service account`);
  return ((await res.json()) as { access_token: string }).access_token;
}

type Row = { keys: [string, string, string]; clicks: number; impressions: number; ctr: number; position: number };

/** Thu số liệu [startDate, endDate] (YYYY-MM-DD), upsert theo (ngày, truy vấn, trang). Chạy lại an toàn. */
export async function collectGsc(startDate: string, endDate: string): Promise<{ rows: number; latestDate: string | null }> {
  if (!gscConfigured()) throw new Error("not_configured: Chưa cấu hình Search Console (GSC_SITE_URL, GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY)");
  const token = await accessToken();
  const site = encodeURIComponent(process.env.GSC_SITE_URL!);
  const db = await getDb();
  let startRow = 0, total = 0, latest: string | null = null;
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["date", "query", "page"], rowLimit: 5000, startRow, dataState: "final" }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 403) throw new Error("GSC từ chối quyền — thêm email service account vào property trong Search Console");
    if (!res.ok) throw new Error(`GSC lỗi ${res.status}`);
    const rows = ((await res.json()) as { rows?: Row[] }).rows ?? [];
    if (!rows.length) break;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => {
        const [date, query, pageUrl] = r.keys;
        if (!latest || date > latest) latest = date;
        let path = pageUrl;
        try { path = new URL(pageUrl).pathname; } catch { /* giữ nguyên */ }
        return { date, query: query.slice(0, 300), page: path, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position };
      });
      await db.insert(schema.gscMetrics).values(chunk).onConflictDoUpdate({
        target: [schema.gscMetrics.date, schema.gscMetrics.query, schema.gscMetrics.page],
        set: { clicks: sql`excluded.clicks`, impressions: sql`excluded.impressions`, ctr: sql`excluded.ctr`, position: sql`excluded.position`, collectedAt: new Date() },
      });
    }
    total += rows.length;
    if (rows.length < 5000) break;
    startRow += 5000;
  }
  return { rows: total, latestDate: latest };
}
