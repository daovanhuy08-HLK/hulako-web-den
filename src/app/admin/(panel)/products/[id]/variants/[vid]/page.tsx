// Màn 045 Chỉnh sửa phiên bản sản phẩm: tên, SKU, thành phần trong hộp, thông số đã xác nhận, ảnh, liên kết mua theo sàn, trạng thái.
// Lưu qua saveVariant (kiểm SKU, tên miền sàn, quyền thay link công khai, ghi nhật ký thay link).
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requirePage, requireUuid, requireUuidOrNew } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { ActionForm, SubmitFor } from "@/components/admin/ActionForm";
import { SpecsEditor } from "@/components/admin/SpecsEditor";
import { Badge, Field, IconBox, LinkRow, PageTitle, Panel, SampleTag } from "@/components/admin/ui";
import { saveVariant } from "../../../../../actions/products";

export const metadata = { title: "Chỉnh sửa phiên bản" };
const STATUS_OPTS = [{ value: "draft", label: "Bản nháp" }, { value: "public", label: "Công khai" }, { value: "paused", label: "Tạm ngừng bán" }, { value: "archived", label: "Lưu trữ" }];

export default async function EditVariant({ params }: { params: Promise<{ id: string; vid: string }> }) {
  const u = await requirePage("product.edit");
  const { id, vid } = await params;
  requireUuid(id);
  requireUuidOrNew(vid);
  const db = await getDb();
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id));
  if (!p) notFound();
  const isNew = vid === "new";
  const [v] = isNew ? [] : await db.select().from(schema.variants).where(and(eq(schema.variants.id, vid), eq(schema.variants.productId, p.id)));
  if (!isNew && !v) notFound();
  const links = v ? await db.select().from(schema.channelLinks).where(eq(schema.channelLinks.variantId, v.id)) : [];
  const link = (ch: string) => links.find((l) => l.channel === ch);
  const img = v?.images[0];

  return (
    <>
      <PageTitle title={isNew ? "Thêm phiên bản" : "Chỉnh sửa phiên bản"} back={`/admin/products/${p.id}`} subtitle={p.name} tag={p.isSample ? <SampleTag>Dữ liệu mẫu</SampleTag> : undefined}>
        <SubmitFor form="variant-form" label={isNew ? "Thêm phiên bản" : "Lưu phiên bản"} icon="save" />
      </PageTitle>
      <ActionForm action={saveVariant} id="variant-form" toast buttons={null}>
        <input type="hidden" name="productId" value={p.id} /><input type="hidden" name="variantId" value={v?.id ?? ""} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[1.3fr_1fr_120px]">
                <Field label="Tên phiên bản" name="name" defaultValue={v?.name} required placeholder="vd Bộ softbox kèm chân" />
                <Field label="Mã SKU" name="sku" defaultValue={v?.sku} required placeholder="SKU-MAU" />
                <Field label="Thứ tự" name="sortOrder" type="number" defaultValue={v?.sortOrder ?? 0} />
              </div>
              <Field label="Thành phần trong hộp (mỗi dòng 1 món)" name="components" rows={4} defaultValue={v?.components.join("\n")} hint="Nhập đúng cấu hình đã kiểm tra" />
              <div>
                <p className="mb-1.5 text-[15px] font-semibold">Thông số đã xác nhận</p>
                <SpecsEditor initial={v?.specs ?? []} />
                <p className="mt-1 text-xs text-ink-muted">Nhiệt độ màu ghi K. Không ghi công suất W khi chưa đo.</p>
              </div>
              <Field label="Ảnh (mỗi dòng: url | alt | full/box/detail)" name="images" rows={4} defaultValue={v?.images.map((i) => [i.url, i.alt, i.kind].filter(Boolean).join(" | ")).join("\n")}
                hint="Lấy URL từ Thư viện ảnh (ảnh đã duyệt quyền sử dụng). Mỗi ảnh bắt buộc có alt." />
              <div>
                <p className="mb-2 text-[15px] font-semibold">Liên kết mua theo sàn</p>
                <div className="space-y-3">
                  {(["shopee", "tiktok"] as const).map((ch) => (
                    <div key={ch} className="grid items-center gap-3 sm:grid-cols-[180px_1fr]">
                      <span className="flex items-center gap-3 font-medium"><IconBox icon={ch === "shopee" ? "box" : "play"} size="sm" />{ch === "shopee" ? "Shopee" : "TikTok Shop"}{link(ch) && <Badge status={link(ch)!.status} />}</span>
                      <input name={`link_${ch}`} defaultValue={link(ch)?.url} placeholder="https://" className="input" aria-label={`Link ${ch}`} />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-muted">Chỉ dùng URL sản phẩm công khai (không dùng link trang quản trị seller). Thay link của phiên bản đang công khai cần quyền xuất bản và được ghi nhật ký.</p>
              </div>
            </div>
          </Panel>
          <div>
            <Panel>
              <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-[#F1F0EE]">
                {img ? <Image src={img.url} alt={img.alt} fill sizes="400px" className="object-contain" unoptimized /> : <span className="flex h-full items-center justify-center text-ink-muted">Chưa có ảnh</span>}
                {img && p.isSample && <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-1 text-sm">Ảnh minh họa</span>}
              </div>
              <Link href={`/admin/media${v ? `?q=${encodeURIComponent(v.sku)}` : ""}`} className="btn-line mt-3 w-full">Tải lên / chọn ảnh trong Thư viện</Link>
              <div className="mt-5 border-t border-[#EFECE8] pt-4">
                <Field label="Trạng thái" name="status" defaultValue={v?.status ?? "draft"} options={STATUS_OPTS} hint={can(u.roles, "product.publish") ? undefined : "Đổi trạng thái phiên bản cần quyền xuất bản"} />
              </div>
            </Panel>
            {v && (
              <Panel>
                <LinkRow href={`/admin/products/policies?target=${encodeURIComponent(`variant:${v.id}`)}`} icon="file">Chính sách áp dụng</LinkRow>
                <LinkRow href={`/admin/products/links?q=${encodeURIComponent(v.sku)}`} icon="link">Kiểm tra liên kết mua</LinkRow>
              </Panel>
            )}
          </div>
        </div>
      </ActionForm>
    </>
  );
}
