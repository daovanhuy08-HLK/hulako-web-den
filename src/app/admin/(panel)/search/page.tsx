// Tìm nhanh trong quản trị (ô tìm kiếm trên thanh trên): bài viết, sản phẩm/SKU, yêu cầu tư vấn, ứng viên — theo quyền.
import Link from "next/link";
import { desc, eq, ilike, or } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { Badge, EmptyState, PageTitle, Panel, SearchInput } from "@/components/admin/ui";

export const metadata = { title: "Tìm kiếm" };

export default async function AdminSearch({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const db = await getDb();
  const like = `%${q}%`;
  const [arts, prods, leads, apps] = q.length < 2 ? [[], [], [], []] : await Promise.all([
    can(u.roles, "content.edit")
      ? db.select({ id: schema.articles.id, status: schema.articles.status, title: schema.revisions.title, updatedAt: schema.articles.updatedAt })
        .from(schema.articles).leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId))
        .where(or(ilike(schema.revisions.title, like), ilike(schema.articles.slug, like), ilike(schema.articles.targetKeyword, like))).orderBy(desc(schema.articles.updatedAt)).limit(15)
      : Promise.resolve([]),
    can(u.roles, "product.edit")
      ? db.selectDistinct({ id: schema.products.id, name: schema.products.name, status: schema.products.status })
        .from(schema.products).leftJoin(schema.variants, eq(schema.variants.productId, schema.products.id))
        .where(or(ilike(schema.products.name, like), ilike(schema.variants.sku, like), ilike(schema.products.slug, like))).limit(15)
      : Promise.resolve([]),
    can(u.roles, "lead.view") && u.roles.includes("admin")
      ? db.select({ id: schema.leads.id, code: schema.leads.code, topic: schema.leads.topic, status: schema.leads.status, createdAt: schema.leads.createdAt })
        .from(schema.leads).where(or(ilike(schema.leads.code, like), ilike(schema.leads.topic, like))).orderBy(desc(schema.leads.createdAt)).limit(15)
      : Promise.resolve([]),
    can(u.roles, "application.view")
      ? db.select({ id: schema.applications.id, code: schema.applications.code, status: schema.applications.status, createdAt: schema.applications.createdAt })
        .from(schema.applications).where(ilike(schema.applications.code, like)).orderBy(desc(schema.applications.createdAt)).limit(15)
      : Promise.resolve([]),
  ]);
  const total = arts.length + prods.length + leads.length + apps.length;

  return (
    <>
      <PageTitle title="Tìm kiếm" subtitle={q ? `Kết quả cho “${q}”` : "Nhập ít nhất 2 ký tự"} />
      <form className="mb-6 max-w-2xl"><SearchInput defaultValue={q} placeholder="Tìm bài viết, sản phẩm, SKU, mã yêu cầu…" /></form>
      {q.length >= 2 && !total && <div className="card"><EmptyState icon="search" title="Không tìm thấy kết quả" text="Thử từ khoá khác, tên sản phẩm, SKU hoặc mã yêu cầu (vd TV-XXXXXX)." /></div>}
      <div className="grid gap-5 xl:grid-cols-2">
        {arts.length > 0 && <Panel title="Bài viết" icon="file"><ul>{arts.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 border-t border-[#EFECE8] py-2.5 first:border-0"><Link className="font-medium hover:text-brand-dark" href={`/admin/content/${a.id}`}>{a.title ?? "(chưa có tiêu đề)"}</Link><Badge status={a.status} /></li>)}</ul></Panel>}
        {prods.length > 0 && <Panel title="Thiết bị" icon="layers"><ul>{prods.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 border-t border-[#EFECE8] py-2.5 first:border-0"><Link className="font-medium hover:text-brand-dark" href={`/admin/products/${p.id}`}>{p.name}</Link><Badge status={p.status} /></li>)}</ul></Panel>}
        {leads.length > 0 && <Panel title="Yêu cầu tư vấn" icon="message"><ul>{leads.map((l) => <li key={l.id} className="flex items-center justify-between gap-3 border-t border-[#EFECE8] py-2.5 first:border-0"><Link className="font-mono font-semibold hover:text-brand-dark" href={`/admin/support/leads/${l.id}`}>{l.code}</Link><span className="flex-1 text-sm text-ink-muted">{l.topic} · {formatDateTimeVN(l.createdAt)}</span><Badge status={l.status} /></li>)}</ul></Panel>}
        {apps.length > 0 && <Panel title="Hồ sơ ứng viên" icon="briefcase"><ul>{apps.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 border-t border-[#EFECE8] py-2.5 first:border-0"><Link className="font-mono font-semibold hover:text-brand-dark" href={`/admin/recruitment?tab=applications&app=${a.id}`}>{a.code}</Link><span className="flex-1 text-sm text-ink-muted">{formatDateTimeVN(a.createdAt)}</span><Badge status={a.status} /></li>)}</ul></Panel>}
      </div>
    </>
  );
}
