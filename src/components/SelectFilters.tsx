"use client";
// Bộ lọc dạng ô chọn có icon (ảnh 077): đổi lựa chọn là cập nhật URL ngay; không có JS vẫn dùng nút "Lọc".
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "./site/Icon";

export function SelectFilters({ base, filters }: { base: string; filters: { name: string; label: string; icon: IconName; value?: string; options: { value: string; label: string }[] }[] }) {
  const router = useRouter();
  return (
    <form action={base} className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:max-w-[1068px] lg:gap-6"
      onChange={(e) => {
        const fd = new FormData(e.currentTarget);
        const q = new URLSearchParams([...fd.entries()].filter(([, v]) => v) as [string, string][]).toString();
        router.push(q ? `${base}?${q}` : base, { scroll: false });
      }}>
      {filters.map((f) => (
        <label key={f.name} className="relative flex min-w-0 items-center">
          <span className="sr-only">{f.label}</span>
          <Icon name={f.icon} size={24} className="pointer-events-none absolute left-4 hidden text-ink-soft sm:block" />
          <select name={f.name} defaultValue={f.value ?? ""}
            className={`input appearance-none !min-h-[52px] pr-10 text-[15px] sm:pl-14 sm:text-[18px] ${f.value ? "!border-brand font-semibold" : ""}`}>
            <option value="">{f.label}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Icon name="chevronDown" size={20} className="pointer-events-none absolute right-3.5 text-ink-soft" />
        </label>
      ))}
      <noscript><button type="submit" className="btn-line">Lọc</button></noscript>
    </form>
  );
}
