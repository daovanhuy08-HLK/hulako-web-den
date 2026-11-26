// A04 Chỉnh sửa sản phẩm (màn 010): thông tin chung, danh sách phiên bản (SKU, link sàn), ảnh, trạng thái bán, DEMO.
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray, and } from "drizzle-orm";
import { requirePage, requireUuidOrNew } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { USE_CASES } from "@/lib/catalog";
import { ActionForm, SubmitFor } from "@/components/admin/ActionForm";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { Badge, DemoCheckbox, Field, LinkRow, PageTitle, Panel } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { saveProduct } from "../../../actions/products";

export const metadata = { title: "Chỉnh sửa sản phẩm" };
const STATUS_OPTS = [{ value: "draft", label: "Bản nháp" }, { value: "public", label: "Công khai" }, { value: "paused", label: "Tạm ngừng bán" }, { value: "archived", label: "Lưu trữ" }];

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage("product.edit");
  const { id } = await params;
  requireUuidOrNew(id);
  const db = await getDb();
  const isNew = id === "new";
  const [p] = isNew ? [] : await db.select().from(schema.products).where(eq(schema.products.id, id));
  if (!isNew && !p) notFound();
  const [cats, vs, pol] = await Promise.all([
    db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder)),
    p ? db.select().from(schema.variants).where(eq(schema.variants.productId, p.id)).orderBy(asc(schema.variants.sortOrder)) : Promise.resolve([]),
    p ? db.select({ id: schema.policies.id }).from(schema.policies).where(and(eq(schema.policies.scope, "product"), eq(schema.policies.refId, p.id))) : Promise.resolve([]),
  ]);
  const links = vs.length ? await db.select().from(schema.channelLinks).where(inArray(schema.channelLinks.variantId, vs.map((v) => v.id))) : [];
  const cover = vs.flatMap((v) => v.images)[0];
  const canPublish = can(u.roles, "product.publish");

  return (
    <>
      <PageTitle title={isNew ? "Thêm sản phẩm" : "Chỉnh sửa sản phẩm"} subtitle={p && <span className="text-xl text-ink">{p.name}</span>} back="/admin/products">
        {p && p.status !== "draft" && <Link href={`/thiet-bi/${p.slug}`} target="_blank" className="btn-line"><Icon name="eye" /> Xem trước</Link>}
        <SubmitFor form="product-form" label={isNew ? "Tạo sản phẩm" : "Lưu sản phẩm"} icon="save" />
      </PageTitle>
      <ActionForm action={saveProduct} id="product-form" toast buttons={null}>
        <input type="hidden" name="id" value={p?.id ?? ""} /><input type="hidden" name="version" value={p?.version ?? 0} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <Panel title="Thông tin chung">
              <div className="space-y-4">
                <Field label="Tên sản phẩm" name="name" defaultValue={p?.name} required />
                <Field label="Mô tả sản phẩm (thẻ sản phẩm, meta)" name="summary" defaultValue={p?.summary} rows={3} placeholder="Nhập mô tả sản phẩm…" />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Danh mục" name="categoryId" defaultValue={p?.categoryId} options={[{ value: "", label: "— Chọn danh mục —" }, ...cats.map((c) => ({ value: c.id, label: c.name }))]} />
                  <Field label="Đường dẫn (slug)" name="slug" defaultValue={p?.slug} hint="Đổi slug sản phẩm đã công khai sẽ tạo 301" />
                </div>
                <fieldset><legend className="mb-1.5 text-[15px] font-semibold">Nhu cầu phù hợp</legend><div className="flex flex-wrap gap-2">{USE_CASES.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm"><input type="checkbox" name="useCases" value={c.value} defaultChecked={p?.useCases.includes(c.value)} />{c.label}</label>
                ))}</div></fieldset>
                <MarkdownField label="Nội dung chi tiết (hướng dẫn, lưu ý)" name="body" defaultValue={p?.body} rows={8} />
              </div>
            </Panel>
            {p && (
              <Panel title="Phiên bản" actions={<Link href={`/admin/products/${p.id}/variants/new`} className="btn-outline btn-sm"><Icon name="plus" /> Thêm phiên bản</Link>}>
                <div className="overflow-x-auto">
                  <table className="adm-table">
                    <thead><tr><th>Phiên bản</th><th>SKU</th><th>Trạng thái</th><th>Liên kết mua</th><th>Tuỳ chọn</th></tr></thead>
                    <tbody>
                      {vs.map((v) => {
                        const ls = links.filter((l) => l.variantId === v.id);
                        return (
                          <tr key={v.id}>
                            <td className="font-semibold">{v.name}</td>
                            <td className="font-mono text-sm">{v.sku}</td>
                            <td><Badge status={v.status} /></td>
                            <td className="text-sm">{ls.length ? ls.map((l) => <span key={l.id} className="mr-2 inline-flex items-center gap-1">{l.channel === "shopee" ? "Shopee" : "TikTok Shop"} <Badge status={l.status} /></span>) : <span className="text-[#B42318]">Chưa có link</span>}</td>
                            <td><Link href={`/admin/products/${p.id}/variants/${v.id}`} className="btn-line btn-sm"><Icon name="pencil" className="h-4 w-4" /> Sửa</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!vs.length && <p className="p-6 text-center text-ink-muted">Chưa có phiên bản — thêm SKU, thành phần, thông số và link mua.</p>}
                </div>
              </Panel>
            )}
          </div>
          <div>
            <Panel title="Hình ảnh sản phẩm">
              <div className="relative aspect-square overflow-hidden rounded-card bg-[#F1F0EE]">
                {cover ? <Image src={cover.url} alt={cover.alt} fill sizes="400px" className="object-contain" unoptimized /> : <span className="flex h-full flex-col items-center justify-center text-ink-muted"><Icon name="image" className="h-10 w-10" /><span className="mt-2 text-sm">Thêm ảnh ở từng phiên bản</span></span>}
                {cover && p?.isSample && <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-1 text-sm">Ảnh minh họa</span>}
              </div>
              <Link href="/admin/media" className="btn-line mt-3 w-full"><Icon name="upload" /> Thư viện ảnh</Link>
            </Panel>
            <Panel title="Trạng thái">
              <Field label="Trạng thái bán" name="status" defaultValue={p?.status ?? "draft"} options={STATUS_OPTS} hint={canPublish ? "Công khai/tạm ngừng có hiệu lực ngay sau khi lưu." : "Đổi trạng thái cần quyền xuất bản sản phẩm."} />
              <div className="mt-4 space-y-3">
                <DemoCheckbox defaultChecked={p?.isSample} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={p?.featured} /> Thiết bị tiêu biểu (trang chủ)</label>
                <Field label="Thứ tự hiển thị" name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} />
              </div>
            </Panel>
            {p && (
              <Panel>
                <LinkRow href={`/admin/products/policies?target=${encodeURIComponent(`product:${p.id}`)}`} icon="file" sub={pol.length ? `${pol.length} chính sách` : "Chưa có chính sách"}>Chính sách áp dụng</LinkRow>
                <LinkRow href={`/admin/products/links?q=${encodeURIComponent(p.name)}`} icon="link">Kiểm tra liên kết mua</LinkRow>
              </Panel>
            )}
          </div>
        </div>
      </ActionForm>
    </>
  );
}
