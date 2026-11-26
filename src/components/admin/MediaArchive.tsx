"use client";
// Màn 072 "Ảnh đang được sử dụng": trước khi lưu trữ ảnh, liệt kê nội dung đang tham chiếu và mặc định GIỮ ảnh.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin";
import { Icon } from "./icons";

export type MediaRef = { label: string; href: string; kind: string };

export function MediaArchive({ action, id, url, alt, refs, sample }: {
  action: (fd: FormData) => Promise<ActionResult>; id: string; url: string; alt: string; refs: MediaRef[]; sample?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (force: boolean) => {
    const fd = new FormData(); fd.set("id", id); fd.set("op", "archive"); if (force) fd.set("force", "1");
    start(async () => { const r = await action(fd); setMsg(r); if (r.ok) { setOpen(false); router.refresh(); } });
  };
  return (
    <>
      <button type="button" className="btn-line btn-sm" disabled={pending}
        onClick={() => (refs.length ? setOpen(true) : window.confirm("Lưu trữ ảnh này? Ảnh sẽ ẩn khỏi thư viện.") && run(false))}>
        <Icon name="download" className="h-4 w-4" /> Lưu trữ
      </button>
      {msg && !msg.ok && <p role="alert" className="mt-1 text-xs text-red-700">{msg.message}</p>}
      {open && (
        <div className="adm-backdrop" role="dialog" aria-modal="true" aria-labelledby="media-used-title">
          <div className="adm-dialog relative">
            <button type="button" className="absolute right-5 top-5 rounded-lg p-2 hover:bg-black/5" aria-label="Đóng" onClick={() => setOpen(false)}><Icon name="x" /></button>
            <h2 id="media-used-title" className="text-3xl font-extrabold">Ảnh đang được sử dụng</h2>
            <p className="mt-2 text-lg text-ink-soft">Kiểm tra các nội dung liên quan trước khi lưu trữ ảnh.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-[#F1F0EE]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={alt} className="h-full w-full object-cover" />
                {sample && <span className="absolute left-3 top-3 rounded-lg bg-brand-soft px-3 py-1 font-semibold text-brand-dark">Ảnh mẫu</span>}
              </div>
              <div className="rounded-card border border-line p-4">
                <p className="mb-2 text-lg font-bold">Nội dung đang tham chiếu</p>
                <ul>{refs.map((r, i) => (
                  <li key={i} className="border-t border-[#EFECE8] first:border-0">
                    <a href={r.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3 hover:text-brand-dark">
                      <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon name="file" className="h-5 w-5" /></span>
                      <span className="flex-1"><span className="block font-medium">{r.label}</span><span className="text-xs text-ink-muted">{r.kind}</span></span>
                      <Icon name="chevronRight" className="h-5 w-5 text-ink-muted" />
                    </a>
                  </li>
                ))}</ul>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href={refs[0]?.href} target="_blank" rel="noreferrer" className="btn-line min-w-[220px]">Xem nơi sử dụng</a>
              <button type="button" className="btn-primary min-w-[220px]" onClick={() => setOpen(false)}>Giữ ảnh</button>
            </div>
            <p className="mt-4 text-center text-xs text-ink-muted">Đã gỡ tham chiếu mà vẫn báo đang dùng?{" "}
              <button type="button" className="font-semibold text-red-700 underline" disabled={pending}
                onClick={() => window.confirm("Vẫn lưu trữ ảnh dù đang được tham chiếu? Trang dùng ảnh này có thể hiển thị lỗi ảnh.") && run(true)}>Vẫn lưu trữ</button></p>
          </div>
        </div>
      )}
    </>
  );
}
