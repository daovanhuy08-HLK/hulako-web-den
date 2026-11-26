"use client";
// Form ứng tuyển (P12; ảnh 015, 085; tệp sai định dạng 069; thành công 052, 093): PDF/DOCX ≤ 10 MB,
// kiểm tra ở trình duyệt và máy chủ (loại tệp thật), lỗi gắn với trường, giữ dữ liệu khi lỗi.
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "./site/Icon";

export function ApplyForm({ jobId, jobTitle, consentText, maxMb }: { jobId: string; jobTitle: string; consentText: string; maxMb: number }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const badFile = !!file && (!/\.(pdf|docx)$/i.test(file.name) || file.size > maxMb * 1024 * 1024);

  function pick(f: File | null) {
    setFile(f);
    setErrors((e) => {
      const n = { ...e }; delete n.cv;
      if (f && !/\.(pdf|docx)$/i.test(f.name)) n.cv = `Vui lòng chọn tệp PDF hoặc DOCX, tối đa ${maxMb} MB.`;
      else if (f && f.size > maxMb * 1024 * 1024) n.cv = `Tệp quá lớn. Vui lòng chọn tệp PDF hoặc DOCX, tối đa ${maxMb} MB.`;
      return n;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const contact = String(fd.get("contact") ?? "").trim();
    const errs: Record<string, string> = {};
    if (String(fd.get("name") ?? "").trim().length < 2) errs.name = "Vui lòng nhập họ tên";
    if (!contact) errs.contact = "Vui lòng nhập email hoặc số điện thoại";
    if (!file) errs.cv = "Vui lòng đính kèm CV (PDF hoặc DOCX)";
    else if (badFile) errs.cv = `Vui lòng chọn tệp PDF hoặc DOCX, tối đa ${maxMb} MB.`;
    if (fd.get("consent") !== "on") errs.consent = "Vui lòng xác nhận trước khi gửi";
    setErrors(errs);
    if (Object.keys(errs).length) { document.getElementById(`a-${Object.keys(errs)[0]}`)?.focus(); return; }
    const body = new FormData();
    body.set("name", String(fd.get("name"))); body.set("consent", "on"); body.set("note", String(fd.get("note") ?? ""));
    if (contact.includes("@")) body.set("email", contact); else body.set("phone", contact.replace(/[\s.-]/g, ""));
    body.set("cv", file!);
    setState("sending"); setMsg("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/applications`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) { setCode(data.code); setState("done"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (data.fieldErrors) {
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.fieldErrors as Record<string, string>)) fe[k === "email" || k === "phone" ? "contact" : k] = v;
        setErrors(fe);
      }
      setMsg(data.message ?? "Chưa gửi được hồ sơ, vui lòng thử lại."); setState("error");
    } catch {
      setMsg("Mất kết nối. Thông tin bạn nhập vẫn còn — bấm Gửi hồ sơ để thử lại."); setState("error");
    }
  }

  if (state === "done") return (
    <div role="status" aria-live="polite" className="text-center">
      <span className="relative mx-auto block w-fit text-brand"><Icon name="checkCircle" size={110} stroke={1.5} /></span>
      <p className="mt-3 text-[28px] font-extrabold sm:text-[40px]">Đã nhận hồ sơ của bạn</p>
      <p className="mt-2 text-[16px] text-ink-soft sm:text-[19px]">Bộ phận tuyển dụng sẽ xem xét hồ sơ và liên hệ qua thông tin bạn đã gửi.</p>
      <dl className="card mx-auto mt-7 max-w-xl divide-y divide-line px-5 text-left text-[16px] sm:text-[18px]">
        <div className="flex items-center gap-4 py-4"><Icon name="briefcase" size={26} className="text-ink-soft" /><dt className="w-36 text-ink-soft">Vị trí ứng tuyển</dt><dd className="font-bold">{jobTitle}</dd></div>
        <div className="flex items-center gap-4 py-4"><Icon name="file" size={26} className="text-ink-soft" /><dt className="w-36 text-ink-soft">Mã hồ sơ</dt><dd className="font-mono font-extrabold">{code}</dd></div>
        <div className="flex items-center gap-4 py-4"><Icon name="clip" size={26} className="text-ink-soft" /><dt className="w-36 text-ink-soft">CV đã gửi</dt><dd className="truncate font-bold">{file?.name}</dd></div>
      </dl>
      <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
        <Link href="/tuyen-dung" className="btn-primary !min-h-[56px] !text-[18px]">Xem vị trí khác <Icon name="chevron" size={20} /></Link>
        <Link href="/" className="btn-outline !min-h-[56px] !text-[18px]">Về trang chủ</Link>
      </div>
      <div className="relative mx-auto mt-7 aspect-[728/452] max-w-xl overflow-hidden rounded-card"><Image src="/demo/ung-tuyen-ok.jpg" alt="" fill sizes="600px" className="object-cover" /></div>
    </div>
  );

  const err = (k: string) => errors[k] ? <p id={`ae-${k}`} className="field-error"><Icon name="alert" size={16} />{errors[k]}</p> : null;
  const aria = (k: string) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `ae-${k}` : undefined, className: `input !min-h-[56px] ${errors[k] ? "input-error" : ""}` });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div><label htmlFor="a-name" className="label !text-[17px]">Họ và tên</label><input id="a-name" name="name" autoComplete="name" placeholder="Nhập họ và tên" {...aria("name")} />{err("name")}</div>
      <div><label htmlFor="a-contact" className="label !text-[17px]">Email hoặc số điện thoại</label><input id="a-contact" name="contact" autoComplete="email" placeholder="Nhập email hoặc số điện thoại" {...aria("contact")} />{err("contact")}</div>
      <div>
        <p className="label !text-[17px] font-semibold" id="a-cv-label">CV</p>
        <input ref={fileRef} id="a-cv" name="cv" type="file" className="sr-only" aria-labelledby="a-cv-label" aria-describedby={errors.cv ? "ae-cv" : "a-cv-hint"}
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className={`flex items-center gap-4 rounded-xl border p-4 ${badFile ? "border-red-300 bg-red-50/60" : "border-line bg-white"}`}>
            <Icon name="file" size={34} className="shrink-0 text-ink-soft" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">{file.name}</p>
              {badFile ? <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-[13px] font-semibold text-red-700">Không hỗ trợ</span>
                : <span className="text-[13px] text-ink-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
            </div>
            <button type="button" onClick={() => { pick(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Bỏ tệp đã chọn" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5"><Icon name="x" size={22} /></button>
          </div>
        ) : (
          <label htmlFor="a-cv" className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white text-ink-muted hover:border-brand ${errors.cv ? "border-red-400" : "border-line"}`}>
            <Icon name="upload" size={40} className="text-ink-soft" /><span className="font-semibold text-ink sm:hidden">Tải CV lên</span>
            <span id="a-cv-hint" className="text-[15px] sm:text-[18px]">PDF, DOCX · Tối đa {maxMb} MB</span>
          </label>
        )}
        {err("cv")}
        {file && badFile && <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline mt-3 w-full !text-ink"><Icon name="upload" size={20} />Chọn tệp khác</button>}
      </div>
      <div><label htmlFor="a-note" className="label !text-[17px]">Giới thiệu ngắn (không bắt buộc)</label><textarea id="a-note" name="note" rows={3} className="input" /></div>
      <div>
        <label className="flex items-start gap-3 text-[16px] sm:text-[18px]">
          <input id="a-consent" name="consent" type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[#FA6803]" aria-invalid={!!errors.consent || undefined} aria-describedby={`a-consent-h${errors.consent ? " ae-consent" : ""}`} />
          <span>Tôi đồng ý để HULAKO xử lý hồ sơ ứng tuyển</span>
        </label>
        <p id="a-consent-h" className="ml-9 mt-1 text-[13px] text-ink-muted">{consentText}</p>
        {err("consent")}
      </div>
      {msg && <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 font-medium text-red-700"><Icon name="alert" size={22} />{msg}</p>}
      <button className="btn-primary !min-h-[60px] w-full !text-[20px] disabled:!bg-[#D9D6D2] disabled:!text-ink-muted disabled:!opacity-100" disabled={state === "sending" || badFile}>{state === "sending" ? "Đang gửi…" : "Gửi hồ sơ"}</button>
      {badFile && <p className="flex items-center gap-3 rounded-xl bg-paper p-3 text-[15px] text-ink-soft ring-1 ring-line"><Icon name="alert" size={20} />Kiểm tra tệp trước khi gửi.</p>}
    </form>
  );
}
