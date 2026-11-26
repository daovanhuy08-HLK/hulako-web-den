"use client";
// Form "Nhờ tư vấn góc livestream" (P10; ảnh 013, 083; lỗi nhập 053; lỗi gửi 063; thành công 041).
// Kiểm tra ở trình duyệt + máy chủ, khoá chống gửi trùng (cùng khoá → cùng mã), giữ nội dung khi lỗi để thử lại,
// lỗi gắn với từng trường (aria-describedby), chỉ hiện mã tiếp nhận sau khi máy chủ đã lưu.
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { leadSchema } from "@/lib/validators";
import { Icon } from "./site/Icon";

export const LEAD_TOPICS = [
  { value: "tu-van-chon-den", label: "Tư vấn chọn đèn, góc live" },
  { value: "ho-tro-sau-mua", label: "Hỗ trợ sau mua / lắp đặt" },
  { value: "hop-tac", label: "Hợp tác, mua số lượng" },
  { value: "khac", label: "Khác" },
];
const ITEMS = ["Quần áo", "Mỹ phẩm", "Phụ kiện", "Đồ gia dụng", "Khác"];
const STYLES = ["Live ngồi", "Live đứng", "Quay trên bàn", "Chưa xác định"];
const AREAS = ["Dưới 10 m²", "10–15 m²", "15–25 m²", "Trên 25 m²", "Chưa biết"];

type Errors = Record<string, string>;
type Source = "contact" | "product" | "article" | "selector" | "support";

