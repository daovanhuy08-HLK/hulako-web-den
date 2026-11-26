"use client";
// Mục lục có đánh dấu mục đang đọc (vạch cam bên trái, ảnh 080).
import { useEffect, useState } from "react";
import { Icon } from "./site/Icon";

export function Toc({ items }: { items: { id: string; text: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((es) => {
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) setActive(v.target.id);
    }, { rootMargin: "-90px 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label="Mục lục">
      <p className="flex items-center gap-3 text-[24px] font-bold"><Icon name="list" size={28} />Mục lục</p>
      <ol className="mt-6 space-y-5">
        {items.map((t) => (
          <li key={t.id} className="relative">
            {active === t.id && <span aria-hidden className="absolute -left-5 top-0 h-full w-1 rounded bg-brand" />}
            <a href={`#${t.id}`} aria-current={active === t.id ? "location" : undefined} className={`block text-[17px] leading-snug ${active === t.id ? "text-brand" : "text-ink hover:text-brand"}`}>{t.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
