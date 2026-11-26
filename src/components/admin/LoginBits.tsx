"use client";
// Phần nhỏ chạy trên trình duyệt cho trang đăng nhập: ô mật khẩu có nút hiện/ẩn, tiêu đề "phiên hết hạn" (màn 060).
import { useEffect, useState } from "react";
import { Icon } from "./icons";

export function PasswordInput({ id, name, autoComplete, withIcon }: { id: string; name: string; autoComplete: string; withIcon?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {withIcon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name="lock" /></span>}
      <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 10 : undefined}
        className={`input !min-h-[56px] pr-12 ${withIcon ? "pl-11" : ""}`} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={show}
        className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-black/5"><Icon name="eye" /></button>
    </div>
  );
}

/** Tiêu đề đăng nhập: chuyển sang "Phiên đăng nhập đã hết hạn" khi bị đẩy về từ trang quản trị mà trước đó đã đăng nhập */
export function LoginHeading({ forceExpired, hasNext }: { forceExpired: boolean; hasNext: boolean }) {
  const [expired, setExpired] = useState(forceExpired);
  useEffect(() => {
    try { if (!forceExpired && hasNext && localStorage.getItem("hlk_admin_active") === "1") setExpired(true); } catch { /* bỏ qua */ }
  }, [forceExpired, hasNext]);
  if (!expired) return <h1 className="text-center text-3xl font-extrabold">Đăng nhập quản trị</h1>;
  return (
    <div className="text-center">
      <span className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-soft text-brand"><Icon name="lock" className="h-10 w-10" /></span>
      <h1 className="mt-4 text-3xl font-extrabold">Phiên đăng nhập đã hết hạn</h1>
      <p className="mt-2 text-lg text-ink-soft">Đăng nhập lại để tiếp tục làm việc.</p>
      <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F4F1ED] px-4 py-2.5 text-sm text-ink-soft"><Icon name="info" className="h-5 w-5" /> Kiểm tra lại bản nháp sau khi đăng nhập.</p>
    </div>
  );
}
