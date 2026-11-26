// A05 Quản lý góc livestream (màn 016): thông tin, ảnh góc live + sơ đồ bố trí, thiết bị sử dụng, bài hướng dẫn liên quan, trạng thái, DEMO.
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, isNotNull } from "drizzle-orm";
import { requirePage, requireUuidOrNew } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { INDUSTRIES, SPACES, STYLES } from "@/lib/catalog";
import { ActionForm, SubmitFor } from "@/components/admin/ActionForm";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { DemoCheckbox, Field, PageTitle, Panel } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { saveSetup } from "../../../actions/products";

export const metadata = { title: "Quản lý góc livestream" };

export default async function EditSetup({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("setup.edit");
  const { id } = await params;
  requireUuidOrNew(id);
  const db = await getDb();
  const isNew = id === "new";
  const [s] = isNew ? [] : await db.select().from(schema.setups).where(eq(schema.setups.id, id));
  if (!isNew && !s) notFound();
  const [variants, articles] = await Promise.all([
    db.select({ id: schema.variants.id, sku: schema.variants.sku, name: schema.variants.name, product: schema.products.name, pstatus: schema.products.status })
      .from(schema.variants).innerJoin(schema.products, eq(schema.products.id, schema.variants.productId)).orderBy(asc(schema.products.name)),
    db.select({ id: schema.articles.id, title: schema.revisions.title }).from(schema.articles)
      .innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId)).where(isNotNull(schema.articles.publishedRevisionId)),
  ]);
  const o = (arr: { value: string; label: string }[]) => [{ value: "", label: "— Chọn —" }, ...arr];
  const Img = ({ url, alt, label }: { url?: string | null; alt?: string; label: string }) => (
    <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-[#F1F0EE]">
      {url ? <Image src={url} alt={alt ?? ""} fill sizes="500px" className="object-cover" unoptimized />
        : <div className="flex h-full flex-col items-center justify-center rounded-card border-2 border-dashed border-line text-center text-ink-muted"><Icon name="upload" className="h-9 w-9" /><p className="mt-2 font-semibold text-ink">{label}</p><p className="text-xs">Dán URL ảnh đã duyệt từ Thư viện ảnh</p></div>}
    </div>
  );

  return (
    <>
      <PageTitle title={isNew ? "Thêm góc livestream" : "Quản lý góc livestream"} back="/admin/setups" subtitle={s?.title}>
        {s?.status === "public" && <Link href={`/goc-livestream/${s.slug}`} target="_blank" className="btn-line"><Icon name="eye" /> Xem trước</Link>}
        <SubmitFor form="setup-form" label={isNew ? "Tạo mẫu" : "Lưu"} icon="save" />
      </PageTitle>
      <ActionForm action={saveSetup} id="setup-form" toast buttons={null}>
        <input type="hidden" name="id" value={s?.id ?? ""} /><input type="hidden" name="version" value={s?.version ?? 0} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <Panel>
              <div className="space-y-4">
                <Field label="Tiêu đề" name="title" defaultValue={s?.title} required />
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Không gian" name="space" defaultValue={s?.space} options={o(SPACES)} required />
                  <Field label="Ngành hàng" name="industry" defaultValue={s?.industry} options={o(INDUSTRIES)} required />
                  <Field label="Kiểu quay" name="style" defaultValue={s?.style} options={o(STYLES)} required />
                </div>
                <Field label="Mô tả ngắn / bối cảnh" name="summary" defaultValue={s?.summary} rows={2} />
                <Field label="Đường dẫn (slug)" name="slug" defaultValue={s?.slug} hint="Đổi slug mẫu đang công khai sẽ tạo 301" />
              </div>
            </Panel>
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Hình ảnh góc livestream" className="!mb-5">
                <Img url={s?.coverUrl} alt={s?.coverAlt} label="Ảnh góc live" />
                <div className="mt-3 space-y-3"><Field label="URL ảnh" name="coverUrl" defaultValue={s?.coverUrl} /><Field label="Alt ảnh" name="coverAlt" defaultValue={s?.coverAlt} /></div>
              </Panel>
              <Panel title="Sơ đồ bố trí" className="!mb-5">
                <Img url={s?.diagramUrl} label="Sơ đồ bố trí đèn" />
                <div className="mt-3"><Field label="URL ảnh sơ đồ" name="diagramUrl" defaultValue={s?.diagramUrl} hint="PNG/JPG đã tải lên Thư viện ảnh" /></div>
              </Panel>
            </div>
            <Panel title="Bố trí">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Điều kiện phòng" name="roomConditions" defaultValue={s?.roomConditions} rows={3} />
                <Field label="Góc máy" name="cameraAngle" defaultValue={s?.cameraAngle} rows={3} />
                <Field label="Vị trí đèn và người" name="lightPosition" defaultValue={s?.lightPosition} rows={3} />
              </div>
              <div className="mt-4 space-y-4">
                <Field label="Các bước bố trí (mỗi dòng một bước)" name="steps" defaultValue={s?.steps.join("\n")} rows={6} />
                <Field label="Điều kiện quay thực tế khi so sánh trước/sau" name="demoNote" defaultValue={s?.demoNote} rows={2} />
                <MarkdownField label="Nội dung thêm" name="body" defaultValue={s?.body} rows={6} />
              </div>
            </Panel>
            <Panel title="Thiết bị sử dụng">
              <div className="adm-scroll max-h-72 space-y-2 overflow-auto">{variants.map((v) => (
                <label key={v.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                  <Icon name="grip" className="h-4 w-4 text-ink-muted" />
                  <input type="checkbox" name="variantIds" value={v.id} defaultChecked={s?.variantIds.includes(v.id)} />
                  <span className="flex-1">{v.product} — {v.name} <span className="font-mono text-xs text-ink-muted">({v.sku})</span></span>
                  {v.pstatus !== "public" && <em className="text-xs text-[#8A5A00]">{v.pstatus === "draft" ? "nháp" : v.pstatus}</em>}
                </label>
              ))}{!variants.length && <p className="text-ink-muted">Chưa có phiên bản thiết bị. <Link href="/admin/products" className="text-brand-dark underline">Thêm sản phẩm</Link></p>}</div>
            </Panel>
          </div>
          <div>
            <Panel title="Trạng thái">
              <Field label="Trạng thái" name="status" defaultValue={s?.status ?? "draft"} options={[{ value: "draft", label: "Bản nháp" }, { value: "public", label: "Công khai" }, { value: "archived", label: "Lưu trữ" }]} />
              <div className="mt-4 space-y-3">
                <DemoCheckbox defaultChecked={s?.isSample} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={s?.featured} /> Nổi bật</label>
              </div>
            </Panel>
            <Panel title="Bài hướng dẫn liên quan">
              <div className="adm-scroll max-h-96 space-y-2 overflow-auto">{articles.map((a) => (
                <label key={a.id} className="flex items-center gap-3 border-t border-[#EFECE8] py-2.5 first:border-0">
                  <input type="checkbox" name="relatedArticleIds" value={a.id} defaultChecked={s?.relatedArticleIds.includes(a.id)} />
                  <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon name="play" className="h-5 w-5" /></span>
                  <span className="text-[15px]">{a.title}</span>
                </label>
              ))}{!articles.length && <p className="text-sm text-ink-muted">Chưa có bài đã xuất bản.</p>}</div>
            </Panel>
          </div>
        </div>
      </ActionForm>
    </>
  );
}
