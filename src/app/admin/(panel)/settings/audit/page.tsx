// Màn 039 Nhật ký hệ thống (bảng audit_logs): lọc người thao tác / loại hành động / thời gian, chi tiết thay đổi trước–sau.
import Link from "next/link";
import { and, desc, eq, gte, like, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { EmptyState, PageTitle, Panel, Table } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";

export const metadata = { title: "Nhật ký hệ thống" };
const PAGE = 50;
const ACTION: Record<string, [string, string]> = {
  "article.create": ["Tạo bài viết", "file"], "article.save": ["Lưu bản nháp", "file"], "article.submit": ["Gửi duyệt", "send"], "article.approve": ["Duyệt bài", "checkCircle"],
  "article.request_changes": ["Yêu cầu sửa", "message"], "article.schedule": ["Lên lịch đăng", "calendar"], "article.publish": ["Xuất bản bài", "send"], "article.unpublish": ["Gỡ bài", "x"],
  "article.archive": ["Lưu trữ bài", "download"], "article.restore": ["Khôi phục phiên bản", "history"], "article.delete": ["Xoá bản nháp", "trash"],
  "product.create": ["Tạo sản phẩm", "layers"], "product.save": ["Lưu sản phẩm", "layers"], "product.status": ["Đổi trạng thái bán", "layers"],
  "channel_link.change": ["Cập nhật liên kết mua", "link"], "channel_link.check": ["Kiểm tra liên kết", "link"], "channel_link.confirm": ["Xác nhận liên kết", "link"],
  "setup.create": ["Tạo góc live", "play"], "setup.save": ["Lưu góc live", "play"], "rules.new_version": ["Tạo phiên bản quy tắc", "sliders"], "rules.activate": ["Kích hoạt quy tắc", "sliders"],
  "media.upload": ["Tải ảnh lên", "image"], "media.approve": ["Duyệt ảnh", "image"], "media.archive": ["Lưu trữ ảnh", "image"],
  "user.create": ["Tạo tài khoản", "user"], "user.roles": ["Đổi quyền tài khoản", "shield"], "user.reset_link": ["Tạo link đặt lại mật khẩu", "key"],
  "auth.login": ["Đăng nhập", "lock"], "auth.setup_password": ["Đặt mật khẩu lần đầu", "lock"], "auth.reset_password": ["Đặt lại mật khẩu", "key"], "auth.reset_request": ["Yêu cầu khôi phục mật khẩu", "key"],
  "policy.save": ["Lưu chính sách", "file"], "policy.approve": ["Duyệt chính sách", "checkCircle"], "policy.delete": ["Xoá chính sách", "trash"],
  "lead.erase": ["Xoá dữ liệu khách", "trash"], "application.erase": ["Xoá hồ sơ & CV", "trash"], "job.save": ["Lưu tin tuyển dụng", "briefcase"],
  "prompt.activate": ["Kích hoạt hướng dẫn viết", "sparkles"], "prompt.create": ["Tạo hướng dẫn viết", "sparkles"], "ai_job.create": ["Tạo tác vụ AI", "bot"],
  "index.publish": ["Báo công cụ tìm kiếm: trang mới", "globe"], "index.unpublish": ["Báo công cụ tìm kiếm: gỡ trang", "globe"],
  "learning.run": ["Chạy vòng học AI", "refresh"], "learning.config": ["Cấu hình vòng học AI", "sliders"], "learning.revert": ["Hoàn tác vòng học AI", "history"],
  "faq.save": ["Lưu câu hỏi FAQ", "headset"], "leads.export": ["Tải CSV yêu cầu tư vấn", "download"], "lead.photo_view": ["Xem ảnh góc live của khách", "image"],
  "cv.download": ["Tải CV ứng viên", "download"], "opportunity.dismiss": ["Bỏ qua cơ hội SEO", "x"], "opportunity.manual": ["Thêm cơ hội SEO", "plus"],
  "opportunity.update": ["Cập nhật cơ hội SEO", "search"], "redirect.save": ["Lưu chuyển hướng", "link"], "topic.save": ["Lưu chủ đề", "folder"], "topic.delete": ["Xoá chủ đề", "trash"],
  "settings.agent": ["Cài đặt AI agent", "settings"], "settings.channels": ["Cài đặt kênh liên hệ", "settings"], "settings.company": ["Cài đặt thông tin công ty", "settings"],
  "settings.consent": ["Cài đặt đồng ý dữ liệu", "settings"], "settings.home": ["Cài đặt trang chủ", "settings"], "settings.lead_magnet": ["Cài đặt popup quà tặng", "settings"],
  "settings.notify": ["Cài đặt thông báo", "settings"], "settings.schedule": ["Cài đặt lịch tự động", "settings"],
};
const GROUPS: [string, string][] = [["", "Tất cả"], ["article.", "Nội dung"], ["product.", "Sản phẩm"], ["channel_link.", "Liên kết mua"], ["setup.", "Góc live"], ["rules.", "Quy tắc chọn đèn"], ["media.", "Thư viện ảnh"], ["user.", "Tài khoản & quyền"], ["auth.", "Đăng nhập"], ["settings.", "Cài đặt"], ["policy.", "Chính sách"], ["lead.", "Tư vấn"], ["job.", "Tuyển dụng"], ["application.", "Hồ sơ ứng viên"], ["prompt.", "Hướng dẫn viết"], ["ai_job.", "Tác vụ AI"], ["topic.", "Chủ đề"], ["opportunity.", "Cơ hội SEO"], ["redirect.", "Chuyển hướng"], ["index.", "Báo lập chỉ mục"], ["learning.", "Vòng học AI"], ["faq.", "Hỏi đáp"], ["cv.", "CV ứng viên"]];
const label = (a: string) => ACTION[a]?.[0] ?? a;
const show = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("settings.edit");
  const sp = await searchParams;
  const db = await getDb();
  const where: SQL[] = [];
  if (sp.user) where.push(eq(schema.auditLogs.userId, sp.user));
  if (sp.type) where.push(like(schema.auditLogs.action, `${sp.type}%`));
  const days = Number(sp.days);
  if ([1, 7, 30, 90].includes(days)) where.push(gte(schema.auditLogs.createdAt, new Date(Date.now() - days * 86400_000)));
  const page = Math.max(1, Number(sp.page) || 1);
  const [rows, users] = await Promise.all([
    db.select({ l: schema.auditLogs, email: schema.users.email, name: schema.users.name }).from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.userId)).where(where.length ? and(...where) : undefined)
      .orderBy(desc(schema.auditLogs.createdAt)).limit(PAGE + 1).offset((page - 1) * PAGE),
    db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name }).from(schema.users),
  ]);
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const sel = list.find((r) => r.l.id === sp.id) ?? null;
  const qs = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][])}`;
  const changes = sel?.l.changes ?? null;
  const diffRows: [string, unknown, unknown][] = [];
  if (changes && ("from" in changes || "to" in changes)) {
    diffRows.push([sel!.l.action.startsWith("channel_link") ? `Liên kết ${show(changes.channel)}` : sel!.l.action.startsWith("user") ? "Vai trò" : "Trạng thái / giá trị", changes.from, changes.to]);
  }
  if (changes) for (const [k, v] of Object.entries(changes)) if (!["from", "to", "channel"].includes(k)) diffRows.push([k, undefined, v]);

  return (
    <>
      <PageTitle title="Nhật ký hệ thống" subtitle="Ghi lại xuất bản, đổi quyền, thay link mua và các thao tác quản trị khác. Trường nhạy cảm được loại khỏi nhật ký." />
      <SettingsTabs current="audit" />
      <form className="card mb-5 grid gap-4 p-5 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div><label htmlFor="a-user" className="mb-1.5 block font-semibold">Người thao tác</label><select id="a-user" name="user" defaultValue={sp.user ?? ""} className="input"><option value="">Tất cả</option>{users.map((x) => <option key={x.id} value={x.id}>{x.name || x.email}</option>)}</select></div>
        <div><label htmlFor="a-type" className="mb-1.5 block font-semibold">Loại hành động</label><select id="a-type" name="type" defaultValue={sp.type ?? ""} className="input">{GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label htmlFor="a-days" className="mb-1.5 block font-semibold">Thời gian</label><select id="a-days" name="days" defaultValue={sp.days ?? ""} className="input"><option value="">Tất cả thời gian</option><option value="1">24 giờ qua</option><option value="7">7 ngày qua</option><option value="30">30 ngày qua</option><option value="90">90 ngày qua</option></select></div>
        <button className="btn-primary self-end"><Icon name="search" /> Lọc nhật ký</button>
      </form>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
        <div>
          <Table head={["Hành động", "Đối tượng", "Tài khoản", "Thời gian", "Chi tiết"]} empty={!list.length} emptyText="Chưa có nhật ký khớp bộ lọc.">
            {list.map(({ l, email, name }) => (
              <tr key={l.id} className={l.id === sel?.l.id ? "is-active" : ""}>
                <td><span className="flex items-center gap-3 font-semibold"><span className="text-brand"><Icon name={ACTION[l.action]?.[1] ?? "file"} /></span>{label(l.action)}</span></td>
                <td className="text-sm">{l.entityType} <span className="font-mono text-xs text-ink-muted">{l.entityId?.slice(0, 12)}</span></td>
                <td className="text-sm">{name || email || "Hệ thống"}</td>
                <td className="whitespace-nowrap text-sm text-ink-muted">{formatDateTimeVN(l.createdAt)}</td>
                <td><Link href={qs({ id: l.id })} className="rounded-full bg-[#EFEDEA] px-4 py-1.5 text-sm font-semibold hover:bg-brand-soft">Xem</Link></td>
              </tr>
            ))}
          </Table>
          <div className="mt-4 flex items-center gap-3 text-sm">
            {page > 1 && <Link href={qs({ page: String(page - 1), id: undefined })} className="btn-line btn-sm">← Mới hơn</Link>}
            <span className="text-ink-muted">Trang {page}</span>
            {more && <Link href={qs({ page: String(page + 1), id: undefined })} className="btn-line btn-sm">Cũ hơn →</Link>}
          </div>
        </div>
        <Panel title="Chi tiết thay đổi" className="!mb-0 h-fit">
          {sel ? (
            <>
              <p className="mb-3 text-sm text-ink-muted">{label(sel.l.action)} · {sel.name || sel.email || "Hệ thống"} · {formatDateTimeVN(sel.l.createdAt)}</p>
              {diffRows.length ? (
                <table className="adm-table"><thead><tr><th>Trường dữ liệu</th><th>Giá trị trước</th><th>Giá trị sau</th></tr></thead>
                  <tbody>{diffRows.map(([k, a, b], i) => (
                    <tr key={i}><td className="font-semibold">{k}</td>
                      <td>{a === undefined ? "" : <span className="inline-block max-w-[180px] break-all rounded-full bg-[#EFEDEA] px-3 py-1 text-sm">{show(a)}</span>}</td>
                      <td><span className="inline-block max-w-[180px] break-all rounded-full bg-brand-soft px-3 py-1 text-sm text-brand-dark">{show(b)}</span></td></tr>
                  ))}</tbody></table>
              ) : <p className="text-ink-muted">Không có chi tiết thay đổi được ghi.</p>}
              <p className="mt-3 text-xs text-ink-muted">Đối tượng: {sel.l.entityType} {sel.l.entityId}</p>
            </>
          ) : <EmptyState icon="history" title="Chọn một dòng" text="Bấm “Xem” để xem giá trị trước và sau." />}
        </Panel>
      </div>
    </>
  );
}
