import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { destroySession, requireUser } from "@/lib/auth";
import { ROLE_LABELS, type Perm } from "@/lib/permissions";
import { canAny } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { rowsOf } from "@/lib/db/rows";
import { AdminShell, type NavItem } from "@/components/admin/AdminShell";
import "../admin.css";

export const metadata: Metadata = { title: { default: "Quản trị", template: "%s | Quản trị HULAKO" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Nhóm menu theo mockup; mục chỉ hiện khi người dùng có ít nhất một quyền tương ứng
const NAV: (NavItem & { perm?: Perm[] })[] = [
  { href: "/admin", label: "Tổng quan", icon: "home", group: "_" },
  { href: "/admin/content", label: "Nội dung", icon: "file", group: "Nội dung", perm: ["content.edit"] },
  { href: "/admin/content/calendar", label: "Lịch xuất bản", icon: "calendar", group: "Nội dung", perm: ["content.edit"] },
  { href: "/admin/products", label: "Thiết bị", icon: "layers", group: "Sản phẩm", perm: ["product.edit"] },
  { href: "/admin/setups", label: "Góc livestream", icon: "play", group: "Sản phẩm", perm: ["setup.edit"] },
  { href: "/admin/media", label: "Thư viện ảnh", icon: "image", group: "Sản phẩm", perm: ["media.edit"] },
  { href: "/admin/support", label: "Tư vấn & Hỏi đáp", icon: "headset", group: "Khách hàng", perm: ["lead.view", "faq.edit"] },
  { href: "/admin/recruitment", label: "Tuyển dụng", icon: "briefcase", group: "Khách hàng", perm: ["job.edit", "application.view"] },
  { href: "/admin/seo", label: "AI SEO", icon: "search", group: "AI SEO", perm: ["seo.view"] },
  { href: "/admin/seo/agent", label: "Agent SEO trên máy", icon: "bot", group: "AI SEO", perm: ["seo.view"] },
  { href: "/admin/seo/learning", label: "Vòng học AI", icon: "refresh", group: "AI SEO", perm: ["seo.view"] },
  { href: "/admin/seo/indexing", label: "Index bài viết", icon: "globe", group: "AI SEO", perm: ["seo.view"] },
  { href: "/admin/pages", label: "Trang công ty", icon: "building", group: "Hệ thống", perm: ["pages.edit"] },
  { href: "/admin/settings", label: "Cài đặt", icon: "settings", group: "Hệ thống", perm: ["settings.edit"] },
];

async function logout() {
  "use server";
  await destroySession();
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = NAV.filter((n) => !n.perm || canAny(user.roles, n.perm)).map(({ perm: _p, ...n }) => n);

  // Số việc cần xử lý theo quyền (chấm cam trên chuông)
  let pending = 0;
  try {
    const db = await getDb();
    const parts = [
      can(user.roles, "content.review") ? sql`(select count(*) from articles where status = 'review')` : sql`0`,
      can(user.roles, "lead.view") ? sql`(select count(*) from leads where status = 'new')` : sql`0`,
      can(user.roles, "application.view") ? sql`(select count(*) from applications where status = 'new')` : sql`0`,
      can(user.roles, "seo.view") ? sql`(select count(*) from ai_jobs where status = 'failed')` : sql`0`,
    ];
    const r = rowsOf<{ n: number }>(await db.execute(sql`select (${parts[0]} + ${parts[1]} + ${parts[2]} + ${parts[3]})::int as n`));
    pending = Number(r[0]?.n ?? 0);
  } catch { /* chuông không chặn trang khi DB tạm lỗi */ }

  return (
    <AdminShell items={items} pending={pending} logout={logout}
      user={{ name: user.name, email: user.email, roles: user.roles.map((r) => ROLE_LABELS[r]).join(", ") }}>
      {children}
    </AdminShell>
  );
}
