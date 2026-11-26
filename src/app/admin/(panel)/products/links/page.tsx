// Màn 055 Kiểm tra liên kết mua (bảng channel_links): lọc theo kênh/trạng thái, mở link, sửa link (cần quyền xuất bản nếu đang công khai),
// kiểm tra thủ công (gọi thử đích) hoặc xác nhận đã mở đúng sản phẩm. Thay link được ghi nhật ký.
import Image from "next/image";
import Link from "next/link";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { Badge, EmptyState, PageTitle, Panel, SampleTag, SearchInput, Table } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { checkChannelLink, confirmChannelLink, updateChannelLink } from "../../../actions/extra";

export const metadata = { title: "Kiểm tra liên kết mua" };

export default async function LinksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("product.edit");
  const sp = await searchParams;
  const db = await getDb();
  const where: SQL[] = [];
  if (sp.q) where.push(or(ilike(schema.products.name, `%${sp.q}%`), ilike(schema.variants.sku, `%${sp.q}%`))!);
  if (sp.channel === "shopee" || sp.channel === "tiktok") where.push(eq(schema.channelLinks.channel, sp.channel));
  if (sp.status === "unchecked") where.push(isNull(schema.channelLinks.checkedAt));
  else if (sp.status && ["ok", "pending_check", "broken"].includes(sp.status)) where.push(eq(schema.channelLinks.status, sp.status));
  const [rows, missing] = await Promise.all([
    db.select({ l: schema.channelLinks, sku: schema.variants.sku, vname: schema.variants.name, vstatus: schema.variants.status, images: schema.variants.images, pid: schema.products.id, pname: schema.products.name, sample: schema.products.isSample })
      .from(schema.channelLinks).innerJoin(schema.variants, eq(schema.variants.id, schema.channelLinks.variantId))
      .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
      .where(where.length ? and(...where) : undefined).orderBy(asc(schema.products.name), asc(schema.variants.sku)).limit(300),
    db.select({ vid: schema.variants.id, sku: schema.variants.sku, pid: schema.products.id, pname: schema.products.name, vstatus: schema.variants.status }).from(schema.variants)
      .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
      .where(and(sql`${schema.variants.status} in ('public','draft')`, sql`not exists (select 1 from channel_links l where l.variant_id = ${schema.variants.id} and l.status = 'ok')`,
        ...(sp.q ? [or(ilike(schema.products.name, `%${sp.q}%`), ilike(schema.variants.sku, `%${sp.q}%`))!] : []))).limit(100),
  ]);
  const sel = rows.find((r) => r.l.id === sp.id) ?? null;
  const qs = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][])}`;
  const st = (r: (typeof rows)[number]) => (r.l.checkedAt ? r.l.status : "unchecked");

  return (
    <>
      <PageTitle title="Kiểm tra liên kết mua" back="/admin/products" />
      <form className="mb-5 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
        <SearchInput defaultValue={sp.q} placeholder="Tìm sản phẩm hoặc SKU" />
        <select name="channel" defaultValue={sp.channel ?? ""} className="input" aria-label="Kênh bán"><option value="">Kênh bán: tất cả</option><option value="shopee">Shopee</option><option value="tiktok">TikTok Shop</option></select>
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Trạng thái"><option value="">Trạng thái: tất cả</option><option value="ok">Hoạt động</option><option value="pending_check">Cần kiểm tra lại</option><option value="broken">Liên kết lỗi</option><option value="unchecked">Chưa kiểm tra</option><option value="missing">Thiếu liên kết</option></select>
        <button className="btn-line">Lọc</button>
      </form>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {(sp.status === "missing" || (missing.length > 0 && !sp.status)) && (
            <Panel title={`Phiên bản chưa có liên kết hoạt động (${missing.length})`} icon="alert">
              {missing.length ? (
                <ul className="divide-y divide-[#EFECE8]">{missing.map((m) => (
                  <li key={m.vid} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><b>{m.pname}</b> · <span className="font-mono text-sm">{m.sku}</span> <Badge status={m.vstatus} /></span>
                    <Link href={`/admin/products/${m.pid}/variants/${m.vid}`} className="btn-line btn-sm"><Icon name="plus" className="h-4 w-4" /> Thêm link</Link></li>
                ))}</ul>
              ) : <p className="text-ink-muted">Mọi phiên bản đều có liên kết.</p>}
            </Panel>
          )}
          {sp.status !== "missing" && (
            <Table head={["Sản phẩm", "Phiên bản", "Kênh", "Trạng thái", "Thao tác"]} empty={!rows.length} emptyText="Chưa có liên kết mua nào khớp bộ lọc.">
              {rows.map((r) => {
                const img = r.images[0];
                return (
                  <tr key={r.l.id} className={r.l.id === sel?.l.id ? "is-active" : ""}>
                    <td><Link href={qs({ id: r.l.id })} className="flex items-center gap-3 hover:text-brand-dark">
                      <span className="relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-[#F1F0EE]">{img && <Image src={img.url} alt={img.alt} fill sizes="56px" className="object-contain" unoptimized />}</span>
                      <span><b>{r.pname}</b>{r.sample && <span className="ml-2"><SampleTag>Mẫu</SampleTag></span>}</span></Link></td>
                    <td className="whitespace-nowrap font-mono text-sm">{r.sku}</td>
                    <td className="whitespace-nowrap">{r.l.channel === "shopee" ? "Shopee" : "TikTok Shop"}</td>
                    <td><Badge status={st(r)} /></td>
                    <td className="whitespace-nowrap">
                      <a href={r.l.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-line btn-sm mr-2"><Icon name="external" className="h-4 w-4" /> Mở liên kết</a>
                      <Link href={qs({ id: r.l.id })} className="btn-line btn-sm"><Icon name="pencil" className="h-4 w-4" /> Chỉnh sửa</Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
        <aside className="card h-fit p-5">
          {sel ? (
            <>
              <h2 className="text-xl font-bold">Liên kết công khai</h2>
              <p className="mt-1 text-sm text-ink-muted">{sel.pname} · {sel.sku} · {sel.l.channel === "shopee" ? "Shopee" : "TikTok Shop"}</p>
              <ActionForm action={updateChannelLink} key={sel.l.id} buttons={<button className="btn-primary w-full"><Icon name="download" /> Lưu liên kết</button>}>
                <input type="hidden" name="id" value={sel.l.id} />
                <div className="relative mt-4">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name="link" /></span>
                  <input name="url" defaultValue={sel.l.url} className="input pl-11" aria-label="Liên kết công khai" placeholder="https://" />
                </div>
                <p className="mt-2 text-xs text-ink-muted">{sel.vstatus === "public" ? "Phiên bản đang công khai — thay link cần quyền xuất bản và được ghi nhật ký." : "Thay link được ghi nhật ký."}</p>
              </ActionForm>
              <h3 className="mt-6 font-bold">Ngày kiểm tra gần nhất</h3>
              <p className="mt-1 text-ink-soft">{sel.l.checkedAt ? formatDateTimeVN(sel.l.checkedAt) : "—"} <Badge status={st(sel)} /></p>
              <div className="mt-4 grid gap-2">
                <ActionButton action={checkChannelLink} label="Kiểm tra thủ công" icon="refresh" className="btn-line w-full" fields={{ id: sel.l.id }} />
                <ActionButton action={confirmChannelLink} label="Tôi đã mở và xác nhận đúng sản phẩm" icon="check" className="btn-ghost btn-sm w-full" fields={{ id: sel.l.id }} />
              </div>
              <p className="mt-3 text-xs text-ink-muted">Sàn có thể chặn kiểm tra tự động — khi đó trạng thái là “Cần kiểm tra lại”, hãy mở link bằng tay rồi xác nhận.</p>
            </>
          ) : <EmptyState icon="link" title="Chọn một liên kết" text="Bấm Chỉnh sửa ở một dòng để sửa link, kiểm tra đích và xem ngày kiểm tra gần nhất." />}
        </aside>
      </div>
    </>
  );
}
