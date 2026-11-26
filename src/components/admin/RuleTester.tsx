"use client";
// Màn 058: chạy thử quy tắc chọn đèn với một bộ đầu vào, hiện quy tắc áp dụng / phiên bản / mẫu góc live / thiết bị gợi ý.
import { useState, useTransition } from "react";
import type { RuleTestResult } from "@/app/admin/actions/extra";
import { Icon } from "./icons";

type Opt = readonly { value: string; label: string }[];

export function RuleTester({ action, version, areas, industries, styles, owned }: {
  action: (fd: FormData) => Promise<RuleTestResult>; version: number | null; areas: Opt; industries: Opt; styles: Opt; owned: Opt;
}) {
  const [res, setRes] = useState<RuleTestResult | null>(null);
  const [pending, start] = useTransition();
  const Sel = ({ name, label, opts }: { name: string; label: string; opts: Opt }) => (
    <div><label htmlFor={`rt-${name}`} className="mb-1.5 block font-semibold">{label}</label>
      <select id={`rt-${name}`} name={name} className="input">{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
  );
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="grid grid-cols-[180px_1fr] gap-3 border-t border-[#EFECE8] py-3 first:border-0"><dt className="font-semibold">{k}</dt><dd className="text-ink-soft">{v ?? "—"}</dd></div>;
  return (
    <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
      <form className="card space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => setRes(await action(fd))); }}>
        <input type="hidden" name="version" value={version ?? ""} />
        <Sel name="area" label="Không gian" opts={areas} />
        <Sel name="industry" label="Ngành hàng" opts={industries} />
        <Sel name="style" label="Kiểu quay" opts={styles} />
        <fieldset><legend className="mb-1.5 font-semibold">Thiết bị đang có</legend>
          <div className="space-y-2">{owned.map((o) => <label key={o.value} className="flex items-center gap-3"><input type="checkbox" name="owned" value={o.value} /> {o.label}</label>)}</div></fieldset>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Đang chạy…" : "Chạy thử"}</button>
      </form>
      <section className="card p-6">
        <div className="mb-4 flex items-center gap-3"><h2 className="text-2xl font-bold">Kết quả kiểm tra</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${!res ? "bg-[#EFEDEA] text-ink-soft" : !res.ok ? "bg-[#FDECEC] text-[#B42318]" : res.needsConsultation ? "bg-brand-soft text-brand-dark" : "bg-[#E7F6EC] text-[#1E7B3C]"}`}>
            {!res ? "Chưa chạy" : !res.ok ? "Lỗi" : res.needsConsultation ? "Chuyển tư vấn" : "Có gợi ý"}</span></div>
        {res && !res.ok && <p role="alert" className="mb-3 rounded-xl bg-[#FDECEC] p-3 text-sm text-[#7A1A1A]">{res.message}</p>}
        <dl className="rounded-card border border-line px-5 py-2">
          <Row k="Quy tắc áp dụng" v={res?.ruleName ? `${res.ruleName} (ưu tiên ${res.priority})` : res ? res.reason : "—"} />
          <Row k="Phiên bản" v={res?.version != null ? `v${res.version}` : "—"} />
          <Row k="Mẫu góc livestream" v={res?.setup ?? "—"} />
          <Row k="Thiết bị gợi ý" v={res?.products?.length ? res.products.join(", ") : "—"} />
          {res?.advice ? <Row k="Lời khuyên" v={res.advice} /> : null}
        </dl>
        {!res && (
          <div className="mt-8 flex flex-col items-center text-center text-ink-muted">
            <span className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-soft text-brand"><Icon name="play" className="h-10 w-10" /></span>
            <p className="mt-3">Chạy thử để kiểm tra kết quả với bộ điều kiện này.</p>
          </div>
        )}
      </section>
    </div>
  );
}
