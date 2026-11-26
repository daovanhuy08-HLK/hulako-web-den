"use client";
// Menu ngang trên máy tính: mục đang mở chữ cam + gạch chân cam sát đáy header (ảnh 075–093).
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string; also?: string[] }[] }) {
  const path = usePathname();
  const active = (i: { href: string; also?: string[] }) =>
    i.href === "/" ? path === "/" : [i.href, ...(i.also ?? [])].some((h) => path === h || path.startsWith(`${h}/`));
  return (
    <nav aria-label="Menu chính" className="hidden h-full lg:block">
      <ul className="flex h-full items-stretch gap-0 xl:gap-4">
        {items.map((i) => {
          const on = active(i);
          return (
            <li key={i.href} className="flex">
              <Link
                href={i.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex items-center whitespace-nowrap px-2 text-[15px] font-medium transition-colors xl:px-3 xl:text-[17px] ${on ? "text-brand" : "text-ink hover:text-brand"}`}
              >
                {i.label}
                {on && <span aria-hidden className="absolute inset-x-2 -bottom-px h-[3px] xl:inset-x-3 rounded-full bg-brand" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
