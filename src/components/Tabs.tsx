"use client";
// Tab truy cập được bằng bàn phím (mũi tên trái/phải) — dùng cho Thông tin / Hướng dẫn lắp / Hỏi đáp (ảnh 076).
import { useId, useRef, useState } from "react";

export function Tabs({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [i, setI] = useState(0);
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (d: number) => { const n = (i + d + tabs.length) % tabs.length; setI(n); refs.current[n]?.focus(); };
  return (
    <div className="card overflow-hidden">
      <div role="tablist" aria-label="Thông tin sản phẩm" className="flex gap-2 overflow-x-auto border-b border-line px-4 sm:gap-8 sm:px-6"
        onKeyDown={(e) => { if (e.key === "ArrowRight") move(1); if (e.key === "ArrowLeft") move(-1); }}>
        {tabs.map((t, n) => (
          <button key={t.label} ref={(el) => { refs.current[n] = el; }} role="tab" type="button" id={`${id}-t${n}`} aria-controls={`${id}-p${n}`}
            aria-selected={n === i} tabIndex={n === i ? 0 : -1} onClick={() => setI(n)}
            className={`relative whitespace-nowrap px-3 py-4 text-[17px] font-semibold sm:text-[20px] ${n === i ? "text-brand" : "text-ink hover:text-brand"}`}>
            {t.label}
            {n === i && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-brand" />}
          </button>
        ))}
      </div>
      {tabs.map((t, n) => (
        <div key={t.label} role="tabpanel" id={`${id}-p${n}`} aria-labelledby={`${id}-t${n}`} hidden={n !== i} className="p-5 sm:p-6">{t.content}</div>
      ))}
    </div>
  );
}
