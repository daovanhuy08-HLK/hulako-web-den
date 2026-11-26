// A06 Thư viện ảnh (màn 017): lưới ảnh + bảng thông tin ảnh bên phải (alt, nguồn, SKU, quyền sử dụng, duyệt);
// lưu trữ ảnh đang được dùng → hộp thoại nơi tham chiếu (màn 072).
import Image from "next/image";
import Link from "next/link";
import { and, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { rowsOf } from "@/lib/db/rows";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { MediaArchive, type MediaRef } from "@/components/admin/MediaArchive";
import { Badge, EmptyState, Field, PageTitle, SearchInput, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { updateMedia, uploadMedia } from "../../actions/ops";

export const metadata = { title: "Thư viện ảnh" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage("media.edit");
  const sp = await searchParams;
  const db = await getDb();
  const where: SQL[] = [];
  if (sp.q) where.push(or(ilike(schema.mediaAssets.sku, `%${sp.q}%`), ilike(schema.mediaAssets.alt, `%${sp.q}%`), sql`${schema.mediaAssets.tags}::text ilike ${`%${sp.q}%`}`)!);
  if (sp.status && ["pending", "approved", "archived"].includes(sp.status)) where.push(eq(schema.mediaAssets.status, sp.status));
  else where.push(sql`${schema.mediaAssets.status} <> 'archived'`);
  if (sp.type === "product") where.push(isNotNull(schema.mediaAssets.sku));
  if (sp.type === "guide") where.push(isNull(schema.mediaAssets.sku));
  const rows = await db.select({
    id: schema.mediaAssets.id, url: schema.mediaAssets.url, alt: schema.mediaAssets.alt, sku: schema.mediaAssets.sku, status: schema.mediaAssets.status,
    source: schema.mediaAssets.source, usageRights: schema.mediaAssets.usageRights, size: schema.mediaAssets.size, tags: schema.mediaAssets.tags, createdAt: schema.mediaAssets.createdAt,
  }).from(schema.mediaAssets).where(and(...where)).orderBy(desc(schema.mediaAssets.createdAt)).limit(80);
  const sel = rows.find((m) => m.id === sp.id) ?? null;
  const qs = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][])}`;

  // Nơi đang tham chiếu ảnh được chọn (phiên bản sản phẩm, bài viết, mẫu góc live)
  let refs: MediaRef[] = [];
  if (sel) {
    const like = `%${sel.url}%`;
    const r = rowsOf<{ t: string; label: string; a: string; b: string | null }>(await db.execute(sql`
      select 'variant' as t, p.name || ' — ' || v.sku as label, p.id::text as a, v.id::text as b from variants v join products p on p.id = v.product_id where v.images::text like ${like}
      union all select distinct 'article', r.title, a.id::text, null from revisions r join articles a on a.id = r.article_id
        where (r.cover_url = ${sel.url} or r.body like ${like}) and (a.draft_revision_id = r.id or a.published_revision_id = r.id)
      union all select 'setup', s.title, s.id::text, null from setups s where s.cover_url = ${sel.url} or s.diagram_url = ${sel.url}
      limit 20`));
    refs = r.map((x) => x.t === "variant" ? { label: x.label, href: `/admin/products/${x.a}/variants/${x.b}`, kind: "Phiên bản sản phẩm" }
      : x.t === "article" ? { label: x.label, href: `/admin/content/${x.a}`, kind: "Bài viết" } : { label: x.label, href: `/admin/setups/${x.a}`, kind: "Góc livestream" });
  }
  const canApprove = can(u.roles, "media.approve");

  return (
    <>
      <PageTitle title="Thư viện ảnh">
        <Link href={qs({ upload: sp.upload ? undefined : "1", id: undefined })} className="btn-primary"><Icon name="upload" /> Tải ảnh lên</Link>
      </PageTitle>
      <form className="mb-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
        <SearchInput defaultValue={sp.q} placeholder="Tìm alt, thẻ hoặc SKU" />
        <select name="type" defaultValue={sp.type ?? ""} className="input" aria-label="Loại ảnh"><option value="">Loại ảnh: tất cả</option><option value="product">Ảnh sản phẩm (có SKU)</option><option value="guide">Ảnh hướng dẫn / bối cảnh</option></select>
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Trạng thái duyệt"><option value="">Trạng thái duyệt</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="archived">Đã lưu trữ</option></select>
        <button className="btn-line">Lọc</button>
      </form>
      <Tabs variant="pill" current={sp.type ?? "all"} tabs={[{ key: "all", label: "Tất cả ảnh", href: qs({ type: undefined, id: undefined }) }, { key: "product", label: "Ảnh sản phẩm", href: qs({ type: "product", id: undefined }) }, { key: "guide", label: "Ảnh hướng dẫn", href: qs({ type: "guide", id: undefined }) }]} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="card p-4">
          {rows.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
              {rows.map((m) => (
                <Link key={m.id} href={qs({ id: m.id, upload: undefined })} aria-current={m.id === sel?.id ? "true" : undefined}
                  className={`relative block aspect-[4/3.4] overflow-hidden rounded-card border-2 bg-[#F4F1ED] ${m.id === sel?.id ? "border-brand" : "border-transparent hover:border-line"}`}>
                  <Image src={m.url} alt={m.alt} fill sizes="260px" className="object-contain" unoptimized />
                  <span className={`absolute left-2.5 top-2.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${m.status === "approved" ? "bg-[#E7F6EC] text-[#1E7B3C]" : m.status === "archived" ? "bg-white text-ink-muted" : "bg-brand-soft text-brand-dark"}`}>{m.status === "approved" ? "Đã duyệt" : m.status === "archived" ? "Lưu trữ" : "Chờ duyệt"}</span>
                  {m.id === sel?.id && <span className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white"><Icon name="check" className="h-4 w-4" /></span>}
                </Link>
              ))}
            </div>
          ) : <EmptyState icon="image" title="Chưa có ảnh khớp bộ lọc" text="Tải ảnh lên kèm alt, nguồn và quyền sử dụng. Ảnh chỉ dùng trên web sau khi được duyệt." />}
        </section>

        <aside className="card h-fit p-5">
          {sp.upload ? (
            <>
              <h2 className="mb-4 text-2xl font-bold">Tải ảnh lên</h2>
              <ActionForm action={uploadMedia} submitLabel="Tải lên" submitIcon="upload" resetOnSuccess>
                <div className="space-y-4">
                  <div><label htmlFor="file" className="mb-1.5 block font-semibold">Ảnh (JPG/PNG/WEBP, ≤ 8 MB) <span className="text-brand">*</span></label><input id="file" name="file" type="file" accept="image/*" className="input py-2" /></div>
                  <Field label="Văn bản thay thế (alt)" name="alt" required placeholder="Mô tả nội dung ảnh" />
                  <Field label="Nguồn ảnh" name="source" placeholder="Ảnh gốc đội vận hành / ảnh sản phẩm" />
                  <Field label="Quyền sử dụng" name="usageRights" placeholder="Ảnh tự chụp / được cấp phép" />
                  <Field label="SKU sản phẩm liên quan" name="sku" />
                  <Field label="Thẻ (mỗi dòng 1 thẻ)" name="tags" rows={2} />
                </div>
              </ActionForm>
            </>
          ) : sel ? (
            <>
              <h2 className="mb-4 text-2xl font-bold">Thông tin ảnh</h2>
              <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-[#F4F1ED]"><Image src={sel.url} alt={sel.alt} fill sizes="400px" className="object-contain" unoptimized /></div>
              <input readOnly value={sel.url} className="input mt-3 !min-h-[36px] text-xs" aria-label="URL ảnh" />
              <p className="mt-1 text-xs text-ink-muted">{Math.round(sel.size / 1024)} KB · tải lên {formatDateTimeVN(sel.createdAt)}{sel.tags.length ? ` · thẻ: ${sel.tags.join(", ")}` : ""}</p>
              <ActionForm action={updateMedia} submitLabel="Lưu thông tin" submitIcon="save" key={sel.id}>
                <input type="hidden" name="id" value={sel.id} />
                <div className="mt-4 space-y-4">
                  <Field label="Văn bản thay thế" name="alt" defaultValue={sel.alt} />
                  <Field label="Nguồn ảnh" name="source" defaultValue={sel.source} />
                  <Field label="Quyền sử dụng" name="usageRights" defaultValue={sel.usageRights} />
                  <Field label="Sản phẩm liên quan (SKU)" name="sku" defaultValue={sel.sku} />
                </div>
              </ActionForm>
              <div className="mt-5 border-t border-[#EFECE8] pt-4">
                <p className="mb-2 font-semibold">Trạng thái duyệt</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge status={sel.status === "pending" ? "pending" : sel.status === "approved" ? "approved" : "archived"} />
                  {canApprove && sel.status !== "approved" && <ActionButton action={updateMedia} label="Duyệt quyền sử dụng" icon="check" className="btn-primary btn-sm" fields={{ id: sel.id, op: "approve" }} />}
                  {canApprove && sel.status !== "archived" && <MediaArchive action={updateMedia} id={sel.id} url={sel.url} alt={sel.alt} refs={refs} sample={/mau|demo|minh/i.test(sel.source + sel.tags.join(" "))} />}
                </div>
                {!canApprove && <p className="mt-2 text-xs text-ink-muted">Duyệt/lưu trữ ảnh cần vai trò Vận hành sản phẩm hoặc Quản trị.</p>}
                <p className="mt-4 text-sm font-semibold">Đang được dùng ở</p>
                {refs.length ? <ul className="mt-1 space-y-1 text-sm">{refs.map((r, i) => <li key={i}><Link href={r.href} className="text-brand-dark underline">{r.label}</Link> <span className="text-ink-muted">· {r.kind}</span></li>)}</ul> : <p className="text-sm text-ink-muted">Chưa có nội dung tham chiếu.</p>}
              </div>
            </>
          ) : <EmptyState icon="image" title="Chọn một ảnh" text="Bấm vào ảnh để xem và sửa alt, nguồn, quyền sử dụng và trạng thái duyệt." />}
        </aside>
      </div>
    </>
  );
}
