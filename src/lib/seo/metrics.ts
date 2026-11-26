// Đo lường cho vòng phản hồi: gộp số liệu Search Console + sự kiện hành vi website theo trang/cụm.
import { and, gte, lt, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { rowsOf } from "../db/rows";

export type PagePerf = {
  page: string; impressions: number; clicks: number; ctr: number; position: number | null;
  views: number; marketplaceClicks: number; consultClicks: number; leads: number;
};

const day = (d: Date) => d.toISOString().slice(0, 10);

export function periodRange(days: number, offsetDays = 0) {
  const end = new Date(Date.now() - (offsetDays + 2) * 86400_000); // GSC trễ ~2 ngày
  const start = new Date(end.getTime() - (days - 1) * 86400_000);
  return { start: day(start), end: day(end), startDate: new Date(`${day(start)}T00:00:00Z`), endDate: new Date(`${day(end)}T23:59:59Z`) };
}

/** CTR kỳ vọng theo vị trí trung bình (tham chiếu ngành, chỉ dùng để phát hiện bài hiển thị nhiều mà ít nhấp) */
export function expectedCtr(position: number): number {
  if (position <= 1.5) return 0.25;
  if (position <= 2.5) return 0.15;
  if (position <= 3.5) return 0.1;
  if (position <= 5) return 0.06;
  if (position <= 10) return 0.03;
  if (position <= 20) return 0.01;
  return 0.003;
}

export async function pagePerformance(days = 28, offsetDays = 0): Promise<Map<string, PagePerf>> {
  const db = await getDb();
  const r = periodRange(days, offsetDays);
  const gsc = rowsOf<{ page: string; impressions: number; clicks: number; pos: number | null }>(await db.execute(sql`
    select page, sum(impressions)::int as impressions, sum(clicks)::int as clicks,
      case when sum(impressions) > 0 then sum(position * impressions) / sum(impressions) else null end as pos
    from gsc_metrics where date between ${r.start} and ${r.end} group by page`));
  // Sự kiện website ghi theo thời gian thực → không lùi 2 ngày như Search Console
  const evEnd = new Date(Date.now() - offsetDays * 86400_000);
  const evStart = new Date(evEnd.getTime() - days * 86400_000);
  const ev = await db.select({
    page: schema.events.pagePath, type: schema.events.type, n: sql<number>`count(*)::int`,
  }).from(schema.events)
    .where(and(gte(schema.events.createdAt, evStart), lt(schema.events.createdAt, evEnd)))
    .groupBy(schema.events.pagePath, schema.events.type);

  const map = new Map<string, PagePerf>();
  const get = (page: string) => {
    let p = map.get(page);
    if (!p) { p = { page, impressions: 0, clicks: 0, ctr: 0, position: null, views: 0, marketplaceClicks: 0, consultClicks: 0, leads: 0 }; map.set(page, p); }
    return p;
  };
  for (const g of gsc) {
    const p = get(g.page);
    p.impressions = Number(g.impressions); p.clicks = Number(g.clicks);
    p.ctr = p.impressions ? p.clicks / p.impressions : 0;
    p.position = g.pos == null ? null : Number(g.pos);
  }
  for (const e of ev) {
    const p = get(e.page);
    const n = Number(e.n);
    if (e.type === "page_view") p.views += n;
    if (e.type === "marketplace_click") p.marketplaceClicks += n;
    if (e.type === "consult_click") p.consultClicks += n;
    if (e.type === "lead_submit") p.leads += n;
  }
  return map;
}

/** Truy vấn × trang tổng hợp trong kỳ (cho gom từ khoá và phát hiện 2 trang cạnh tranh cùng ý định) */
export async function queryPageAggregates(days = 28) {
  const db = await getDb();
  const r = periodRange(days);
  return rowsOf<{ query: string; page: string; impressions: number; clicks: number; pos: number }>(await db.execute(sql`
    select query, page, sum(impressions)::int as impressions, sum(clicks)::int as clicks,
      sum(position * impressions) / nullif(sum(impressions),0) as pos
    from gsc_metrics where date between ${r.start} and ${r.end}
    group by query, page having sum(impressions) > 0`));
}

export async function latestGscDate(): Promise<string | null> {
  const db = await getDb();
  const rows = rowsOf<{ d: string | null }>(await db.execute(sql`select max(date)::text as d from gsc_metrics`));
  return rows[0]?.d ?? null;
}
