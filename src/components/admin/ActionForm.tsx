"use client";
// Form quản trị gọi Server Action mà KHÔNG tự xoá dữ liệu đang nhập khi lỗi (mục 06).
// Hiển thị thông báo lưu rõ ràng; khi xung đột phiên bản (409) mở hộp thoại cho chọn
// "Giữ bản đang nhập" (đóng hộp thoại, dữ liệu vẫn còn) hoặc "Xem bản mới nhất" (tải lại).
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin";
import { Icon } from "./icons";

function Message({ res, floating }: { res: ActionResult; floating?: boolean }) {
  return (
    <div role={res.ok ? "status" : "alert"}
      className={`${floating ? "fixed bottom-5 right-5 z-50 max-w-md shadow-lg" : "mt-3"} flex items-start gap-2 rounded-xl border p-3 text-sm font-medium ${res.ok ? "border-[#BFE5CC] bg-[#E7F6EC] text-[#14532D]" : "border-[#F5C2C2] bg-[#FDECEC] text-[#7A1A1A]"}`}>
      <Icon name={res.ok ? "checkCircle" : "alert"} className="mt-0.5 h-5 w-5 flex-none" />
      <div>
        {res.message}
        {res.fieldErrors && <ul className="mt-1 list-disc pl-5">{Object.values(res.fieldErrors).map((m, i) => <li key={i}>{m}</li>)}</ul>}
      </div>
    </div>
  );
}

function ConflictDialog({ mine, onKeep }: { mine: string; onKeep: () => void }) {
  return (
    <div className="adm-backdrop" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <div className="adm-dialog">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon name="alert" className="h-8 w-8" /></span>
          <div>
            <h2 id="conflict-title" className="text-2xl font-extrabold">Nội dung đã được cập nhật</h2>
            <p className="mt-1 text-ink-muted">Một phiên bản mới đã được lưu từ lúc bạn mở trang. Xem thay đổi trước khi tiếp tục.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-card border border-line p-4">
            <p className="flex items-center gap-2 font-bold"><Icon name="file" /> Bản đang chỉnh sửa</p>
            <p className="mt-3 rounded-lg bg-[#F4F1ED] px-3 py-2 text-sm">{mine || "(dữ liệu bạn vừa nhập — vẫn giữ trong form)"}</p>
          </div>
          <div className="rounded-card border border-line p-4">
            <p className="flex items-center gap-2 font-bold text-brand-dark"><Icon name="file" /> Bản mới nhất</p>
            <p className="mt-3 rounded-lg bg-[#F4F1ED] px-3 py-2 text-sm">Đã được người khác lưu.{" "}
              <a href={typeof window !== "undefined" ? window.location.href : "#"} target="_blank" rel="noreferrer" className="font-semibold text-brand-dark underline">Mở ở thẻ mới để so sánh ↗</a></p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-line min-w-[200px]" onClick={onKeep}>Giữ bản đang nhập</button>
          <button type="button" className="btn-primary min-w-[200px]" onClick={() => location.reload()}>Xem bản mới nhất</button>
        </div>
        <p className="mt-4 text-center text-xs text-ink-muted">“Giữ bản đang nhập” chỉ đóng hộp thoại: hãy chép phần đã sửa, tải bản mới rồi sửa tiếp để không ghi đè thay đổi của người khác.</p>
      </div>
    </div>
  );
}

export function ActionForm({ action, children, submitLabel = "Lưu", className = "", confirm, resetOnSuccess, buttons, id, toast, submitIcon }: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  buttons?: React.ReactNode;
  /** Gắn id để nút ở chỗ khác (thanh tiêu đề) submit bằng thuộc tính form="id" */
  id?: string;
  /** Hiện thông báo nổi góc phải (khi nút lưu nằm xa form) */
  toast?: boolean;
  submitIcon?: string;
}) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const ask = submitter?.dataset.confirm ?? confirm;
    if (ask && !window.confirm(ask)) return;
    const fd = new FormData(e.currentTarget);
    if (submitter?.name) fd.set(submitter.name, submitter.value);
    start(async () => {
      try {
        const r = await action(fd);
        setRes(r);
        if (r.conflict) {
          const t = fd.get("title") ?? fd.get("name") ?? "";
          setConflict(String(t));
        }
        if (r.ok) {
          if (resetOnSuccess) ref.current?.reset();
          if (r.redirect) router.push(r.redirect); else router.refresh();
        }
        if (toast) setTimeout(() => setRes((cur) => (cur === r ? null : cur)), 6000);
      } catch {
        setRes({ ok: false, message: "Mất kết nối. Dữ liệu bạn nhập vẫn còn — thử lưu lại." });
      }
    });
  }

  return (
    <form ref={ref} id={id} onSubmit={onSubmit} className={className} noValidate aria-busy={pending}>
      {children}
      {res && !conflict && <Message res={res} floating={toast} />}
      {conflict !== null && <ConflictDialog mine={conflict} onKeep={() => { setConflict(null); setRes({ ok: false, message: "Đang giữ bản bạn nhập. Lưu lại sẽ bị từ chối cho tới khi tải bản mới.", conflict: true }); }} />}
      {buttons !== null && (
        <div className="mt-4 flex flex-wrap gap-2">
          {buttons ?? (
            <button type="submit" className="btn-primary" disabled={pending}>
              {submitIcon && <Icon name={submitIcon} />}{pending ? "Đang lưu…" : submitLabel}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

/** Nút hành động đơn lẻ (vd Duyệt, Chạy lại) */
export function ActionButton({ action, label, className = "btn-outline", confirm, fields = {}, icon }: {
  action: (fd: FormData) => Promise<ActionResult>; label: string; className?: string; confirm?: string; fields?: Record<string, string>; icon?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col">
      <button type="button" className={className} disabled={pending} onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
        start(async () => {
          try {
            const r = await action(fd);
            setMsg(r);
            if (r.ok) { if (r.redirect) router.push(r.redirect); else router.refresh(); }
          } catch {
            setMsg({ ok: false, message: "Mất kết nối, thử lại." });
          }
        });
      }}>{icon && <Icon name={icon} />}{pending ? "Đang xử lý…" : label}</button>
      {msg && <span role={msg.ok ? "status" : "alert"} className={`mt-1 max-w-md select-all text-xs [overflow-wrap:anywhere] ${msg.ok ? "text-[#1E7B3C]" : "text-red-700"}`}>{msg.message}</span>}
    </span>
  );
}

/** Nút submit đặt ở chỗ khác (thanh tiêu đề) cho form có id */
export function SubmitFor({ form, label, className = "btn-primary", name, value, icon, confirm }: {
  form: string; label: string; className?: string; name?: string; value?: string; icon?: string; confirm?: string;
}) {
  return (
    <button type="submit" form={form} name={name} value={value} className={className} data-confirm={confirm}>
      {icon && <Icon name={icon} />}{label}
    </button>
  );
}
