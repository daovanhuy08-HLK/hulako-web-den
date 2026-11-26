// A04 Danh sách sản phẩm (màn 044): tìm theo tên/SKU, lọc danh mục & trạng thái, ảnh đại diện, liên kết mua, danh mục.
import Image from "next/image";
import Link from "next/link";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Field, PageTitle, Panel, SampleTag, SearchInput, Table, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { saveCategory } from "../../actions/products";
import type { ImageRef } from "@/lib/db/schema";

export const metadata = { title: "Thiết bị" };
const ST = [{ key: "draft", label: "Bản nháp" }, { key: "public", label: "Công khai" }, { key: "paused", label: "Tạm ngừng" }, { key: "archived", label: "Lưu trữ" }];

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("product.edit");
  const sp = await searchParams;
  const db = await getDb();
  const where: SQL[] = [];
  if (sp.q) where.push(or(ilike(schema.products.name, `%${sp.q}%`), sql`exists (select 1 from variants v where v.product_id = ${schema.products.id} and v.sku ilike ${`%${sp.q}%`})`)!);
  if (sp.cat) where.push(eq(schema.products.categoryId, sp.cat));
  if (sp.status && ST.some((s) => s.key === sp.status)) where.push(eq(schema.products.status, sp.status as never));
  const [rows, cats] = await Promise.all([
    db.select({
      p: schema.products, cat: schema.categories.name,
      variants: sql<number>`(select count(*)::int from variants v where v.product_id = ${schema.products.id})`,
      links: sql<number>`(select count(*)::int from channel_links l join variants v on v.id = l.variant_id where v.product_id = ${schema.products.id} and l.status = 'ok')`,
      missing: sql<number>`(select count(*)::int from variants v where v.product_id = ${schema.products.id} and v.status in ('public','draft') and not exists (select 1 from channel_links l where l.variant_id = v.id and l.status = 'ok'))`,
      images: sql<ImageRef[] | null>`(select v.images from variants v where v.product_id = ${schema.products.id} and jsonb_array_length(v.images) > 0 order by v.sort_order limit 1)`,
    }).from(schema.products).leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(where.length ? and(...where) : undefined).orderBy(asc(schema.products.sortOrder), asc(schema.products.name)),
    db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder)),
  ]);
  const qs = (o: Record<string, string | undefined>) => `/admin/products?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageTitle title="Quản lý sản phẩm">
        <Link href="/admin/products/links" className="btn-line"><Icon name="link" /> Kiểm tra liên kết mua</Link>
        <Link href="/admin/products/policies" className="btn-line"><Icon name="file" /> Chính sách</Link>
        <Link href="/admin/products/new" className="btn-primary"><Icon name="plus" /> Thêm sản phẩm</Link>
      </PageTitle>
      <form className="mb-5 grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <SearchInput defaultValue={sp.q} placeholder="Tìm tên hoặc SKU" />
        <select name="cat" defaultValue={sp.cat ?? ""} className="input" aria-label="Danh mục"><option value="">Danh mục: Tất cả</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="btn-line">Lọc</button>
      </form>
      <Tabs current={sp.status ?? "all"} tabs={[{ key: "all", label: "Tất cả", href: qs({ status: undefined }) }, ...ST.map((s) => ({ ...s, href: qs({ status: s.key }) }))]}
        extra={<span className="flex items-center gap-1.5 text-sm text-ink-muted"><Icon name="info" className="h-4 w-4" /> Sản phẩm DEMO hiện nhãn “Sản phẩm mẫu”</span>} />
      <Table head={["Sản phẩm", "Danh mục", "Phiên bản", "Trạng thái", "Liên kết mua", "Thao tác"]} empty={!rows.length} emptyText="Chưa có sản phẩm khớp bộ lọc.">
        {rows.map((r) => {
          const img = r.images?.[0];
          return (
            <tr key={r.p.id}>
              <td>
                <Link href={`/admin/products/${r.p.id}`} className="flex items-center gap-4 hover:text-brand-dark">
                  <span className="relative h-20 w-20 flex-none overflow-hidden rounded-xl bg-[#F1F0EE]">{img ? <Image src={img.url} alt={img.alt} fill sizes="80px" className="object-contain" unoptimized /> : <span className="flex h-full items-center justify-center text-ink-muted/60"><Icon name="image" /></span>}</span>
                  <span><span className="block text-[17px] font-bold">{r.p.name}</span>{r.p.isSample && <span className="mt-1.5 inline-block"><SampleTag>Sản phẩm mẫu</SampleTag></span>}</span>
                </Link>
              </td>
              <td className="text-ink-soft">{r.cat ?? "—"}</td>
              <td>{Number(r.variants) || "—"}</td>
              <td><Badge status={r.p.status} /></td>
              <td>{Number(r.variants) === 0 ? <span className="text-ink-muted">Chưa cấu hình</span>
                : Number(r.missing) ? <Link href={`/admin/products/links?q=${encodeURIComponent(r.p.name)}`} className="font-semibold text-[#B42318] hover:underline">Thiếu {r.missing} phiên bản</Link>
                : <span className="text-[#1E7B3C]">{r.links} liên kết hoạt động</span>}</td>
              <td><Link href={`/admin/products/${r.p.id}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-2.5 font-semibold text-brand-dark hover:bg-brand/20"><Icon name="pencil" /> Chỉnh sửa</Link></td>
            </tr>
          );
        })}
      </Table>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel title="Danh mục">
          <ul className="divide-y divide-[#EFECE8]">{cats.map((c) => <li key={c.id} className="flex items-center justify-between py-2.5"><b>{c.name}</b><span className="text-sm text-ink-muted">/thiet-bi?danh-muc={c.slug}</span></li>)}</ul>
          {!cats.length && <p className="text-ink-muted">Chưa có danh mục.</p>}
        </Panel>
        <Panel title="Thêm / sửa danh mục">
          <ActionForm action={saveCategory} resetOnSuccess submitLabel="Lưu danh mục">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tên" name="name" required /><Field label="Slug" name="slug" hint="Trùng slug sẽ cập nhật danh mục đó" />
              <Field label="Mô tả" name="description" /><Field label="Thứ tự" name="sortOrder" type="number" />
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
