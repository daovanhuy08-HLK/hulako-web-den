"use client";
// Bảng "Thông số đã xác nhận" (màn 045): thêm/xoá dòng Thuộc tính – Giá trị.
// Gửi về máy chủ dưới dạng ô ẩn name="specs" mỗi dòng "Nhãn: Giá trị" (đúng định dạng saveVariant đang đọc).
import { useState } from "react";
import { Icon } from "./icons";

export function SpecsEditor({ initial }: { initial: { label: string; value: string }[] }) {
  const [rows, setRows] = useState(initial.length ? initial : [{ label: "", value: "" }]);
  const set = (i: number, k: "label" | "value", v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const text = rows.filter((r) => r.label.trim()).map((r) => `${r.label.trim()}: ${r.value.trim()}`).join("\n");
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="grid grid-cols-[1fr_1fr_48px] gap-3 bg-[#F4F1ED] px-4 py-3 font-semibold"><span>Thuộc tính</span><span>Giá trị</span><span /></div>
      <div className="space-y-3 p-4">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_48px] gap-3">
            <input className="input" value={r.label} onChange={(e) => set(i, "label", e.target.value)} placeholder="vd Nhiệt độ màu" aria-label={`Thuộc tính ${i + 1}`} />
            <input className="input" value={r.value} onChange={(e) => set(i, "value", e.target.value)} placeholder="vd 5600K" aria-label={`Giá trị ${i + 1}`} />
            <button type="button" className="inline-flex items-center justify-center rounded-xl border border-line hover:border-red-300 hover:text-red-700" aria-label="Xoá dòng"
              onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [{ label: "", value: "" }]))}><Icon name="trash" className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" className="btn-line btn-sm" onClick={() => setRows((x) => [...x, { label: "", value: "" }])}><Icon name="plus" className="h-4 w-4" /> Thêm thông số</button>
      </div>
      <input type="hidden" name="specs" value={text} />
    </div>
  );
}
