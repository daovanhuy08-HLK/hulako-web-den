// Màn 033 Chi tiết yêu cầu tư vấn: thông tin liên hệ, nội dung + bối cảnh góc live, người phụ trách/trạng thái/ghi chú, lịch sử xử lý.
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { requirePage, requireUuid } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { Badge, EmptyState, Panel, PageTitle, SampleTag } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { eraseLead, updateLead } from "../../../../actions/ops";

export const metadata = { title: "Chi tiết yêu cầu tư vấn" };
const SOURCE: Record<string, string> = { contact: "Liên hệ", product: "Trang sản phẩm", article: "Bài viết", selector: "Chọn đèn theo phòng", support: "Hỗ trợ", lead_magnet: "Đăng ký quà tặng" };
const STATUS: Record<string, string> = { new: "Mới", assigned: "Đã phân công", in_progress: "Đang xử lý", resolved: "Đã xử lý", closed: "Đóng" };

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage("lead.view");
  const { id } = await params;
  requireUuid(id);
  const db = await getDb();
  const [l] = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
  if (!l) notFound();
  if (!u.roles.includes("admin") && l.assigneeId && l.assigneeId !== u.id) notFound();
  const staff = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users)
    .where(sql`${schema.users.roles} ?| array['consultant','admin']`);
  const name = (uid?: string) => staff.find((s) => s.id === uid)?.name || staff.find((s) => s.id === uid)?.email || "";
  const ctx = l.context as Record<string, unknown>;
  const photoId = typeof ctx.roomPhotoId === "string" ? ctx.roomPhotoId : null;
  const ctxChips = Object.entries(ctx).filter(([k]) => k !== "roomPhotoId" && !/owned|thiet bi dang co|thiết bị đang có/i.test(k));
  const owned = Object.entries(ctx).find(([k]) => /owned|thiết bị đang có|thiet bi dang co/i.test(k))?.[1];
  const timeline = [...l.notes.map((n) => ({ ...n, kind: "note" as const })), ...l.history.map((h) => ({ ...h, kind: "history" as const }))].sort((a, b) => b.at.localeCompare(a.at));
  const Box = ({ children }: { children: React.ReactNode }) => <p className="rounded-[10px] bg-[#F4F1ED] px-4 py-3">{children}</p>;

  return (
    <>
      <PageTitle title="Chi tiết yêu cầu tư vấn" back="/admin/support" tag={<span className="flex items-center gap-2"><SampleTag>{l.code}</SampleTag><Badge status={l.status} /></span>} />
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Thông tin liên hệ" icon="user" className="!mb-0">
          <div className="space-y-4">
            <div><p className="mb-1.5 font-semibold">Tên khách hàng</p><Box>{l.name}</Box></div>
            <div><p className="mb-1.5 font-semibold">Điện thoại</p><Box>{l.phone ?? "—"}</Box></div>
            <div><p className="mb-1.5 font-semibold">Email</p><Box>{l.email ?? "—"}</Box></div>
            {l.businessField && <div><p className="mb-1.5 font-semibold">Lĩnh vực kinh doanh</p><Box>{l.businessField}</Box></div>}
            {l.shippingAddress && <div><p className="mb-1.5 font-semibold">Địa chỉ nhận hàng</p><Box><span className="whitespace-pre-wrap">{l.shippingAddress}</span></Box></div>}
            <p className="text-xs text-ink-muted">Đồng ý xử lý dữ liệu · thông báo phiên bản {l.consentVersion} · lưu tới {formatDateTimeVN(l.retainUntil)}</p>
          </div>
        </Panel>
        <Panel title="Nội dung yêu cầu" icon="message" className="!mb-0">
          <div className="space-y-4">
            <Box><span className="whitespace-pre-wrap">{l.message}</span></Box>
            <div><p className="mb-2 font-semibold">Bối cảnh góc live</p>
              <div className="flex flex-wrap gap-2">{ctxChips.length ? ctxChips.map(([k, v]) => <span key={k} className="rounded-full bg-brand-soft px-3.5 py-1.5 text-sm text-brand-dark">{k}: {String(v)}</span>) : <span className="text-ink-muted">—</span>}</div>
              {photoId && <div className="mt-4"><p className="mb-2 text-sm font-semibold">Ảnh phòng khách gửi (riêng tư)</p>{/* eslint-disable-next-line @next/next/no-img-element */}<a href={`/api/admin/lead-photo/${photoId}`} target="_blank" rel="noopener"><img src={`/api/admin/lead-photo/${photoId}`} alt="Ảnh phòng khách gửi kèm yêu cầu" className="max-h-72 rounded-xl border border-line" /></a></div>}</div>
            <p><b>Nguồn:</b> {SOURCE[l.source] ?? l.source} · <b>Chủ đề:</b> {l.topic}</p>
            <div><p className="mb-1.5 font-semibold">Thiết bị đang có</p><Box>{owned ? String(owned) : "Chưa xác định"}</Box></div>
            <p className="text-xs text-ink-muted">Email báo nội bộ: {l.notifyStatus}{l.notifyError ? ` (${l.notifyError})` : ""}</p>
          </div>
        </Panel>
        <Panel title="Người phụ trách" icon="briefcase" className="!mb-0">
          <ActionForm action={updateLead} buttons={<button className="btn-primary w-full">Lưu cập nhật</button>}>
            <input type="hidden" name="id" value={l.id} />
            <select name="assigneeId" defaultValue={l.assigneeId ?? ""} className="input" aria-label="Người phụ trách"><option value="">Chọn người phụ trách</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}</select>
            <p className="mb-1.5 mt-4 font-semibold">Trạng thái</p>
            <select name="status" defaultValue={l.status} className="input" aria-label="Trạng thái">{Object.entries(STATUS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            <p className="mb-1.5 mt-4 font-semibold">Ghi chú nội bộ</p>
            <textarea name="note" rows={4} className="input" placeholder="Nhập ghi chú nội bộ" aria-label="Ghi chú nội bộ" />
          </ActionForm>
        </Panel>
      </div>
      <Panel title="Lịch sử xử lý" icon="clock" className="mt-5">
        {timeline.length ? (
          <ol className="space-y-2">
            {timeline.map((h, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl bg-[#F7F5F2] px-4 py-3">
                <Icon name={h.kind === "note" ? "file" : "refresh"} className="mt-0.5 h-5 w-5 text-brand" />
                <div><p className="text-sm text-ink-muted">{formatDateTimeVN(h.at)}{h.by ? ` · ${name(h.by) || h.by}` : ""}</p>
                  <p>{h.status ? `Trạng thái → ${STATUS[h.status] ?? h.status}` : ""} {h.note?.startsWith("Phân công:") ? `Phân công: ${name(h.note.replace("Phân công: ", "")) || h.note.replace("Phân công: ", "")}` : h.note}</p></div>
              </li>
            ))}
          </ol>
        ) : <EmptyState icon="file" title="Chưa có cập nhật" />}
      </Panel>
      {u.roles.includes("admin") && (
        <div className="flex justify-end"><ActionButton action={eraseLead} label="Xoá dữ liệu cá nhân (theo yêu cầu khách)" icon="trash" className="btn-ghost text-red-700" confirm="Xoá vĩnh viễn yêu cầu này? Không thể khôi phục." fields={{ id: l.id }} /></div>
      )}
    </>
  );
}
