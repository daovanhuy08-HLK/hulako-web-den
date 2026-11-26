"use client";
// Khung quản trị: thanh điều hướng trái (thu thành ngăn kéo trên màn hẹp), thanh trên có tìm kiếm,
// chuông việc cần xử lý, tên người dùng và đăng xuất. Mục menu đã được lọc theo quyền ở máy chủ.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

export type NavItem = { href: string; label: string; icon: string; group: string };

export function AdminShell({ items, user, pending, logout, children }: {
  items: NavItem[];
  user: { name: string; email: string; roles: string };
  pending: number;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const path = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  // Đánh dấu "đã từng đăng nhập" để trang đăng nhập phân biệt phiên hết hạn (màn 060)
  useEffect(() => { try { localStorage.setItem("hlk_admin_active", "1"); } catch { /* chế độ riêng tư */ } }, []);

  // Mục đang chọn = đường dẫn khớp dài nhất (vd /admin/seo/learning → "Vòng học AI", không phải "AI SEO")
  const active = items.filter((n) => path === n.href || (n.href !== "/admin" && path.startsWith(`${n.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? (path === "/admin" ? "/admin" : "");
  const groups = [...new Set(items.map((i) => i.group))];

  const nav = (
    <nav aria-label="Quản trị" className="adm-scroll flex-1 overflow-y-auto px-3 pb-6">
      {groups.map((g) => (
        <div key={g} className="mb-2">
          {g !== "_" && <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted/80">{g}</p>}
          <ul className="space-y-1">
            {items.filter((i) => i.group === g).map((n) => {
              const on = n.href === active;
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-[16px] ${on ? "bg-brand-soft font-semibold text-brand" : "text-ink hover:bg-black/[.04]"}`}>
                    <Icon name={n.icon} className="h-[22px] w-[22px] flex-none" />{n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="adm-root min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      {/* Sidebar máy tính */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white lg:flex">
        <Link href="/admin" className="block px-8 pb-6 pt-7 text-[34px] font-black leading-none tracking-tight text-brand">HULAKO</Link>
        {nav}
        <Link href="/" target="_blank" className="mx-6 mb-5 flex items-center gap-2 text-sm text-ink-muted hover:text-brand-dark"><Icon name="external" className="h-4 w-4" /> Xem website</Link>
      </aside>

      {/* Ngăn kéo trên điện thoại/máy tính bảng */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu quản trị">
          <button className="absolute inset-0 bg-black/30" aria-label="Đóng menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-6 pb-4 pt-5">
              <Link href="/admin" className="text-[28px] font-black text-brand">HULAKO</Link>
              <button onClick={() => setOpen(false)} aria-label="Đóng menu" className="rounded-lg p-2 hover:bg-black/5"><Icon name="x" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-line bg-[#F9F8F6]/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 hover:bg-black/5 lg:hidden" aria-label="Mở menu" onClick={() => setOpen(true)}><Icon name="menu" /></button>
          <Link href="/admin" className="text-xl font-black text-brand lg:hidden">HULAKO</Link>
          <form action="/admin/search" className="relative ml-auto hidden w-full max-w-md md:block" role="search">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name="search" className="h-[18px] w-[18px]" /></span>
            <input name="q" placeholder="Tìm bài viết, sản phẩm, SKU, mã yêu cầu…" aria-label="Tìm trong quản trị" className="input !min-h-[42px] pl-10 text-[15px]" />
          </form>
          <Link href="/admin/search" className="ml-auto rounded-lg p-2 hover:bg-black/5 md:hidden" aria-label="Tìm kiếm"><Icon name="search" /></Link>
          <Link href="/admin#viec-can-xu-ly" aria-label={pending ? `${pending} việc cần xử lý` : "Không có việc cần xử lý"}
            className="relative inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-line bg-white hover:border-ink/30">
            <Icon name="bell" />
            {pending > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-white" />}
          </Link>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-black/5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EFEDEA] text-ink-muted"><Icon name="user" /></span>
              <span className="hidden max-w-[160px] truncate text-sm font-semibold sm:block">{user.name || user.email}</span>
              <Icon name="chevronDown" className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 mt-2 w-72 rounded-card border border-line bg-white p-4 shadow-lg">
              <p className="font-bold">{user.name || "—"}</p>
              <p className="truncate text-sm text-ink-muted">{user.email}</p>
              <p className="mt-2 text-xs text-ink-muted">Vai trò: {user.roles}</p>
              <form action={logout} onSubmit={() => { try { localStorage.removeItem("hlk_admin_active"); } catch { /* bỏ qua */ } }} className="mt-3 border-t border-line pt-3">
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-semibold hover:bg-black/5"><Icon name="logout" /> Đăng xuất</button>
              </form>
            </div>
          </details>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
