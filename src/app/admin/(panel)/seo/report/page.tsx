// Màn 035 Báo cáo hiệu quả SEO: lọc khoảng thời gian / cụm chủ đề / trang đích; số liệu Search Console + hành vi trên website.
// Dùng src/lib/seo/metrics.ts. Số liệu thiếu hiện "Chưa có dữ liệu"; lượt sang sàn là LƯỢT BẤM, không phải đơn hàng.
import Link from "next/link";
import { asc, eq, isNotNull } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { gscConfigured } from "@/lib/seo/gsc";
import { expectedCtr, pagePerformance, periodRange, type PagePerf } from "@/lib/seo/metrics";
import { clusterConversion } from "@/lib/seo/pipeline";
import { SeoNav } from "@/components/admin/SeoNav";
import { EmptyState, Notice, Num, PageTitle, Panel, StatCard, Table } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";

export const metadata = { title: "Báo cáo hiệu quả SEO" };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const delta = (a: number, b: number) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(((a - b) / b) * 100).toFixed(0)}% so với kỳ trước` : "Kỳ trước chưa có dữ liệu");

function sum(list: PagePerf[]) {
  const t = { impressions: 0, clicks: 0, views: 0, marketplaceClicks: 0, consultClicks: 0, leads: 0, posW: 0 };
  for (const p of list) {
    t.impressions += p.impressions; t.clicks += p.clicks; t.views += p.views; t.marketplaceClicks += p.marketplaceClicks; t.consultClicks += p.consultClicks; t.leads += p.leads;
    if (p.position != null) t.posW += p.position * p.impressions;
  }
  return { ...t, ctr: t.impressions ? t.clicks / t.impressions : null, position: t.impressions ? t.posW / t.impressions : null };
}

export default async function SeoReport({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("seo.view");
  const sp = await searchParams;
  const days = [7, 28, 90].includes(Number(sp.days)) ? Number(sp.days) : 28;
  const db = await getDb();
  const [cur, prev, topics, arts, conv] = await Promise.all([
    pagePerformance(days), pagePerformance(days, days),
    db.select().from(schema.topics).orderBy(asc(schema.topics.sortOrder)),
    db.select({ id: schema.articles.id, kind: schema.articles.kind, slug: schema.articles.slug, topicId: schema.articles.topicId, title: schema.revisions.title, ai: schema.articles.aiGenerated, pv: schema.articles.promptVersion })
      .from(schema.articles).innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId)).where(isNotNull(schema.articles.publishedRevisionId)),
    clusterConversion(),
  ]);
  const path = (a: { kind: string; slug: string }) => `/${a.kind === "news" ? "tin-tuc" : "kien-thuc"}/${a.slug}`;
  const topicPaths = sp.topic ? new Set(arts.filter((a) => a.topicId === sp.topic).map(path)) : null;
  const keep = (p: PagePerf) => (!topicPaths || topicPaths.has(p.page)) && (!sp.page || p.page === sp.page);
  const curList = [...cur.values()].filter(keep), prevList = [...prev.values()].filter(keep);
  const a = sum(curList), b = sum(prevList);
  const hasGsc = a.impressions > 0 || b.impressions > 0;
  const range = periodRange(days);
  const behaviour = curList.filter((p) => p.views || p.marketplaceClicks || p.consultClicks || p.leads).sort((x, y) => y.marketplaceClicks + y.leads - (x.marketplaceClicks + x.leads) || y.views - x.views).slice(0, 15);
  const lowCtr = arts.map((x) => ({ ...x, p: cur.get(path(x)) })).filter((x) => x.p && keep(x.p) && x.p.impressions >= 50 && x.p.position != null && x.p.ctr < expectedCtr(x.p.position) * 0.6)
    .sort((x, y) => y.p!.impressions - x.p!.impressions).slice(0, 10);
  const byPrompt = new Map<string, { n: number; impr: number; clicks: number; mk: number; views: number }>();
  for (const r of arts) {
    const p = cur.get(path(r)); if (!p) continue;
    const k = r.ai ? `AI · hướng dẫn v${r.pv ?? 1}` : "Người viết";
    const v = byPrompt.get(k) ?? { n: 0, impr: 0, clicks: 0, mk: 0, views: 0 };
    v.n++; v.impr += p.impressions; v.clicks += p.clicks; v.mk += p.marketplaceClicks; v.views += p.views; byPrompt.set(k, v);
  }

  return (
    <>
      <PageTitle title="Báo cáo hiệu quả SEO" />
      <SeoNav current="/admin/seo/report" />
      <form className="card mb-5 grid gap-4 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div><label htmlFor="r-days" className="mb-1.5 block font-semibold">Khoảng thời gian</label><select id="r-days" name="days" defaultValue={String(days)} className="input"><option value="7">7 ngày</option><option value="28">28 ngày</option><option value="90">90 ngày</option></select></div>
        <div><label htmlFor="r-topic" className="mb-1.5 block font-semibold">Cụm chủ đề</label><select id="r-topic" name="topic" defaultValue={sp.topic ?? ""} className="input"><option value="">Tất cả cụm</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label htmlFor="r-page" className="mb-1.5 block font-semibold">Trang đích</label><select id="r-page" name="page" defaultValue={sp.page ?? ""} className="input"><option value="">Tất cả trang</option>{arts.map((x) => <option key={x.id} value={path(x)}>{x.title}</option>)}</select></div>
        <button className="btn-primary self-end">Xem báo cáo</button>
      </form>
      {!gscConfigured() && <Notice tone="warn" title="Chưa kết nối Search Console" action={<Link href="/admin/seo/sources" className="btn-primary btn-sm"><Icon name="link" /> Kết nối nguồn</Link>}>Hiển thị/nhấp/CTR/vị trí sẽ trống cho tới khi kết nối. Hành vi trên website vẫn được đo.</Notice>}
      <p className="mb-3 text-sm text-ink-muted">Kỳ Search Console: {range.start} → {range.end} (trễ ~2 ngày). Hành vi website: {days} ngày gần nhất theo thời gian thực.</p>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="eye" label="Lượt hiển thị" value={hasGsc ? a.impressions.toLocaleString("vi-VN") : "—"} hint={hasGsc ? delta(a.impressions, b.impressions) : "Chưa có dữ liệu"} />
        <StatCard icon="pointer" label="Lượt nhấp" value={hasGsc ? a.clicks.toLocaleString("vi-VN") : "—"} hint={hasGsc ? delta(a.clicks, b.clicks) : "Chưa có dữ liệu"} />
        <StatCard icon="percent" label="CTR" value={a.ctr != null ? pct(a.ctr) : "—"} hint={a.ctr != null && b.ctr != null ? delta(a.ctr, b.ctr) : "Chưa có dữ liệu"} />
        <StatCard icon="bars" label="Vị trí trung bình" value={a.position != null ? a.position.toFixed(1) : "—"} hint={a.position != null ? "Số nhỏ hơn là tốt hơn" : "Chưa có dữ liệu"} />
      </div>
      {!hasGsc && (
        <div className="card mb-5"><EmptyState icon="monitor" title="Kết nối nguồn để xem dữ liệu" text="Kết nối Google Search Console để hiển thị báo cáo hiệu quả SEO."><Link href="/admin/seo/sources" className="btn-primary"><Icon name="link" /> Kết nối nguồn</Link></EmptyState></div>
      )}
      <Panel title="Hành vi trên website">
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          {[["Lượt xem trang", a.views, b.views], ["Lượt sang sàn", a.marketplaceClicks, b.marketplaceClicks], ["Bấm tư vấn", a.consultClicks, b.consultClicks], ["Yêu cầu tư vấn", a.leads, b.leads]].map(([l, x, y]) => (
            <div key={l as string} className="rounded-xl bg-[#F7F5F2] p-3"><p className="text-sm text-ink-muted">{l}</p><p className="text-2xl font-extrabold">{(x as number).toLocaleString("vi-VN")}</p><p className="text-xs text-ink-muted">{delta(x as number, y as number)}</p></div>
          ))}
        </div>
        <Table head={["Trang", "Lượt xem", "Lượt sang sàn", "Yêu cầu tư vấn"]} empty={!behaviour.length} emptyText="Chưa có dữ liệu hành vi trong kỳ.">
          {behaviour.map((p) => <tr key={p.page}><td className="break-all">{p.page}</td><td>{p.views}</td><td>{p.marketplaceClicks}</td><td>{p.leads + p.consultClicks}</td></tr>)}
        </Table>
        <p className="mt-2 text-xs text-ink-muted">Lượt sang sàn là lượt bấm sang Shopee/TikTok Shop, không phải đơn hàng.</p>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Hiển thị nhiều, nhấp ít → đề xuất sửa tiêu đề">
          <Table head={["Bài", "Hiển thị", "CTR", "Vị trí"]} empty={!lowCtr.length} emptyText="Chưa có dữ liệu.">
            {lowCtr.map((r) => <tr key={r.id}><td><Link className="hover:text-brand-dark" href={`/admin/content/${r.id}/seo`}>{r.title}</Link></td><td>{r.p!.impressions}</td><td>{pct(r.p!.ctr)}</td><td>{r.p!.position?.toFixed(1)}</td></tr>)}
          </Table>
        </Panel>
        <Panel title="Cụm chủ đề — tỷ lệ chuyển đổi (56 ngày)">
          <Table head={["Cụm", "Lượt xem", "Chuyển đổi", "Tỷ lệ"]} empty={!conv.length} emptyText="Chưa có dữ liệu.">
            {conv.map((c) => <tr key={c.cluster}><td>{c.cluster}</td><td>{c.views}</td><td>{c.conversions}</td><td>{pct(c.rate)}</td></tr>)}
          </Table>
        </Panel>
        <Panel title="Hiệu quả theo phiên bản hướng dẫn viết">
          <Table head={["Nhóm", "Số bài", "CTR", "Sang sàn / xem"]} empty={!byPrompt.size} emptyText="Chưa có dữ liệu.">
            {[...byPrompt].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.n}</td><td><Num v={v.impr ? v.clicks / v.impr : null} fmt={pct} /></td><td><Num v={v.views ? v.mk / v.views : null} fmt={pct} /></td></tr>)}
          </Table>
        </Panel>
      </div>
    </>
  );
}
