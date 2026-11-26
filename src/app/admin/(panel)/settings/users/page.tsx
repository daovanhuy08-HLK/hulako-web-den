// Màn 032 Tài khoản và phân quyền. Vai trò & quyền theo bảng PERMS (mục 07 đặc tả) — ma trận chỉ để XEM,
// checkbox trong mockup chỉ là hình thức. Gán vai trò cho tài khoản ở thẻ Tài khoản (ghi nhật ký user.roles).
import Link from "next/link";
import { asc } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can, ROLE_LABELS, type Perm } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { ROLES, type Role } from "@/lib/db/schema";
import { resetEmailConfigured } from "@/lib/admin-password";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { Badge, Field, IconBox, Notice, PageTitle, Panel, Table, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { saveUser } from "../../../actions/settings";
import { createResetLink } from "../../../actions/extra";

export const metadata = { title: "Tài khoản và phân quyền" };

const ROLE_DESC: Record<Role, string> = {
  admin: "Tài khoản, quyền, cài đặt, tích hợp, nhật ký và quản trị nội dung theo phân công.",
  seo_editor: "Tạo bản nháp, sửa nội dung, gắn chủ đề, chạy đề xuất AI trong hạn mức và gửi duyệt.",
  reviewer: "Duyệt hoặc yêu cầu sửa, đặt lịch, xuất bản, gỡ bài và khôi phục phiên bản.",
  product_ops: "Sửa danh mục, SKU, ảnh, thông số, link sàn và mẫu góc live. Quyền xuất bản cấp riêng.",
  consultant: "Xem và xử lý yêu cầu tư vấn được phân công; sửa FAQ.",
  recruiter: "Đăng và đóng tin, đọc hồ sơ và CV, cập nhật trạng thái ứng viên.",
  ai_agent: "Đọc nguồn, tạo đề xuất hoặc bản nháp. Mọi lần xuất bản đi qua tài khoản người duyệt.",
};
type Cell = Perm | null;
const MATRIX: { label: string; icon: Parameters<typeof IconBox>[0]["icon"]; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: "Bài viết", icon: "file", cells: ["content.edit", "content.edit", "content.edit", "content.review"] },
  { label: "Gửi duyệt bài", icon: "send", cells: [null, "content.submit", null, null] },
  { label: "Từ khóa & SEO", icon: "key", cells: ["seo.view", "seo.view", "seo.view", null] },
  { label: "Chạy tác vụ AI", icon: "sparkles", cells: [null, "seo.run_ai", null, null] },
  { label: "Sản phẩm & link mua", icon: "box", cells: ["product.edit", "product.edit", "product.edit", "product.publish"] },
  { label: "Góc live & quy tắc", icon: "play", cells: ["setup.edit", "setup.edit", "setup.edit", "rules.activate"] },
  { label: "Thư viện ảnh", icon: "image", cells: ["media.edit", "media.edit", "media.edit", "media.approve"] },
  { label: "Yêu cầu tư vấn", icon: "message", cells: ["lead.view", null, "lead.view", null] },
  { label: "Hỏi đáp (FAQ)", icon: "headset", cells: ["faq.edit", "faq.edit", "faq.edit", "faq.edit"] },
  { label: "Tin tuyển dụng", icon: "briefcase", cells: ["job.edit", "job.edit", "job.edit", "job.edit"] },
  { label: "Hồ sơ ứng viên & CV", icon: "user", cells: ["application.view", null, "application.view", null] },
  { label: "Trang công ty", icon: "building", cells: ["pages.edit", "pages.edit", "pages.edit", "pages.edit"] },
  { label: "Cài đặt & tài khoản", icon: "settings", cells: ["settings.edit", "users.manage", "users.manage", "settings.edit"] },
];

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePage("users.manage");
  const sp = await searchParams;
  const tab = sp.tab === "roles" ? "roles" : "accounts";
  const db = await getDb();
  const users = await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, roles: schema.users.roles, status: schema.users.status, createdAt: schema.users.createdAt })
    .from(schema.users).orderBy(asc(schema.users.email));
  const role = (ROLES as readonly string[]).includes(sp.role ?? "") ? (sp.role as Role) : "seo_editor";
  const editing = sp.u === "new" ? null : users.find((x) => x.id === sp.u);

  return (
    <>
      <PageTitle title="Tài khoản và phân quyền" />
      <SettingsTabs current="users" />
      <Tabs variant="pill" current={tab} tabs={[{ key: "accounts", label: "Tài khoản", href: "/admin/settings/users" }, { key: "roles", label: "Vai trò", href: "/admin/settings/users?tab=roles" }]} />
      {tab === "roles" ? (
        <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
          <Panel title="Danh sách vai trò" className="!mb-0 h-fit">
            {ROLES.map((r) => (
              <Link key={r} href={`?tab=roles&role=${r}`} className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 ${r === role ? "bg-brand-soft font-semibold text-brand-dark" : "hover:bg-black/[.03]"}`}>
                <Icon name="users" className={r === role ? "text-brand" : "text-ink-muted"} /><span className="flex-1">{ROLE_LABELS[r]}</span>
                <span className="text-xs text-ink-muted">{users.filter((x) => x.roles.includes(r)).length}</span><Icon name="chevronRight" className="h-4 w-4" />
              </Link>
            ))}
            <p className="mt-3 text-xs text-ink-muted">Vai trò cố định theo đặc tả; thêm vai trò mới cần đổi mã nguồn (src/lib/permissions.ts).</p>
          </Panel>
          <Panel className="!mb-0">
            <div className="flex flex-wrap items-start gap-5 border-b border-[#EFECE8] pb-5">
              <div className="min-w-[240px] flex-1"><p className="mb-1.5 text-lg font-semibold">Vai trò</p><p className="input flex items-center bg-[#FBFAF8]">{ROLE_LABELS[role]}</p></div>
              <div className="flex flex-1 items-start gap-4"><IconBox icon="users" size="lg" /><div><p className="font-bold">Mô tả vai trò</p><p className="text-ink-soft">{ROLE_DESC[role]}</p></div></div>
            </div>
            <h2 className="mb-3 mt-5 text-2xl font-bold">Phân quyền chức năng</h2>
            <div className="overflow-x-auto">
              <table className="adm-table">
                <thead><tr><th>Chức năng</th><th className="text-center">Xem</th><th className="text-center">Tạo</th><th className="text-center">Sửa</th><th className="text-center">Xuất bản / duyệt</th></tr></thead>
                <tbody>{MATRIX.map((m) => (
                  <tr key={m.label}><td><span className="flex items-center gap-3"><IconBox icon={m.icon} size="sm" />{m.label}</span></td>
                    {m.cells.map((p, i) => <td key={i} className="text-center">{p ? (can([role], p)
                      ? <span role="img" aria-label={`${m.label} ${["xem", "tạo", "sửa", "xuất bản"][i]}: có`} className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand text-white"><Icon name="check" className="h-4 w-4" strokeWidth={3} /></span>
                      : <span role="img" aria-label={`${m.label} ${["xem", "tạo", "sửa", "xuất bản"][i]}: không`} className="inline-block h-6 w-6 rounded-md border-2 border-[#D9D5D0] bg-white" />)
                      : <span className="text-ink-muted">—</span>}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted"><Icon name="info" className="h-4 w-4" /> Quyền được kiểm ở máy chủ cho từng thao tác. Muốn cấp thêm quyền, gán thêm vai trò cho tài khoản (vd thêm “Người duyệt nội dung” cho vận hành để xuất bản).</p>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
          <div>
            <div className="mb-4 flex justify-end"><Link href="?u=new" className="btn-primary"><Icon name="plus" /> Thêm tài khoản</Link></div>
            <Table head={["Tài khoản", "Vai trò", "Trạng thái", ""]}>
              {users.map((x) => (
                <tr key={x.id} className={x.id === editing?.id ? "is-active" : ""}>
                  <td><b>{x.name || "—"}</b><span className="block text-sm text-ink-muted">{x.email}</span></td>
                  <td className="text-sm">{x.roles.map((r) => ROLE_LABELS[r]).join(", ") || <span className="text-ink-muted">Chưa có vai trò</span>}</td>
                  <td><Badge status={x.status === "active" ? "active" : "disabled"} label={x.status === "active" ? "Hoạt động" : "Đã khoá"} /></td>
                  <td><Link href={`?u=${x.id}`} className="btn-line btn-sm">Sửa</Link></td>
                </tr>
              ))}
            </Table>
          </div>
          <aside>
            {editing || sp.u === "new" ? (
              <Panel title={editing ? `Sửa: ${editing.email}` : "Thêm tài khoản"}>
                <ActionForm action={saveUser} submitLabel={editing ? "Lưu tài khoản" : "Tạo tài khoản"} submitIcon="save" key={editing?.id ?? "new"} resetOnSuccess={!editing}>
                  <input type="hidden" name="id" value={editing?.id ?? ""} />
                  <div className="space-y-4">
                    <Field label="Email" name="email" type="email" defaultValue={editing?.email} readOnly={!!editing} required />
                    <Field label="Tên hiển thị" name="name" defaultValue={editing?.name} />
                    <Field label={editing ? "Đặt mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu ban đầu"} name="password" type="password" hint="≥ 10 ký tự. Gửi riêng cho người dùng, không gửi qua chat công khai." />
                    <Field label="Trạng thái" name="status" defaultValue={editing?.status ?? "active"} options={[{ value: "active", label: "Hoạt động" }, { value: "disabled", label: "Khoá" }]} />
                    <fieldset><legend className="mb-1.5 text-[15px] font-semibold">Vai trò</legend>
                      <div className="space-y-1.5">{ROLES.map((r) => (
                        <label key={r} className="flex items-start gap-2.5 rounded-xl border border-line px-3 py-2"><input type="checkbox" name="roles" value={r} defaultChecked={editing?.roles.includes(r)} className="mt-1" /><span><b className="text-[15px]">{ROLE_LABELS[r]}</b><span className="block text-xs text-ink-muted">{ROLE_DESC[r]}</span></span></label>
                      ))}</div></fieldset>
                  </div>
                </ActionForm>
                {editing && (
                  <div className="mt-5 border-t border-[#EFECE8] pt-4">
                    <p className="font-semibold">Khôi phục mật khẩu</p>
                    <p className="mb-3 text-sm text-ink-muted">{resetEmailConfigured() ? "Người dùng có thể tự nhận link qua email ở trang đăng nhập. Hoặc tạo link tại đây và gửi riêng." : "Chưa cấu hình email (RESEND_API_KEY) — tạo link tại đây rồi gửi riêng cho người dùng."}</p>
                    <ActionButton action={createResetLink} label="Tạo link đặt lại mật khẩu (30 phút)" icon="key" className="btn-line btn-sm" fields={{ id: editing.id }} confirm={`Tạo link đặt lại mật khẩu cho ${editing.email}?`} />
                  </div>
                )}
                {editing?.id === me.id && <p className="mt-3 text-xs text-ink-muted">Bạn không thể tự gỡ quyền quản trị hoặc tự khoá tài khoản của mình.</p>}
              </Panel>
            ) : (
              <Notice tone="info" icon="info">Chọn “Sửa” ở một tài khoản để đổi vai trò, khoá tài khoản hoặc tạo link đặt lại mật khẩu. Mọi thay đổi quyền được ghi nhật ký.</Notice>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
