"use client";
// Popup quà tặng (lead magnet) trong bài Kiến thức / Tin tức.
// Hiện sau N giây HOẶC khi đọc tới X% bài (cấu hình ở Quản trị › Trang công ty › Popup). Đóng thì 3 ngày sau mới hiện lại,
// đăng ký xong thì không hiện nữa (lưu trong trình duyệt). Luôn có thẻ "Nhận quà" trong bài để khách tự mở.
// Bắt buộc: họ tên, số điện thoại, email, lĩnh vực kinh doanh, địa chỉ nhận hàng → POST /api/leads (source lead_magnet) → vào Tư vấn & Hỏi đáp.
import { useCallback, useEffect, useRef, useState } from "react";
import { magnetLeadSchema } from "@/lib/validators";
import { Icon } from "./site/Icon";

export type MagnetConfig = {
  title: string; subtitle: string; bullets: string[]; buttonLabel: string;
  delaySeconds: number; scrollPercent: number; businessOptions: string[];
};

const STORE = "hlk_magnet_v1";
const SNOOZE_DAYS = 3;
const OTHER = "__khac__";
type Errors = Partial<Record<"name" | "phone" | "email" | "businessField" | "shippingAddress" | "consent" | "_", string>>;

function readStore(): { closedAt?: number; done?: boolean } {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "{}"); } catch { return {}; }
}
function writeStore(v: { closedAt?: number; done?: boolean }) {
  try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* trình duyệt chặn lưu trữ: bỏ qua */ }
}

