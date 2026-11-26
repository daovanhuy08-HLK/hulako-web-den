// Thanh điều hướng phụ cho khu AI SEO (dùng chung các trang /admin/seo/*)
import Link from "next/link";
import { Icon } from "./icons";

const ITEMS = [
  { href: "/admin/seo", label: "Cơ hội & hàng chờ", icon: "search" },
  { href: "/admin/seo/report", label: "Báo cáo", icon: "bars" },
  { href: "/admin/seo/sources", label: "Nguồn dữ liệu", icon: "database" },
  { href: "/admin/seo/topics", label: "Chủ đề", icon: "folder" },
  { href: "/admin/seo/outline", label: "Đề cương AI", icon: "sparkles" },
  { href: "/admin/seo/import", label: "Nhập CSV", icon: "csv" },
  { href: "/admin/seo/schedule", label: "Lịch tự động", icon: "calendar" },
  { href: "/admin/seo/redirects", label: "Chuyển hướng", icon: "loop" },
];

export function SeoNav({ current }: { current: string }) {
  return (
    <nav aria-label="AI SEO" className="adm-scroll -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.href === current ? "page" : undefined}
          className={`inline-flex flex-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${i.href === current ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white text-ink hover:border-ink/30"}`}>
          <Icon name={i.icon} className="h-4 w-4" />{i.label}
        </Link>
      ))}
    </nav>
  );
}
