// A01 Tổng quan (màn 008): thẻ số liệu theo quyền, bảng bài chờ duyệt, việc cần xử lý.
import Image from "next/image";
import Link from "next/link";
import { and, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { Badge, EmptyState, LinkRow, Panel, SampleTag, StatCard, Table } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { monthSpendUsd, aiConfigured } from "@/lib/ai/claude";
import { gscConfigured } from "@/lib/seo/gsc";

export const metadata = { title: "Tổng quan" };

export default async function Dashboard() {
  const u = await requirePage();
  const db = await getDb();
  const count = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const [review, missingLinks, newLeads, newApps, failedJobs, aiDrafts, queue, spend] = await Promise.all([
    count(db.select({ n: sql<number>`count(*)::int` }).from(schema.articles).where(eq(schema.articles.status, "review"))),
    count(db.select({ n: sql<number>`count(distinct ${schema.products.id})::int` }).from(schema.variants).innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
      .where(and(inArray(schema.products.status, ["public", "draft"]), inArray(schema.variants.status, ["public", "draft"]),
        notExists(db.select().from(schema.channelLinks).where(and(eq(schema.channelLinks.variantId, schema.variants.id), eq(schema.channelLinks.status, "ok"))))))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(schema.leads).where(eq(schema.leads.status, "new"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(schema.applications).where(eq(schema.applications.status, "new"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(schema.aiJobs).where(eq(schema.aiJobs.status, "failed"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(schema.articles).where(and(eq(schema.articles.aiGenerated, true), inArray(schema.articles.status, ["draft", "review"])))),
    db.select({ id: schema.articles.id, status: schema.articles.status, isSample: schema.articles.isSample, title: schema.revisions.title, cover: schema.revisions.coverUrl, coverAlt: schema.revisions.coverAlt, topic: schema.topics.name })
      .from(schema.articles)
      .leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId))
      .leftJoin(schema.topics, eq(schema.topics.id, schema.articles.topicId))
      .where(inArray(schema.articles.status, ["review", "draft", "approved"])).orderBy(sql`case ${schema.articles.status} when 'review' then 0 when 'approved' then 1 else 2 end`, desc(schema.articles.updatedAt)).limit(6),
    can(u.roles, "seo.view") ? monthSpendUsd() : Promise.resolve(0),
  ]);

  const cards = [
    { icon: "file" as const, label: "Bài chờ duyệt", n: review, href: "/admin/content?status=review", show: can(u.roles, "content.edit") },
    { icon: "link" as const, label: "Sản phẩm thiếu liên kết", n: missingLinks, href: "/admin/products/links?status=missing", show: can(u.roles, "product.edit") },
    { icon: "message" as const, label: "Yêu cầu tư vấn mới", n: newLeads, href: "/admin/support?status=new", show: can(u.roles, "lead.view") },
    { icon: "briefcase" as const, label: "Hồ sơ ứng tuyển mới", n: newApps, href: "/admin/recruitment?tab=applications&status=new", show: can(u.roles, "application.view") },
    { icon: "sparkles" as const, label: "Bản nháp do AI viết", n: aiDrafts, href: "/admin/seo?tab=queue", show: can(u.roles, "content.edit") },
    { icon: "alert" as const, label: "Tác vụ AI lỗi", n: failedJobs, href: "/admin/seo?tab=jobs&status=failed", show: can(u.roles, "seo.view") },
  ].filter((c) => c.show);

  const todo = [
    { icon: "file" as const, label: "Duyệt bài viết", href: "/admin/content?status=review", n: review, show: can(u.roles, "content.review") },
    { icon: "link" as const, label: "Liên kết sản phẩm", href: "/admin/products/links", n: missingLinks, show: can(u.roles, "product.edit") },
    { icon: "message" as const, label: "Xem yêu cầu tư vấn", href: "/admin/support", n: newLeads, show: can(u.roles, "lead.view") },
    { icon: "briefcase" as const, label: "Hồ sơ ứng tuyển", href: "/admin/recruitment?tab=applications", n: newApps, show: can(u.roles, "application.view") },
    { icon: "bot" as const, label: "Tác vụ AI cần chạy lại", href: "/admin/seo?tab=jobs&status=failed", n: failedJobs, show: can(u.roles, "seo.view") },
    { icon: "calendar" as const, label: "Lịch xuất bản", href: "/admin/content/calendar", n: null, show: can(u.roles, "content.edit") },
  ].filter((t) => t.show);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[34px] font-extrabold tracking-tight">Tổng quan</h1>
        {can(u.roles, "content.edit") && <Link href="/admin/content/new" className="btn-primary"><Icon name="plus" /> Tạo bài viết</Link>}
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => <StatCard key={c.label} icon={c.icon} label={c.label} value={c.n} href={c.href} />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        {can(u.roles, "content.edit") ? (
          <Panel title="Bài chờ duyệt" className="min-h-[420px]" actions={<Link href="/admin/content/new" className="btn-primary btn-sm"><Icon name="plus" /> Tạo bài viết</Link>}>
            <Table head={["Tiêu đề", "Chủ đề", "Trạng thái"]} empty={!queue.length} emptyText="Không có bài nào đang chờ xử lý.">
              {queue.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/content/${r.id}`} className="flex items-center gap-4 hover:text-brand-dark">
                      <span className="relative h-16 w-24 flex-none overflow-hidden rounded-lg bg-[#F1F0EE]">
                        {r.cover ? <Image src={r.cover} alt={r.coverAlt || ""} fill sizes="96px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center text-ink-muted/60"><Icon name="image" /></span>}
                      </span>
                      <span className="font-bold">{r.title ?? "(chưa có tiêu đề)"}{r.isSample && <span className="ml-2 align-middle"><SampleTag>Bài mẫu</SampleTag></span>}</span>
                    </Link>
                  </td>
                  <td className="text-ink-soft">{r.topic ?? "—"}</td>
                  <td><Badge status={r.status} /></td>
                </tr>
              ))}
            </Table>
          </Panel>
        ) : <div />}
        <div>
          <Panel title="Việc cần xử lý" id="viec-can-xu-ly">
            {todo.length ? todo.map((t) => (
              <LinkRow key={t.label} href={t.href} icon={t.icon}>
                <span className="flex items-center justify-between gap-2">{t.label}{t.n ? <span className="rounded-full bg-brand px-2.5 text-sm font-bold text-white">{t.n}</span> : null}</span>
              </LinkRow>
            )) : <EmptyState icon="checkCircle" title="Không có việc cần xử lý" />}
          </Panel>
          {can(u.roles, "seo.view") && (
            <Panel title="Trạng thái AI SEO">
              <ul className="space-y-2 text-[15px]">
                <li className="flex items-center justify-between">AI (Claude CLI trên máy) <Badge status={aiConfigured() ? "configured" : "not_configured"} /></li>
                <li className="flex items-center justify-between">Search Console <Badge status={gscConfigured() ? "configured" : "not_configured"} /></li>
                <li className="flex items-center justify-between">Chi phí AI tháng này <b>{spend.toFixed(2)} / {process.env.AI_MONTHLY_BUDGET_USD ?? 30} USD</b></li>
              </ul>
              <Link href="/admin/seo" className="btn-line mt-4 w-full">Mở AI SEO</Link>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