export function LeadMagnet({ cfg, consentText, articleTitle }: { cfg: MagnetConfig; consentText: string; articleTitle: string }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback((manual: boolean) => {
    if (!manual) {
      const s = readStore();
      if (s.done || (s.closedAt && Date.now() - s.closedAt < SNOOZE_DAYS * 86400_000)) return;
    }
    opener.current = (document.activeElement as HTMLElement) ?? null;
    setOpen(true);
  }, []);

  // Tự hiện: sau delaySeconds hoặc khi cuộn tới scrollPercent (lần nào tới trước)
  useEffect(() => {
    let fired = false;
    const fire = () => { if (!fired) { fired = true; show(false); cleanup(); } };
    const timer = window.setTimeout(fire, Math.max(5, cfg.delaySeconds) * 1000);
    const onScroll = () => {
      const h = document.documentElement;
      const pct = ((h.scrollTop + window.innerHeight) / Math.max(1, h.scrollHeight)) * 100;
      if (pct >= cfg.scrollPercent) fire();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    function cleanup() { window.clearTimeout(timer); window.removeEventListener("scroll", onScroll); }
    return cleanup;
  }, [cfg.delaySeconds, cfg.scrollPercent, show]);

  const close = useCallback((done = false) => {
    setOpen(false);
    writeStore(done ? { done: true } : { ...readStore(), closedAt: Date.now() });
    opener.current?.focus?.();
  }, []);

  return (
    <>
      {/* Thẻ mở popup ngay trong bài */}
      <aside className="card mt-8 flex flex-col gap-4 border-brand bg-brand-tint p-5 sm:flex-row sm:items-center sm:p-6" aria-label="Quà tặng">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-white"><Icon name="gift" size={30} /></span>
        <div className="flex-1">
          <p className="text-[19px] font-bold leading-snug">{cfg.title}</p>
          <p className="mt-1 text-[15px] text-ink-soft">{cfg.subtitle}</p>
        </div>
        <button type="button" onClick={() => show(true)} className="btn-primary shrink-0 !min-h-[52px] !px-6">{cfg.buttonLabel}</button>
      </aside>
      {open && <Modal cfg={cfg} consentText={consentText} articleTitle={articleTitle} onClose={close} />}
    </>
  );
}

function Modal({ cfg, consentText, articleTitle, onClose }: { cfg: MagnetConfig; consentText: string; articleTitle: string; onClose: (done?: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const key = useRef("");
  if (!key.current) key.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [code, setCode] = useState("");
  const [download, setDownload] = useState("");
  const [field, setField] = useState("");
  const done = state === "done";

  // Khoá cuộn trang, focus ô đầu tiên, Esc để đóng, giữ Tab trong hộp thoại
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(done);
      if (e.key === "Tab" && box.current) {
        const els = [...box.current.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea")].filter((x) => !x.hasAttribute("disabled") && x.offsetParent !== null);
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose, done]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const business = String(fd.get("businessField") ?? "");
    const payload = {
      name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? "").replace(/[\s.-]/g, ""), email: String(fd.get("email") ?? ""),
      businessField: business === OTHER ? String(fd.get("businessOther") ?? "") : business,
      shippingAddress: String(fd.get("shippingAddress") ?? ""),
      consent: fd.get("consent") === "on", source: "lead_magnet" as const,
      context: { "Bài viết": articleTitle, page: location.pathname }, idempotencyKey: key.current, website: String(fd.get("website") ?? ""),
    };
    const v = magnetLeadSchema.safeParse(payload);
    if (!v.success) {
      const errs: Errors = {};
      for (const i of v.error.issues) {
        const k = String(i.path[0] ?? "_") as keyof Errors;
        errs[k] ??= k === "consent" ? "Vui lòng xác nhận trước khi gửi" : i.message;
      }
      setErrors(errs);
      box.current?.querySelector<HTMLElement>(`[name="${Object.keys(errs)[0] === "businessField" && business === OTHER ? "businessOther" : Object.keys(errs)[0]}"]`)?.focus();
      return;
    }
    setErrors({});
    setState("sending");
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ ...(data.fieldErrors ?? {}), _: data.message ?? "Chưa gửi được, vui lòng thử lại" });
        setState("idle");
        return;
      }
      setCode(data.code ?? "");
      setDownload(data.downloadUrl ?? "");
      setState("done");
      writeStore({ done: true });
    } catch {
      setErrors({ _: "Mất kết nối mạng. Thông tin vẫn còn trong ô, bạn bấm gửi lại nhé." });
      setState("idle");
    }
  }

  const err = (k: keyof Errors) => errors[k] && <p id={`lm-${k}-err`} className="mt-1 text-[14px] font-medium text-[#B42318]">{errors[k]}</p>;
  const aria = (k: keyof Errors) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `lm-${k}-err` : undefined });

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(done); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="lm-title"
        className="relative grid max-h-[94vh] w-full max-w-[920px] overflow-y-auto rounded-t-[22px] bg-white shadow-2xl sm:rounded-[22px] md:grid-cols-[0.9fr_1.1fr]">
        <button type="button" onClick={() => onClose(done)} aria-label="Đóng" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink hover:bg-paper">
          <Icon name="x" size={24} />
        </button>

        {/* Bên trái: giới thiệu quà */}
        <div className="bg-brand-tint px-6 pb-5 pt-7 sm:px-8 md:py-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3.5 py-1.5 text-[14px] font-bold uppercase tracking-wide text-white"><Icon name="gift" size={18} />Quà tặng miễn phí</span>
          <h2 id="lm-title" className="mt-4 pr-10 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]">{cfg.title}</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">{cfg.subtitle}</p>
          {cfg.bullets.length > 0 && (
            <ul className="mt-5 hidden space-y-3 sm:block">
              {cfg.bullets.map((b) => <li key={b} className="flex gap-3 text-[16px]"><Icon name="checkCircle" size={22} className="mt-0.5 shrink-0 text-brand" />{b}</li>)}
            </ul>
          )}
        </div>

        {/* Bên phải: form hoặc thông báo thành công */}
        <div className="px-6 pb-7 pt-5 sm:px-8 md:py-9">
          {done ? (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center" role="status">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F6EC] text-[#1E7B3C]"><Icon name="check" size={34} stroke={2.6} /></span>
              <p className="mt-4 text-[22px] font-bold">Đăng ký thành công!</p>
              <p className="mt-2 text-[16px] text-ink-soft">HULAKO đã nhận thông tin{code ? <> (mã <b>{code}</b>)</> : null}. {download ? "Bạn tải quà ngay bên dưới." : "Nhân viên sẽ liên hệ và gửi quà cho bạn sớm."}</p>
              {download && <a href={download} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 !min-h-[52px] !px-7">Tải quà ngay</a>}
              <button type="button" onClick={() => onClose(true)} className="btn-line mt-3">Tiếp tục đọc bài</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-3.5">
              <p className="text-[16px] font-semibold">Điền thông tin để nhận quà</p>
              <label className="block"><span className="label">Họ và tên <span className="text-brand">*</span></span>
                <input name="name" autoComplete="name" className="input" placeholder="Nguyễn Văn A" {...aria("name")} />{err("name")}</label>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block"><span className="label">Số điện thoại <span className="text-brand">*</span></span>
                  <input name="phone" type="tel" inputMode="tel" autoComplete="tel" className="input" placeholder="0912 345 678" {...aria("phone")} />{err("phone")}</label>
                <label className="block"><span className="label">Email <span className="text-brand">*</span></span>
                  <input name="email" type="email" inputMode="email" autoComplete="email" className="input" placeholder="ban@email.com" {...aria("email")} />{err("email")}</label>
              </div>
              <label className="block"><span className="label">Lĩnh vực kinh doanh <span className="text-brand">*</span></span>
                <select name="businessField" className="input" value={field} onChange={(e) => setField(e.target.value)} {...aria("businessField")}>
                  <option value="">Chọn lĩnh vực bạn đang bán</option>
                  {cfg.businessOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  <option value={OTHER}>Khác…</option>
                </select>
                {field === OTHER && <input name="businessOther" className="input mt-2" placeholder="Bạn đang kinh doanh gì?" maxLength={80} aria-label="Lĩnh vực kinh doanh khác" />}
                {err("businessField")}</label>
              <label className="block"><span className="label">Địa chỉ nhận hàng <span className="text-brand">*</span></span>
                <textarea name="shippingAddress" rows={2} autoComplete="street-address" maxLength={300} className="input" placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" {...aria("shippingAddress")} />{err("shippingAddress")}</label>
              {/* ô ẩn bẫy bot */}
              <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              <label className="flex items-start gap-3 text-[14px] leading-relaxed text-ink-soft">
                <input type="checkbox" name="consent" className="mt-1 h-5 w-5 shrink-0 accent-[#FA6803]" {...aria("consent")} />
                <span>Tôi đồng ý để HULAKO dùng thông tin này để gửi quà và liên hệ tư vấn. {consentText}</span>
              </label>
              {err("consent")}
              {errors._ && <p role="alert" className="rounded-lg bg-[#FDECEC] px-3 py-2 text-[15px] text-[#7A1A1A]">{errors._}</p>}
              <button type="submit" disabled={state === "sending"} className="btn-primary w-full !min-h-[56px] !text-[18px]">
                <Icon name="gift" size={22} />{state === "sending" ? "Đang gửi…" : cfg.buttonLabel}
              </button>
              <p className="text-center text-[13px] text-ink-muted">Miễn phí. HULAKO không chia sẻ thông tin của bạn cho bên khác.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
