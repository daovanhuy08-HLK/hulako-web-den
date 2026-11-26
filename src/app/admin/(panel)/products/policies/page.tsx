// Màn 054 Chính sách theo sản phẩm (bảng policies): phạm vi sản phẩm / phiên bản / kênh bán, nội dung, ngày hiệu lực, nháp → duyệt.
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { formatDateVN, VN_TZ } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { Badge, Field, PageTitle, Panel, SampleTag } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { deletePolicy, savePolicy } from "../../../actions/extra";

export const metadata = { title: "Chính sách theo sản phẩm" };
const CH: Record<string, string> = { shopee: "Kênh Shopee", tiktok: "Kênh TikTok Shop", website: "Tư vấn qua website" };
const ymd = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(d) : "");

export default async function Policies({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage("product.edit");
  const sp = await searchParams;
  const db = await getDb();
  const [list, products, variants] = await Promise.all([
    db.select().from(schema.policies).orderBy(desc(schema.policies.validFrom), asc(schema.policies.title)),
    db.select({ id: schema.products.id, name: schema.products.name, isSample: schema.products.isSample }).from(schema.products).orderBy(asc(schema.products.name)),
    db.select({ id: schema.variants.id, sku: schema.variants.sku, name: schema.variants.name, product: schema.products.name }).from(schema.variants)
      .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId)).orderBy(asc(schema.products.name)),
  ]);
  const cur = sp.id === "new" ? undefined : list.find((p) => p.id === sp.id);
  const target = cur ? `${cur.scope}:${cur.refId}` : sp.target ?? "";
  const scopeLabel = (scope: string, ref: string) => scope === "product" ? `Sản phẩm: ${products.find((p) => p.id === ref)?.name ?? "?"}`
    : scope === "variant" ? `Phiên bản: ${variants.find((v) => v.id === ref)?.sku ?? "?"}` : CH[ref] ?? `Kênh ${ref}`;
  const canApprove = can(u.roles, "product.publish");
  const show = !!cur || sp.id === "new" || !!sp.target || !list.length;

  return (
    <>
      <PageTitle title="Chính sách theo sản phẩm" back="/admin/products" tag={<SampleTag tone="muted">Nội dung chính sách phải được xác nhận</SampleTag>}>
        <Link href="/admin/products/policies?id=new" className="btn-primary"><Icon name="plus" /> Thêm chính sách</Link>
      </PageTitle>
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="card h-fit p-3">
          {list.map((p) => (
            <Link key={p.id} href={`?id=${p.id}`} className={`mb-1 flex items-start justify-between gap-2 rounded-xl px-3 py-3 ${p.id === cur?.id ? "bg-brand-soft" : "hover:bg-black/[.03]"}`}>
              <span className="min-w-0"><span className={`block font-semibold ${p.id === cur?.id ? "text-brand-dark" : ""}`}>{p.title}</span><span className="block truncate text-xs text-ink-muted">{scopeLabel(p.scope, p.refId)}</span></span>
              <Badge status={p.status === "approved" ? "approved" : "draft"} />
            </Link>
          ))}
          {!list.length && <p className="p-4 text-sm text-ink-muted">Chưa có chính sách. Nhập nội dung đã được xác nhận (đổi trả, bảo hành, vận chuyển…) cho đúng phạm vi.</p>}
        </aside>
        {show ? (
          <ActionForm action={savePolicy} buttons={null} key={cur?.id ?? "new"}>
            <input type="hidden" name="id" value={cur?.id ?? ""} />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Panel className="!mb-0">
                <div className="space-y-4">
                  <Field label="Tên chính sách" name="title" defaultValue={cur?.title} required placeholder="vd Đổi trả trong 7 ngày" />
                  <div>
                    <label htmlFor="pol-target" className="mb-1.5 block text-[15px] font-semibold">Phạm vi áp dụng <span className="text-brand">*</span></label>
                    <select id="pol-target" name="target" defaultValue={target} className="input">
                      <option value="">Chọn sản phẩm, phiên bản hoặc kênh bán</option>
                      <optgroup label="Sản phẩm">{products.map((p) => <option key={p.id} value={`product:${p.id}`}>{p.name}{p.isSample ? " (mẫu)" : ""}</option>)}</optgroup>
                      <optgroup label="Phiên bản">{variants.map((v) => <option key={v.id} value={`variant:${v.id}`}>{v.product} — {v.name} ({v.sku})</option>)}</optgroup>
                      <optgroup label="Kênh bán">{Object.entries(CH).map(([k, l]) => <option key={k} value={`channel:${k}`}>{l}</option>)}</optgroup>
                    </select>
                  </div>
                  <MarkdownField label="Nội dung chính sách" name="content" defaultValue={cur?.content} rows={10} required />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Ngày hiệu lực" name="validFrom" type="date" defaultValue={ymd(cur?.validFrom ?? null)} />
                    <Field label="Hết hiệu lực (nếu có)" name="validTo" type="date" defaultValue={ymd(cur?.validTo ?? null)} />
                  </div>
                  <p className="flex items-center gap-2 text-sm text-ink-muted"><Icon name="info" className="h-4 w-4" /> Nhập nội dung đã được xác nhận cho đúng phạm vi. Không ghi cam kết chưa được duyệt.</p>
                </div>
              </Panel>
              <Panel className="!mb-0 h-fit">
                <p className="mb-2 font-semibold">Trạng thái</p>
                <Badge status={cur?.status === "approved" ? "approved" : "draft"} />
                {cur?.validFrom && <p className="mt-3 text-sm text-ink-muted">Hiệu lực từ {formatDateVN(cur.validFrom)}{cur.validTo ? ` đến ${formatDateVN(cur.validTo)}` : ""}</p>}
                <p className="mt-5 font-semibold">Người duyệt</p>
                <p className="text-sm text-ink-muted">{canApprove ? "Bạn có quyền duyệt chính sách." : "Cần người có quyền xuất bản sản phẩm duyệt."}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button type="submit" name="then" value="draft" className="btn-line">Lưu nháp</button>
                  <button type="submit" name="then" value="approve" className="btn-primary" disabled={!canApprove}>Duyệt</button>
                </div>
                {cur && <div className="mt-4 border-t border-line pt-4"><ActionButton action={deletePolicy} label="Xoá chính sách" className="btn-ghost btn-sm text-red-700" confirm="Xoá chính sách này?" fields={{ id: cur.id }} /></div>}
              </Panel>
            </div>
          </ActionForm>
        ) : (
          <div className="card flex items-center justify-center p-10 text-ink-muted">Chọn một chính sách bên trái hoặc bấm “Thêm chính sách”.</div>
        )}
      </div>
    </>
  );
}
