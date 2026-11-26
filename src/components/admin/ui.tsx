// Thành phần dùng chung cho trang quản trị — theo bộ mockup (thẻ trắng viền #E6E3DF bo 14px, cam #FA6803).
import Link from "next/link";
import { Icon, type IconName } from "./icons";

/** Tiêu đề trang: nút quay lại (tuỳ chọn), nhãn nhỏ cạnh tiêu đề, phụ đề và nhóm nút bên phải */
export function PageTitle({ title, children, back, tag, subtitle }: {
  title: string; children?: React.ReactNode; back?: string; tag?: React.ReactNode; subtitle?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {back && (
          <Link href={back} aria-label="Quay lại" className="mt-1 inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-line bg-white hover:border-ink/30">
            <Icon name="arrowLeft" />
          </Link>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[34px]">{title}</h1>
            {tag}
          </div>
          {subtitle && <div className="mt-1 text-[15px] text-ink-muted">{subtitle}</div>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  draft: ["Bản nháp", "bg-[#EFEDEA] text-ink-soft"],
  review: ["Chờ duyệt", "bg-brand-soft text-brand-dark"],
  approved: ["Đã duyệt", "bg-[#E7F6EC] text-[#1E7B3C]"],
  scheduled: ["Đã lên lịch", "bg-[#EEF2FF] text-[#3730A3]"],
  published: ["Đã xuất bản", "bg-[#E7F6EC] text-[#1E7B3C]"],
  archived: ["Lưu trữ", "bg-[#F1F0EE] text-ink-muted"],
  public: ["Công khai", "bg-[#E7F6EC] text-[#1E7B3C]"],
  paused: ["Tạm ngừng bán", "bg-[#FFF4D6] text-[#8A5A00]"],
  open: ["Đang mở", "bg-[#E7F6EC] text-[#1E7B3C]"],
  closed: ["Đã đóng", "bg-[#EFEDEA] text-ink-soft"],
  hidden: ["Ẩn", "bg-[#EFEDEA] text-ink-soft"],
  new: ["Mới", "bg-brand-soft text-brand-dark"],
  assigned: ["Đã phân công", "bg-[#EEF2FF] text-[#3730A3]"],
  in_progress: ["Đang xử lý", "bg-[#FFF4D6] text-[#8A5A00]"],
  resolved: ["Đã xử lý", "bg-[#E7F6EC] text-[#1E7B3C]"],
  screening: ["Sàng lọc", "bg-[#EFEDEA] text-ink-soft"],
  interview: ["Phỏng vấn", "bg-[#EEF2FF] text-[#3730A3]"],
  result: ["Kết quả", "bg-[#E7F6EC] text-[#1E7B3C]"],
  queued: ["Chờ", "bg-[#EFEDEA] text-ink-soft"],
  running: ["Đang chạy", "bg-[#EEF2FF] text-[#3730A3]"],
  waiting_runner: ["Chờ runner trên máy", "bg-[#FFF4D6] text-[#8A5A00]"],
  runner_running: ["Runner đang xử lý", "bg-[#EEF2FF] text-[#3730A3]"],
  done: ["Hoàn thành", "bg-[#E7F6EC] text-[#1E7B3C]"],
  failed: ["Thất bại", "bg-[#FDECEC] text-[#B42318]"],
  skipped: ["Bỏ qua", "bg-[#F1F0EE] text-ink-muted"],
  cancelled: ["Đã huỷ", "bg-[#F1F0EE] text-ink-muted"],
  pending: ["Chờ duyệt", "bg-brand-soft text-brand-dark"],
  active: ["Đang hiệu lực", "bg-[#E7F6EC] text-[#1E7B3C]"],
  disabled: ["Đã khoá", "bg-[#FDECEC] text-[#B42318]"],
  retired: ["Đã thay", "bg-[#F1F0EE] text-ink-muted"],
  drafted: ["Đã có nháp", "bg-[#EEF2FF] text-[#3730A3]"],
  briefed: ["Đã có brief", "bg-[#EEF2FF] text-[#3730A3]"],
  dismissed: ["Bỏ qua", "bg-[#F1F0EE] text-ink-muted"],
  ok: ["Hoạt động", "bg-[#E7F6EC] text-[#1E7B3C]"],
  pending_check: ["Cần kiểm tra lại", "bg-brand-soft text-brand-dark"],
  broken: ["Liên kết lỗi", "bg-[#FDECEC] text-[#B42318]"],
  unchecked: ["Chưa kiểm tra", "bg-[#EFEDEA] text-ink-soft"],
  configured: ["Đã kết nối", "bg-[#E7F6EC] text-[#1E7B3C]"],
  not_configured: ["Chưa kết nối", "bg-[#EFEDEA] text-ink-soft"],
  sent: ["Đã gửi", "bg-[#E7F6EC] text-[#1E7B3C]"],
  in_opportunity: ["Đang dùng", "bg-[#EEF2FF] text-[#3730A3]"],
};

export function Badge({ status, label }: { status: string; label?: string }) {
  const [l, cls] = STATUS[status] ?? [status, "bg-[#EFEDEA] text-ink-soft"];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${cls}`}>{label ?? l}</span>;
}

/** Nhãn "Dữ liệu minh họa" / "Bài mẫu" dùng trên hàng & tiêu đề */
export function SampleTag({ children = "Dữ liệu minh họa", tone = "brand" }: { children?: React.ReactNode; tone?: "brand" | "muted" }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-[13px] font-semibold sm:whitespace-nowrap ${tone === "brand" ? "bg-brand-soft text-brand-dark" : "bg-[#EFEDEA] text-ink-soft"}`}>{children}</span>
  );
}

export function Panel({ title, children, actions, className = "", icon, id }: {
  title?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode; className?: string; icon?: IconName; id?: string;
}) {
  return (
    <section id={id} className={`card mb-5 p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight">{icon && <IconBox icon={icon} size="sm" />}{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function IconBox({ icon, size = "md", tone = "brand" }: { icon: IconName; size?: "sm" | "md" | "lg"; tone?: "brand" | "green" | "red" | "muted" }) {
  const s = size === "lg" ? "h-16 w-16 rounded-2xl" : size === "sm" ? "h-10 w-10 rounded-xl" : "h-12 w-12 rounded-xl";
  const i = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const t = tone === "green" ? "bg-[#E7F6EC] text-[#1E7B3C]" : tone === "red" ? "bg-[#FDECEC] text-[#B42318]" : tone === "muted" ? "bg-[#F1F0EE] text-ink-muted" : "bg-brand-soft text-brand";
  return <span className={`inline-flex flex-none items-center justify-center ${s} ${t}`}><Icon name={icon} className={i} /></span>;
}

/** Thẻ số liệu: icon cam + nhãn + giá trị. Không có dữ liệu → hiện "—" */
export function StatCard({ icon, label, value, href, hint }: { icon: IconName; label: string; value: React.ReactNode; href?: string; hint?: React.ReactNode }) {
  const body = (
    <>
      <IconBox icon={icon} size="lg" />
      <div className="min-w-0">
        <p className="text-[17px] font-semibold">{label}</p>
        <p className="mt-1 text-[28px] font-extrabold leading-none">{value ?? "—"}</p>
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </div>
    </>
  );
  return href
    ? <Link href={href} className="card flex items-center gap-4 p-5 transition hover:border-brand">{body}</Link>
    : <div className="card flex items-center gap-4 p-5">{body}</div>;
}

export function EmptyState({ icon = "file", title, text, children }: { icon?: IconName; title: string; text?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <span className="text-ink-muted/70"><Icon name={icon} className="h-12 w-12" strokeWidth={1.4} /></span>
      <p className="mt-3 text-lg font-bold">{title}</p>
      {text && <p className="mt-1 max-w-md text-[15px] text-ink-muted">{text}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Dải thông báo màu (cảnh báo cam, thông tin xám, lỗi đỏ, thành công xanh) */
export function Notice({ tone = "warn", title, children, action, icon }: {
  tone?: "warn" | "info" | "error" | "ok"; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; icon?: IconName;
}) {
  const t = {
    warn: ["bg-brand-tint border-brand/30 text-ink", "text-brand", "alert"],
    info: ["bg-[#F4F1ED] border-line text-ink-soft", "text-ink-muted", "info"],
    error: ["bg-[#FDECEC] border-[#F5C2C2] text-[#7A1A1A]", "text-[#B42318]", "xCircle"],
    ok: ["bg-[#E7F6EC] border-[#BFE5CC] text-[#14532D]", "text-[#1E7B3C]", "checkCircle"],
  }[tone];
  return (
    <div role={tone === "error" || tone === "warn" ? "alert" : "status"} className={`mb-5 flex flex-wrap items-center gap-3 rounded-card border px-4 py-3 ${t[0]}`}>
      <span className={t[1]}><Icon name={icon ?? t[2]} className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="text-[15px]">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, name, defaultValue, type = "text", hint, required, rows, options, placeholder, icon, readOnly, inline }: {
  label: string; name: string; defaultValue?: string | number | null; type?: string; hint?: string; required?: boolean; rows?: number;
  options?: { value: string; label: string }[]; placeholder?: string; icon?: IconName; readOnly?: boolean; inline?: boolean;
}) {
  const id = `fld-${name}`;
  const control = options ? (
    <select id={id} name={name} defaultValue={defaultValue ?? ""} className="input" disabled={readOnly}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
  ) : rows ? (
    <textarea id={id} name={name} rows={rows} defaultValue={defaultValue ?? ""} className="input font-[inherit]" placeholder={placeholder} readOnly={readOnly} />
  ) : icon ? (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name={icon} /></span>
      <input id={id} name={name} type={type} defaultValue={defaultValue ?? ""} className="input pl-11" required={required} placeholder={placeholder} readOnly={readOnly} />
    </div>
  ) : (
    <input id={id} name={name} type={type} defaultValue={defaultValue ?? ""} className="input" required={required} placeholder={placeholder} readOnly={readOnly} />
  );
  if (inline) {
    return (
      <div className="grid items-center gap-2 sm:grid-cols-[180px_1fr]">
        <label htmlFor={id} className="text-[15px] font-semibold">{label}{required && <span className="text-brand"> *</span>}</label>
        <div>{control}{hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}</div>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[15px] font-semibold">{label}{required && <span className="text-brand"> *</span>}</label>
      {control}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Ô đánh dấu dữ liệu minh hoạ — dùng cho sản phẩm, góc live, bài viết, tin tuyển dụng */
export function DemoCheckbox({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-dashed border-brand/40 bg-brand-tint px-3 py-2.5 text-sm">
      <input type="checkbox" name="isSample" defaultChecked={defaultChecked} className="mt-0.5" />
      <span><b>Dữ liệu minh họa (DEMO)</b> — hiện nhãn minh họa ngoài web</span>
    </label>
  );
}

/** Công tắc bật/tắt (checkbox gửi "on") */
export function Toggle({ name, defaultChecked, label, disabled }: { name: string; defaultChecked?: boolean; label?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="adm-switch gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} />
      <span className="track" />
      {label && <span className="text-[15px]">{label}</span>}
    </label>
  );
}

export function Table({ head, children, empty, emptyText = "Chưa có dữ liệu.", className = "" }: { head: React.ReactNode[]; children: React.ReactNode; empty?: boolean; emptyText?: string; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-card border border-line bg-white p-2 ${className}`}>
      <table className="adm-table">
        <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="p-8 text-center text-ink-muted">{emptyText}</p>}
    </div>
  );
}

export type TabItem = { key: string; label: string; href?: string; icon?: IconName; count?: number };

/** Thẻ điều hướng. underline: gạch cam dưới (mặc định); pill: nền cam nhạt cho mục đang chọn */
export function Tabs({ tabs, current, base, variant = "underline", param = "tab", extra }: {
  tabs: TabItem[]; current: string; base?: string; variant?: "underline" | "pill"; param?: string; extra?: React.ReactNode;
}) {
  const href = (t: TabItem) => t.href ?? `${base}?${param}=${t.key}`;
  if (variant === "pill") {
    return (
      <nav className="mb-5 flex flex-wrap items-center justify-between gap-3" aria-label="Thẻ">
        <div className="inline-flex flex-wrap gap-1 rounded-card border border-line bg-white p-1.5">
          {tabs.map((t) => (
            <Link key={t.key} href={href(t)} aria-current={t.key === current ? "page" : undefined}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-[15px] font-semibold ${t.key === current ? "bg-brand-soft text-brand" : "text-ink hover:bg-black/5"}`}>
              {t.icon && <Icon name={t.icon} />}{t.label}{t.count != null && <span className="text-xs opacity-70">({t.count})</span>}
            </Link>
          ))}
        </div>
        {extra}
      </nav>
    );
  }
  return (
    <nav className="mb-5 flex items-end justify-between gap-3 border-b border-line" aria-label="Thẻ">
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <Link key={t.key} href={href(t)} aria-current={t.key === current ? "page" : undefined}
            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-3 text-[15px] font-semibold ${t.key === current ? "border-brand text-brand" : "border-transparent text-ink hover:text-brand-dark"}`}>
            {t.icon && <Icon name={t.icon} />}{t.label}{t.count != null && <span className="rounded-full bg-[#EFEDEA] px-2 text-xs text-ink-soft">{t.count}</span>}
          </Link>
        ))}
      </div>
      {extra && <div className="pb-2">{extra}</div>}
    </nav>
  );
}

/** Danh sách liên kết dạng hàng: icon + chữ + mũi tên (Việc cần xử lý, Bài liên quan...) */
export function LinkRow({ href, icon, children, sub, external }: { href: string; icon: IconName; children: React.ReactNode; sub?: React.ReactNode; external?: boolean }) {
  return (
    <Link href={href} target={external ? "_blank" : undefined} className="flex items-center gap-4 border-t border-[#EFECE8] py-3 first:border-t-0 hover:text-brand-dark">
      <IconBox icon={icon} size="sm" />
      <span className="min-w-0 flex-1"><span className="block font-medium">{children}</span>{sub && <span className="block text-xs text-ink-muted">{sub}</span>}</span>
      <Icon name="chevronRight" className="h-5 w-5 text-ink-muted" />
    </Link>
  );
}

/** Hàng nhãn — giá trị */
export function KV({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[#EFECE8] py-3 first:border-t-0">
      <span className="font-semibold">{label}</span><span className="text-right text-ink-soft">{children}</span>
    </div>
  );
}

/** Ô tìm kiếm có icon dùng trong form GET */
export function SearchInput({ name = "q", defaultValue, placeholder = "Tìm kiếm…", className = "" }: { name?: string; defaultValue?: string; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name="search" /></span>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} className="input pl-11" />
    </div>
  );
}

/** Hiển thị số; null/undefined → "Chưa có dữ liệu" */
export function Num({ v, fmt }: { v: number | null | undefined; fmt?: (n: number) => string }) {
  if (v == null || Number.isNaN(v)) return <span className="whitespace-nowrap rounded-full bg-[#EFEDEA] px-2.5 py-0.5 text-[13px] text-ink-muted">Chưa có dữ liệu</span>;
  return <>{fmt ? fmt(v) : v.toLocaleString("vi-VN")}</>;
}
