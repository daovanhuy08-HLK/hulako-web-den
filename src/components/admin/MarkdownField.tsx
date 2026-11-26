"use client";
// Ô soạn Markdown có thanh công cụ (đoạn văn/tiêu đề, đậm, nghiêng, danh sách, liên kết, ảnh, video, bảng).
// Vẫn là <textarea name=...> thật → gửi form bình thường, không cần thư viện soạn thảo nặng.
import { useRef } from "react";
import { Icon } from "./icons";

type Op = { label: string; title: string; icon?: string; run: (sel: string) => [string, string, string] };

const OPS: Op[] = [
  { label: "B", title: "In đậm", run: (s) => ["**", s || "chữ đậm", "**"] },
  { label: "I", title: "In nghiêng", run: (s) => ["_", s || "chữ nghiêng", "_"] },
  { label: "•", title: "Danh sách", icon: "menu", run: (s) => ["\n- ", s || "mục", "\n"] },
  { label: "1.", title: "Danh sách đánh số", run: (s) => ["\n1. ", s || "bước", "\n"] },
  { label: "”", title: "Trích dẫn / lưu ý", run: (s) => ["\n> ", s || "Lưu ý", "\n"] },
  { label: "", title: "Liên kết", icon: "link", run: (s) => ["[", s || "chữ hiển thị", "](/duong-dan)"] },
  { label: "", title: "Ảnh (dán URL từ Thư viện ảnh)", icon: "image", run: (s) => ["![", s || "mô tả ảnh", "](https://)"] },
  { label: "", title: "Video", icon: "video", run: () => ["\n<video src='", "https://", "'></video>\n"] },
  { label: "", title: "Bảng", icon: "bars", run: () => ["\n| Cột 1 | Cột 2 |\n| --- | --- |\n| ", "giá trị", " | |\n"] },
];

export function MarkdownField({ name, label, defaultValue, rows = 18, required, hint, placeholder }: {
  name: string; label?: string; defaultValue?: string | null; rows?: number; required?: boolean; hint?: string; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const apply = (fn: Op["run"]) => {
    const t = ref.current; if (!t) return;
    const { selectionStart: a, selectionEnd: b, value } = t;
    const [pre, mid, post] = fn(value.slice(a, b));
    t.setRangeText(pre + mid + post, a, b, "end");
    t.setSelectionRange(a + pre.length, a + pre.length + mid.length);
    t.focus();
  };
  const heading = (level: string) => {
    const t = ref.current; if (!t) return;
    const start = t.value.lastIndexOf("\n", t.selectionStart - 1) + 1;
    const line = t.value.slice(start).split("\n")[0];
    const clean = line.replace(/^#{1,6}\s*/, "");
    t.setRangeText((level ? `${level} ` : "") + clean, start, start + line.length, "end");
    t.focus();
  };
  const id = `md-${name}`;
  return (
    <div>
      {label && <label htmlFor={id} className="mb-1.5 block text-[15px] font-semibold">{label}{required && <span className="text-brand"> *</span>}</label>}
      <div className="overflow-hidden rounded-[10px] border border-line bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <div className="adm-md-toolbar flex flex-wrap items-center gap-1 border-b border-line bg-[#FBFAF8] px-2 py-1.5" role="toolbar" aria-label="Định dạng">
          <select aria-label="Kiểu đoạn" className="mr-1 h-9 rounded-lg border border-line bg-white px-2 text-sm" defaultValue="" onChange={(e) => { heading(e.target.value); e.target.value = ""; }}>
            <option value="" disabled>Đoạn văn</option>
            <option value="">Đoạn văn</option>
            <option value="##">Tiêu đề mục (H2)</option>
            <option value="###">Tiêu đề nhỏ (H3)</option>
          </select>
          {OPS.map((o) => (
            <button key={o.title} type="button" title={o.title} aria-label={o.title} onClick={() => apply(o.run)} className={o.label === "I" ? "italic" : ""}>
              {o.icon ? <Icon name={o.icon} className="h-[18px] w-[18px]" /> : o.label}
            </button>
          ))}
        </div>
        <textarea ref={ref} id={id} name={name} rows={rows} defaultValue={defaultValue ?? ""} placeholder={placeholder}
          className="block w-full resize-y border-0 bg-white px-4 py-3 font-[inherit] text-[16px] leading-7 focus:outline-none" />
      </div>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
