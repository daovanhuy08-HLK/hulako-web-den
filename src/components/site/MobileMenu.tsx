"use client";
// Menu thu gọn trên di động (ảnh 001): nút ☰ bên trái, mở/đóng bằng aria-expanded, Esc để đóng, focus về nút sau khi đóng.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls="menu-di-dong"
        aria-label={open ? "Đóng menu" : "Mở menu"}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5"
      >
        <Icon name={open ? "x" : "menu"} size={28} stroke={2.2} />
      </button>
      {open && (
        <nav id="menu-di-dong" aria-label="Menu chính" className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-paper px-4 pb-10 pt-4">
          <ul className="space-y-1">
            {items.map((i, n) => {
              const on = i.href === "/" ? path === "/" : path.startsWith(i.href);
              return (
                <li key={i.href}>
                  <Link ref={n === 0 ? firstLink : undefined} href={i.href} aria-current={on ? "page" : undefined}
                    className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-lg font-semibold hover:bg-white ${on ? "text-brand" : ""}`}>
                    {i.label}<Icon name="chevron" size={20} className="text-ink-muted" />
                  </Link>
                </li>
              );
            })}
            <li>
              <Link href="/chon-den" className="flex items-center justify-between rounded-xl px-4 py-3.5 text-lg font-semibold hover:bg-white">
                Chọn đèn theo phòng<Icon name="chevron" size={20} className="text-ink-muted" />
              </Link>
            </li>
          </ul>
          <div className="mt-6 grid gap-3">
            <Link href="/lien-he?chu-de=tu-van-chon-den" className="btn-primary">Nhờ tư vấn chọn đèn</Link>
            <div className="flex gap-5 px-2 text-[15px] text-ink-muted">
              <Link href="/tuyen-dung" className="underline">Tuyển dụng</Link>
              <Link href="/lien-he" className="underline">Liên hệ</Link>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
