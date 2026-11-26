"use client";
// Màn 056 Nhập từ khoá CSV — 3 bước ngay trên trình duyệt: Tải tệp → Đối chiếu cột → Xác nhận.
// Sau khi xác nhận, gửi CSV đã chuẩn hoá (query,search_volume,trend_score,cluster,intent) cho Server Action importCsv.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin";
import { Icon } from "./icons";

const FIELDS = [
  { key: "query", label: "Từ khóa", required: true, guess: /^(query|keyword|tu ?khoa|từ khóa|từ khoá|kw)$/i },
  { key: "cluster", label: "Nhóm / cụm", guess: /^(cluster|group|nhom|nhóm|cụm|cum|topic)$/i },
  { key: "intent", label: "Ý định", guess: /^(intent|y ?dinh|ý định)$/i },
  { key: "search_volume", label: "Lượng tìm kiếm", guess: /(volume|search_volume|luong|lượng)/i },
  { key: "trend_score", label: "Điểm xu hướng", guess: /(trend)/i },
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const clean = (s: string) => s.replace(/[,\r\n]/g, " ").trim();

export function CsvImport({ action }: { action: (fd: FormData) => Promise<ActionResult> }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, number>>({});
  const [res, setRes] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) { setRes({ ok: false, message: "Tệp quá lớn (tối đa 2 MB)" }); return; }
    const r = parseCsv(await f.text());
    setName(f.name); setRows(r); setRes(null);
    const m: Record<string, number> = {};
    for (const fl of FIELDS) { const i = (r[0] ?? []).findIndex((h) => fl.guess.test(h.trim())); if (i >= 0) m[fl.key] = i; }
    if (m.query == null && r[0]) m.query = 0;
    setMap(m); setStep(2);
  };

  const mapped = useMemo(() => body.map((r) => Object.fromEntries(FIELDS.map((f) => [f.key, map[f.key] != null ? clean(r[map[f.key]] ?? "") : ""])) as Record<string, string>), [body, map]);
  const valid = mapped.filter((r) => r.query);
  const seen = new Set<string>(); let dup = 0;
  for (const r of valid) { const k = norm(r.query); if (seen.has(k)) dup++; seen.add(k); }
  const badNum = valid.filter((r) => (r.search_volume && isNaN(Number(r.search_volume))) || (r.trend_score && isNaN(Number(r.trend_score)))).length;

  const submit = () => {
    const lines = ["query,search_volume,trend_score,cluster,intent", ...[...new Map(valid.map((r) => [norm(r.query), r])).values()]
      .map((r) => [r.query, isNaN(Number(r.search_volume)) ? "" : r.search_volume, isNaN(Number(r.trend_score)) ? "" : r.trend_score, r.cluster, r.intent].join(","))];
    const fd = new FormData(); fd.set("csvText", lines.join("\n"));
    start(async () => { const r = await action(fd); setRes(r); if (r.ok) { setStep(4); router.refresh(); } });
  };

  const Step = ({ n, label }: { n: number; label: string }) => (
    <div className={`flex items-center gap-3 ${step >= n ? "text-brand" : "text-ink-muted"}`}>
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 font-bold ${step > n ? "border-brand" : step === n ? "border-brand bg-brand text-white" : "border-line"}`}>{step > n ? <Icon name="check" /> : n}</span>
      <span className={`text-lg font-semibold ${step === n ? "" : step > n ? "text-ink" : ""}`}>{label}</span>
    </div>
  );

  return (
    <>
      <div className="card mb-5 flex flex-wrap items-center justify-center gap-4 px-6 py-4">
        <Step n={1} label="Tải tệp" /><span className={`hidden h-0.5 w-40 md:block ${step > 1 ? "bg-brand" : "bg-line"}`} />
        <Step n={2} label="Đối chiếu cột" /><span className={`hidden h-0.5 w-40 md:block ${step > 2 ? "bg-brand" : "bg-line"}`} />
        <Step n={3} label="Xác nhận" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="card p-6">
          {step === 1 && (
            <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-line p-8 text-center hover:border-brand">
              <Icon name="upload" className="h-10 w-10 text-brand" />
              <p className="mt-3 text-lg font-bold">Chọn tệp CSV</p>
              <p className="text-sm text-ink-muted">Dòng đầu là tên cột. Phân cách bằng dấu phẩy, chấm phẩy hoặc tab. Tối đa 5.000 dòng.</p>
              <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          )}
          {step >= 2 && step <= 3 && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-2xl font-bold">{step === 2 ? "Đối chiếu cột dữ liệu" : "Xác nhận nhập"}</h2><p className="text-ink-muted">{step === 2 ? "Chọn cột tương ứng trong tệp CSV cho từng trường bên dưới." : `Tệp ${name}: ${valid.length - dup} từ khoá sẽ được nhập/cập nhật.`}</p></div>
                <a className="btn-line btn-sm" download="mau-tu-khoa.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent("query,cluster,intent,search_volume,trend_score\nsetup góc livestream phòng nhỏ,setup-phong-nho,sau,,\ncách lắp softbox,chon-va-lap-softbox,sau,,\n")}`}><Icon name="download" className="h-4 w-4" /> Tệp minh họa</a>
              </div>
              {step === 2 && (
                <div className="mt-4">
                  {FIELDS.map((f) => (
                    <div key={f.key} className="grid items-center gap-3 border-t border-[#EFECE8] py-3 first:border-0 md:grid-cols-[220px_1fr]">
                      <span className="font-semibold">{f.label}{"required" in f && f.required && <span className="text-brand"> *</span>}</span>
                      <select className="input" value={map[f.key] ?? ""} onChange={(e) => setMap((m) => { const n = { ...m }; if (e.target.value === "") delete n[f.key]; else n[f.key] = Number(e.target.value); return n; })}>
                        <option value="">— Không có —</option>{header.map((h, i) => <option key={i} value={i}>{h || `Cột ${i + 1}`}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <h3 className="mb-1 mt-6 text-xl font-bold">Xem trước dữ liệu</h3>
              <p className="mb-3 text-sm text-ink-muted">5 dòng đầu sau khi đối chiếu cột. Cột thiếu lưu thành “Chưa có dữ liệu”.</p>
              <div className="overflow-x-auto"><table className="adm-table"><thead><tr>{FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                <tbody>{mapped.slice(0, 5).map((r, i) => <tr key={i}>{FIELDS.map((f) => <td key={f.key}>{r[f.key] || <span className="text-ink-muted">—</span>}</td>)}</tr>)}</tbody></table></div>
            </>
          )}
          {step === 4 && res?.ok && (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <span className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-[#E7F6EC] text-[#1E7B3C]"><Icon name="checkCircle" className="h-10 w-10" /></span>
              <p className="mt-4 text-2xl font-bold">{res.message}</p>
              <div className="mt-5 flex gap-3"><a href="/admin/seo?tab=keywords" className="btn-primary">Xem từ khoá</a><button className="btn-line" onClick={() => { setStep(1); setRows([]); setRes(null); }}>Nhập tệp khác</button></div>
            </div>
          )}
          {res && !res.ok && <p role="alert" className="mt-4 rounded-xl bg-[#FDECEC] p-3 text-sm text-[#7A1A1A]">{res.message}</p>}
        </section>
        <aside className="card h-fit p-6">
          <h2 className="text-2xl font-bold">Kiểm tra dữ liệu</h2>
          <span className={`mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold ${step === 4 ? "bg-[#E7F6EC] text-[#1E7B3C]" : "bg-brand-soft text-brand-dark"}`}><Icon name={step === 4 ? "checkCircle" : "clock"} /> {step === 1 ? "Chờ tải tệp" : step === 4 ? "Đã nhập" : "Chờ xác nhận"}</span>
          <p className="mt-3 text-ink-soft">Vui lòng xác nhận đối chiếu cột để kiểm tra dữ liệu trước khi nhập.</p>
          <ul className="mt-4">
            {[
              [map.query != null, `Cột bắt buộc (Từ khóa)${map.query != null ? "" : " — chưa chọn"}`],
              [dup === 0, dup ? `Dòng trùng lặp: ${dup} (gộp lại khi nhập)` : "Dòng trùng lặp"],
              [badNum === 0, badNum ? `${badNum} dòng có số không hợp lệ (bỏ trống ô đó)` : "Số liệu hợp lệ"],
              [valid.length > 0, `Dòng hợp lệ: ${valid.length}${body.length - valid.length ? ` · bỏ ${body.length - valid.length} dòng trống` : ""}`],
            ].map(([ok, l], i) => (
              <li key={i} className="flex items-center gap-3 border-t border-[#EFECE8] py-3 first:border-0">
                <span className={step === 1 ? "text-ink-muted" : ok ? "text-[#1E7B3C]" : "text-brand"}><Icon name={step === 1 ? "clock" : ok ? "checkCircle" : "alert"} className="h-6 w-6" /></span>{l as string}
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <button className="btn-line" disabled={step === 1 || step === 4} onClick={() => setStep((s) => Math.max(1, s - 1))}><Icon name="arrowLeft" /> Quay lại</button>
        {step === 2 && <button className="btn-primary" disabled={map.query == null || !valid.length} onClick={() => setStep(3)}>Xem kết quả kiểm tra <Icon name="arrowRight" /></button>}
        {step === 3 && <button className="btn-primary" disabled={pending || !valid.length} onClick={submit}>{pending ? "Đang nhập…" : `Nhập ${valid.length - dup} từ khoá`} <Icon name="check" /></button>}
      </div>
    </>
  );
}