export function LeadForm({ defaultTopic, context, source = "contact", defaultMessage = "", consentText, variant = "full", title, onEdit, successImage = "/demo/chon-den-ket-qua.jpg" }: {
  defaultTopic?: string; context: Record<string, string>; source?: Source; defaultMessage?: string; consentText: string;
  /** full = form liên hệ đầy đủ; compact = form tư vấn ở bộ chọn đèn (ảnh 062/088) */
  variant?: "full" | "compact"; title?: string; onEdit?: () => void; successImage?: string;
}) {
  const key = useRef<string>("");
  if (!key.current) key.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [serverMsg, setServerMsg] = useState("");
  const [photoName, setPhotoName] = useState("");
  const topicOk = useMemo(() => LEAD_TOPICS.some((t) => t.value === defaultTopic) ? defaultTopic : "tu-van-chon-den", [defaultTopic]);
  const compact = variant === "compact";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const contact = String(fd.get("contact") ?? "").trim();
    const isEmail = contact.includes("@");
    const extra: Record<string, string> = {};
    for (const [k, label] of [["mon-hang", "Món hàng"], ["kieu-quay", "Kiểu quay"], ["dien-tich", "Khoảng trống"]] as const) {
      const v = String(fd.get(k) ?? ""); if (v) extra[label] = v;
    }
    const payload = {
      name: String(fd.get("name") ?? ""), email: isEmail ? contact : "", phone: isEmail ? "" : contact.replace(/[\s.-]/g, ""),
      topic: String(fd.get("topic") ?? topicOk), message: String(fd.get("message") ?? "") || (compact ? "Cần tư vấn thêm về góc live (từ công cụ chọn đèn)." : ""),
      consent: fd.get("consent") === "on",
      context: { ...context, ...extra, page: location.pathname }, source, idempotencyKey: key.current, website: String(fd.get("website") ?? ""),
    };
    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success || !contact) {
      const errs: Errors = {};
      for (const i of parsed.success ? [] : parsed.error.issues) {
        const k = String(i.path[0]);
        const field = k === "email" || k === "phone" ? "contact" : k;
        errs[field] ??= field === "contact" ? "Vui lòng nhập số điện thoại hoặc email hợp lệ" : field === "name" ? "Vui lòng nhập họ tên" : field === "consent" ? "Vui lòng xác nhận trước khi gửi" : i.message;
      }
      if (!contact) errs.contact = "Vui lòng nhập số điện thoại hoặc email";
      setErrors(errs); setServerMsg("");
      setState("idle");
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setErrors({}); setState("sending"); setServerMsg("");
    try {
      const photo = fd.get("photo");
      const hasPhoto = photo instanceof File && photo.size > 0;
      let res: Response;
      if (hasPhoto) {
        const mp = new FormData(); mp.set("payload", JSON.stringify(payload)); mp.set("photo", photo);
        res = await fetch("/api/leads", { method: "POST", body: mp });
      } else {
        res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setCode(data.code);
        setSent([LEAD_TOPICS.find((t) => t.value === payload.topic)?.label ?? "Tư vấn", ...Object.values(extra)].slice(0, 4));
        setState("done");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (data.fieldErrors) {
        const fe: Errors = {};
        for (const [k, v] of Object.entries(data.fieldErrors as Errors)) fe[k === "email" || k === "phone" ? "contact" : k] = v;
        setErrors(fe);
      }
      setServerMsg(data.message ?? "Vui lòng thử lại. Nội dung bạn nhập vẫn hiển thị bên dưới.");
      setState("error");
    } catch {
      setServerMsg("Mất kết nối. Nội dung bạn nhập vẫn hiển thị bên dưới — bấm Thử gửi lại khi có mạng.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div role="status" aria-live="polite">
        <div className="card border-brand p-6 text-center sm:p-8">
          <span className="relative mx-auto block w-fit text-brand"><Icon name="checkCircle" size={92} stroke={1.6} /><Icon name="spark" size={34} className="absolute -right-6 -top-3" stroke={2.4} /></span>
          <p className="mt-3 text-[26px] font-extrabold leading-tight sm:text-[32px]">Đã nhận yêu cầu của bạn</p>
          <p className="mt-2 text-[16px] text-ink-soft">HULAKO sẽ liên hệ qua thông tin bạn đã cung cấp.</p>
          <div className="mx-auto mt-5 flex max-w-md items-center rounded-xl border border-line bg-paper text-left">
            <span className="flex items-center gap-3 border-r border-line px-4 py-3 text-ink-soft"><Icon name="file" size={24} />Mã yêu cầu</span>
            <span className="flex-1 px-4 text-center font-mono text-[22px] font-extrabold tracking-wide">{code}</span>
          </div>
        </div>
        {sent.length > 0 && (
          <>
            <h3 className="mt-6 text-[20px] font-bold">Thông tin đã gửi</h3>
            <ul className="mt-3 flex flex-wrap gap-2">{sent.map((s) => <li key={s} className="chip !min-h-[40px] !text-[15px]">{s}</li>)}</ul>
          </>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/goc-livestream" className="btn-primary !min-h-[52px]">Xem hướng dẫn setup <Icon name="chevron" size={20} /></Link>
          <Link href="/" className="btn-line !min-h-[52px]">Về trang chủ</Link>
        </div>
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-card"><Image src={successImage} alt="" fill sizes="(max-width:1024px) 100vw, 600px" className="object-cover" /></div>
      </div>
    );
  }

  const err = (k: string) => errors[k] ? <p id={`e-${k}`} className="field-error"><Icon name="alert" size={16} />{errors[k]}</p> : null;
  const aria = (k: string) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `e-${k}` : undefined, className: `input ${errors[k] ? "input-error" : ""}` });
  const hasFieldErrors = Object.keys(errors).length > 0;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      {title && <h2 className="text-[24px] font-extrabold sm:text-[30px]">{title}</h2>}
      {(hasFieldErrors && state !== "error") && (
        <p role="alert" className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3.5 text-[16px] font-medium text-red-700"><Icon name="alert" size={26} />Vui lòng kiểm tra các trường bên dưới</p>
      )}
      {state === "error" && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">
          <Icon name="alert" size={28} className="shrink-0" />
          <div><p className="text-[18px] font-bold">Chưa gửi được yêu cầu</p><p className="mt-1 text-[15px] text-ink-soft">{serverMsg}</p></div>
        </div>
      )}
      {Object.keys(context).length > 0 && !compact && (
        <p className="rounded-xl bg-brand-tint p-3 text-sm text-ink-soft">Kèm thông tin: {Object.entries(context).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
      )}
      <div>
        <label htmlFor="f-name" className="label req">Họ và tên</label>
        <input id="f-name" name="name" autoComplete="name" placeholder={compact ? "Nhập họ và tên" : undefined} {...aria("name")} />
        {err("name")}
      </div>
      <div>
        <label htmlFor="f-contact" className="label req">{compact ? "Email hoặc số điện thoại" : "Số điện thoại hoặc email"}</label>
        <input id="f-contact" name="contact" autoComplete="tel" inputMode="email" placeholder={compact ? "Nhập email hoặc số điện thoại" : undefined} {...aria("contact")} />
        {err("contact")}
      </div>
      {!compact && (
        <div>
          <label htmlFor="f-topic" className="label req">Chủ đề</label>
          <div className="relative">
            <select id="f-topic" name="topic" defaultValue={topicOk} {...aria("topic")} className={`${aria("topic").className} appearance-none pr-10`}>
              {LEAD_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <Icon name="chevronDown" size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          </div>
          {err("topic")}
        </div>
      )}
      <div>
        <label htmlFor="f-message" className={`label ${compact ? "" : "req"}`}>{compact ? "Mô tả thêm về góc live" : "Nội dung cần tư vấn"}</label>
        <textarea id="f-message" name="message" rows={compact ? 4 : 4} defaultValue={defaultMessage} placeholder={compact ? "Nhập mô tả thêm (nếu có)" : "Phòng bạn khoảng bao nhiêu m²? Bán gì, live ngồi hay đứng? Đang có thiết bị gì?"} {...aria("message")} />
        {err("message")}
      </div>

      {!compact && (
        <details className="card group">
          <summary className="flex min-h-[50px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold">
            Thêm thông tin góc live (không bắt buộc)<Icon name="chevronDown" size={20} className="group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-3">
            {([["mon-hang", "Món hàng", ITEMS], ["kieu-quay", "Kiểu quay", STYLES], ["dien-tich", "Khoảng trống ước lượng", AREAS]] as const).map(([n, l, opts]) => (
              <div key={n}><label htmlFor={`f-${n}`} className="label !text-sm">{l}</label>
                <select id={`f-${n}`} name={n} className="input" defaultValue=""><option value="">—</option>{opts.map((o) => <option key={o}>{o}</option>)}</select></div>
            ))}
            <div className="sm:col-span-3">
              <label htmlFor="f-photo" className="label !text-sm">Ảnh phòng (JPG/PNG, tối đa 5 MB)</label>
              <label className={`flex min-h-[64px] cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 text-ink-soft hover:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${errors.photo ? "border-red-500" : "border-line"}`}>
                <Icon name="upload" size={24} />{photoName || "Chọn ảnh góc phòng bạn định live"}
                <input id="f-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-describedby="h-photo" onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? "")} />
              </label>
              <p id="h-photo" className="mt-1 text-[13px] text-ink-muted">Ảnh chỉ tư vấn viên phụ trách xem, không hiển thị công khai.</p>
              {err("photo")}
            </div>
          </div>
        </details>
      )}

      {/* Ô bẫy bot: ẩn với người dùng và trình đọc màn hình */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div>
        <label className="flex items-start gap-3 text-[15px] sm:text-[16px]">
          <input id="f-consent" name="consent" type="checkbox" className={`mt-0.5 h-6 w-6 shrink-0 rounded accent-[#FA6803] ${errors.consent ? "outline outline-2 outline-red-500" : ""}`} aria-invalid={!!errors.consent || undefined} aria-describedby={`h-consent${errors.consent ? " e-consent" : ""}`} />
          <span>{compact ? "Tôi đồng ý để HULAKO liên hệ tư vấn về nhu cầu của tôi" : "Tôi đồng ý để HULAKO liên hệ về yêu cầu này."}</span>
        </label>
        <p id="h-consent" className="ml-9 mt-1 text-[13px] text-ink-muted">{consentText}</p>
        {err("consent")}
      </div>
      <button type="submit" className="btn-primary !min-h-[56px] w-full !text-[18px]" disabled={state === "sending"}>
        {state === "sending" ? "Đang gửi…" : state === "error" ? <>Thử gửi lại <Icon name="chevron" size={20} /></> : compact ? "Gửi thông tin tư vấn" : "Gửi yêu cầu"}
      </button>
      {state === "error" && <Link href="/ve-hulako" className="btn-outline w-full !text-ink">Chọn kênh liên hệ khác <Icon name="chevron" size={18} /></Link>}
      {onEdit && <button type="button" onClick={onEdit} className="btn-line w-full">Sửa câu trả lời</button>}
    </form>
  );
}
