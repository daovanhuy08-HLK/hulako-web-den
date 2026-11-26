"use client";
// Màn 040: form chuyển hướng 301 với nút "Kiểm tra" (trang đích tồn tại, vòng lặp, chuỗi chuyển hướng) trước khi lưu.
import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin";
import type { RedirectCheck } from "@/app/admin/actions/extra";
import { ActionForm } from "./ActionForm";
import { Icon } from "./icons";

export function RedirectForm({ save, check }: { save: (fd: FormData) => Promise<ActionResult>; check: (fd: FormData) => Promise<RedirectCheck> }) {
  const [res, setRes] = useState<RedirectCheck | null>(null);
  const [pending, start] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);
  const runCheck = () => {
    const form = wrap.current?.querySelector("form");
    if (!form) return;
    const fd = new FormData(form);
    start(async () => setRes(await check(fd)));
  };
  const Item = ({ ok, label }: { ok: boolean | null; label: string }) => (
    <li className="flex items-center gap-3 border-t border-[#EFECE8] py-3 first:border-0">
      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${ok === null ? "border-line" : ok ? "border-[#1E7B3C] bg-[#E7F6EC] text-[#1E7B3C]" : "border-[#B42318] bg-[#FDECEC] text-[#B42318]"}`}>
        {ok === null ? null : <Icon name={ok ? "check" : "x"} className="h-4 w-4" />}
      </span>{label}
    </li>
  );
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div ref={wrap} className="card p-6">
        <ActionForm action={save} resetOnSuccess buttons={(
          <div className="flex w-full flex-wrap justify-end gap-3">
            <button type="button" className="btn-line min-w-[140px]" onClick={runCheck} disabled={pending}>{pending ? "Đang kiểm tra…" : "Kiểm tra"}</button>
            <button type="submit" className="btn-primary min-w-[200px]">Lưu chuyển hướng</button>
          </div>
        )}>
          <div className="space-y-5" onChange={() => setRes(null)}>
            {[["fromPath", "Đường dẫn cũ", "/kien-thuc/bai-cu"], ["toPath", "Đường dẫn mới", "/kien-thuc/cach-lap-softbox"]].map(([n, l, ph]) => (
              <div key={n}>
                <label htmlFor={`r-${n}`} className="mb-1.5 block text-lg font-semibold">{l}</label>
                <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name="link" /></span><input id={`r-${n}`} name={n} placeholder={ph} className="input pl-11" /></div>
              </div>
            ))}
            <div><label htmlFor="r-type" className="mb-1.5 block text-lg font-semibold">Loại chuyển hướng</label>
              <select id="r-type" className="input" defaultValue="301" disabled><option value="301">301 — chuyển vĩnh viễn</option></select>
              <p className="mt-1 text-xs text-ink-muted">Website chỉ dùng 301 để giữ thứ hạng khi đổi URL.</p></div>
          </div>
        </ActionForm>
      </div>
      <aside className="space-y-5">
        <section className="card p-5">
          <h2 className="mb-3 text-2xl font-bold">Kiểm tra đường dẫn</h2>
          <div className={`mb-2 flex items-center gap-3 rounded-xl px-4 py-3 font-semibold ${!res ? "bg-brand-tint" : res.ok ? "bg-[#E7F6EC] text-[#14532D]" : "bg-[#FDECEC] text-[#7A1A1A]"}`}>
            <Icon name={!res ? "info" : res.ok ? "checkCircle" : "alert"} className="h-6 w-6" />{res ? res.message : "Chưa kiểm tra"}
          </div>
          <ul>
            <Item ok={res ? res.exists : null} label={res && res.exists === null && res.final ? "Trang đích tồn tại (không xác định được — ngoài danh mục)" : "Trang đích tồn tại"} />
            <Item ok={res ? !res.loop : null} label="Kiểm tra vòng lặp" />
            <Item ok={res ? !res.chain : null} label={res?.chain ? `Có chuỗi chuyển hướng → lưu sẽ trỏ thẳng tới ${res.final}` : "Kiểm tra chuỗi chuyển hướng"} />
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-xl font-bold">Ví dụ cấu hình</h2>
          <dl className="grid grid-cols-[150px_1fr] gap-y-2 rounded-xl bg-brand-tint p-4 text-sm">
            <dt className="font-semibold">Đường dẫn cũ:</dt><dd>/kien-thuc/bai-cu</dd>
            <dt className="font-semibold">Đường dẫn mới:</dt><dd>/kien-thuc/cach-lap-softbox</dd>
            <dt className="font-semibold">Loại chuyển hướng:</dt><dd>301</dd>
          </dl>
        </section>
      </aside>
    </div>
  );
}
