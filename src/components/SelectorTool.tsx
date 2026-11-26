"use client";
// P13 Chọn đèn theo phòng — 3 màn: câu hỏi (ảnh 021, 086) → gợi ý setup (026, 087) → cần tư vấn thêm (062, 088).
// Xem kết quả không cần để lại liên hệ; sửa câu trả lời & chạy lại không tạo yêu cầu tư vấn.
// Khi khách chủ động gửi, yêu cầu tư vấn lưu kèm câu trả lời + phiên bản quy tắc để đội tư vấn tra lại.
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AREA_OPTIONS, INDUSTRY_OPTIONS, OWNED_OPTIONS, STYLE_OPTIONS } from "@/lib/selector-options";
import { track } from "./track";
import { Icon, type IconName } from "./site/Icon";
import { LeadForm } from "./LeadForm";

type Result = {
  ruleVersion: number | null; ruleId: string | null; needsConsultation: boolean; advice: string; articleSlug: string | null;
  setup: { slug: string; title: string; summary: string; coverUrl: string | null; coverAlt: string; lightPosition: string; isSample?: boolean } | null;
  products: { variantId: string; sku: string; name: string; slug: string; image: { url: string; alt: string } | null }[];
};
type Opt = readonly { value: string; label: string }[];
const lbl = (opts: Opt, v: string) => opts.find((o) => o.value === v)?.label ?? v;

// Khai báo NGOÀI SelectorTool để React không dựng lại nút mỗi lần chọn (giữ focus bàn phím)
function Pills({ name, opts, value, set, cols }: { name: string; opts: Opt; value: string; set: (v: string) => void; cols?: string }) {
  return (
    <div className={`flex flex-wrap gap-2.5 sm:gap-4 ${cols ?? ""}`}>
      {opts.map((o) => {
        const on = value === o.value;
        return (
          <label key={o.value} className={`inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-[16px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand sm:min-w-[160px] sm:text-[19px] ${on ? "border-brand bg-brand font-semibold text-white sm:bg-brand-soft sm:text-brand-dark" : "border-line bg-white hover:border-brand"}`}>
            <input type="radio" name={name} value={o.value} checked={on} onChange={() => set(o.value)} className="sr-only" />
            {on && <Icon name="check" size={18} stroke={3} className="sm:hidden" />}{o.label}
          </label>
        );
      })}
    </div>
  );
}

function Q({ n, icon, title, hint, children }: { n: number; icon: IconName; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex gap-4 border-b border-line py-5 last:border-0 sm:gap-6 sm:py-6">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white sm:hidden">{n}</span>
      <Icon name={icon} size={46} stroke={1.6} className="hidden shrink-0 sm:block" />
      <div className="min-w-0 flex-1">
        <legend className="text-[19px] font-bold sm:text-[24px]">{title}</legend>
        {hint && <p className="mt-0.5 text-[14px] text-ink-muted">{hint}</p>}
        <div className="mt-3">{children}</div>
      </div>
    </fieldset>
  );
}

function Summary({ items }: { items: { icon: IconName; label: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-2.5 sm:gap-6">
      {items.map((i) => (
        <li key={i.label} className="inline-flex min-h-[44px] items-center gap-2.5 rounded-xl border border-brand/40 bg-brand-tint px-4 text-[15px] font-semibold sm:min-h-[58px] sm:px-5 sm:text-[21px]">
          <Icon name={i.icon} size={24} className="text-brand" />{i.label}<Icon name="check" size={22} className="hidden text-brand sm:block" />
        </li>
      ))}
    </ul>
  );
}

export function SelectorTool({ consentText }: { consentText: string }) {
  const [area, setArea] = useState(""); const [industry, setIndustry] = useState("quan-ao"); const [style, setStyle] = useState("ngoi");
  const [owned, setOwned] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<"form" | "result" | "consult">("form");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  async function run() {
    if (!area) { setError("Vui lòng chọn diện tích ước tính (hoặc Chưa biết)."); document.getElementById("s-area")?.focus(); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area, industry, style, owned }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResult(data);
      setView(data.needsConsultation ? "consult" : "result");
      track({ type: "selector_complete", pageType: "selector", entityId: data.ruleId ?? undefined, ctaType: data.needsConsultation ? "consult" : "result" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message || "Có lỗi, vui lòng thử lại.");
    } finally { setLoading(false); }
  }

  const summaryItems: { icon: IconName; label: string }[] = [
    { icon: area === "chua-biet" ? "frame" : "home", label: area === "chua-biet" ? "Diện tích chưa rõ" : area === "duoi-10" ? "Phòng nhỏ" : lbl(AREA_OPTIONS, area) },
    { icon: industry === "khac" ? "bag" : "shirt", label: industry === "khac" ? "Mặt hàng khác" : lbl(INDUSTRY_OPTIONS, industry) },
    { icon: "person", label: lbl(STYLE_OPTIONS, style) },
  ];
  const context: Record<string, string> = {
    "Diện tích": lbl(AREA_OPTIONS, area), "Mặt hàng": lbl(INDUSTRY_OPTIONS, industry), "Kiểu quay": lbl(STYLE_OPTIONS, style),
    ...(owned.length ? { "Đang có": owned.map((o) => lbl(OWNED_OPTIONS, o)).join(", ") } : {}),
    ...(result?.ruleVersion ? { "Phiên bản quy tắc": `v${result.ruleVersion}` } : {}),
    ...(result?.setup ? { "Góc live gợi ý": result.setup.title } : {}),
    ...(result?.products.length ? { "Thiết bị gợi ý": result.products.map((p) => p.sku).join(", ") } : {}),
  };
  const edit = () => { setView("form"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ── Màn 3: cần tư vấn thêm (hoặc khách bấm gửi thông tin) ──
  if (view === "consult" && result) {
    const fallback = result.needsConsultation;
    return (
      <div>
        <h1 className="h-page">{fallback ? "Cần thêm thông tin về góc live" : "Gửi thông tin cho tư vấn viên"}</h1>
        {fallback && <p className="mt-2 text-[15px] text-ink-muted sm:hidden">Góc live của bạn cần được tư vấn thêm để chọn thiết bị phù hợp.</p>}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
          <section className="lg:card lg:p-8">
            <h2 className="text-[20px] font-bold sm:text-[30px]">Thông tin bạn đã chọn</h2>
            <div className="card mt-4 p-2 lg:border-0 lg:p-0"><Summary items={summaryItems} /></div>
            <hr className="my-6 hidden border-line lg:block" />
            <p className="hidden text-[21px] lg:block">{fallback ? "Góc live của bạn cần được tư vấn thêm để chọn thiết bị phù hợp" : "Tư vấn viên sẽ xem lại gợi ý và góc phòng thực tế của bạn"}</p>
            {area === "chua-biet" && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-[15px] text-ink-soft">Mẹo đo: đo chiều ngang × chiều sâu khu vực từ chỗ bạn đứng/ngồi tới vị trí đặt điện thoại.</p>}
            <div className="relative mt-6 hidden aspect-[882/408] overflow-hidden rounded-xl lg:block"><Image src="/demo/chon-den-tu-van.jpg" alt="" fill sizes="60vw" className="object-cover" /></div>
          </section>
          <section className="card p-5 sm:p-8">
            <h2 className="mb-4 text-[22px] font-bold sm:text-[30px]">Gửi yêu cầu tư vấn</h2>
            <LeadForm variant="compact" source="selector" context={context} consentText={consentText} onEdit={edit} successImage="/demo/chon-den-ket-qua.jpg" />
          </section>
        </div>
      </div>
    );
  }

  // ── Màn 2: gợi ý setup ──
  if (view === "result" && result) {
    const p = result.products[0];
    return (
      <div aria-live="polite">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <h1 className="text-[28px] font-extrabold tracking-tight sm:text-[52px]">Gợi ý setup cho bạn</h1>
          {result.setup?.isSample && <span className="tag !rounded-full !px-4 !py-1.5 sm:!text-[19px]">Kết quả minh họa</span>}
        </div>
        <div className="mt-4"><Summary items={summaryItems} /></div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:gap-8">
          <div className="relative aspect-[970/600] overflow-hidden rounded-[16px] bg-[#EFECE8]">
            {result.setup?.coverUrl && <Image src={result.setup.coverUrl} alt={result.setup.coverAlt} fill priority sizes="(max-width:1024px) 100vw, 60vw" className="object-cover" />}
          </div>
          <div className="space-y-4 lg:space-y-6">
            <div className="flex gap-5 rounded-card border-line bg-transparent lg:card lg:p-7">
              <Icon name="softbox" size={52} stroke={1.5} className="hidden shrink-0 text-brand lg:block" />
              <Icon name="video" size={24} className="shrink-0 text-brand lg:hidden" />
              <div>
                <h2 className="text-[18px] font-bold lg:text-[28px]">Bố trí tham khảo</h2>
                <p className="mt-1 text-[14px] text-ink-muted lg:text-[19px]">{result.advice || result.setup?.lightPosition || "Thử vị trí đèn và kiểm tra lại trên camera."}</p>
                {result.setup && <Link href={`/goc-livestream/${result.setup.slug}`} className="mt-2 inline-flex items-center gap-1 text-[15px] font-semibold text-brand-dark underline">Xem cách bố trí: {result.setup.title}</Link>}
              </div>
            </div>
            {result.products.length > 0 && (
              <div className="card p-4 lg:p-6">
                <h2 className="flex items-center gap-2 text-[18px] font-bold lg:text-[28px]"><Icon name="layers" size={22} className="text-brand lg:hidden" />Thiết bị tham khảo</h2>
                <ul className="mt-4 space-y-3">
                  {result.products.map((x) => (
                    <li key={x.variantId} className="flex items-center gap-4">
                      <div className="relative h-[110px] w-[42%] max-w-[178px] shrink-0 overflow-hidden rounded-lg bg-[#EFECE8]">{x.image && <Image src={x.image.url} alt={x.image.alt} fill sizes="180px" className="object-cover" />}</div>
                      <div><p className="text-[17px] font-semibold lg:text-[22px]">{x.name}</p>
                        <Link href={`/thiet-bi/${x.slug}`} className="btn-outline btn-sm mt-2 lg:!min-h-[50px] lg:!px-8 lg:!text-[19px]">Xem thiết bị <Icon name="chevron" size={18} className="lg:hidden" /></Link></div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-muted"><Icon name="alert" size={16} />Thiết bị mẫu, cần đối chiếu cấu hình thực tế.</p>
              </div>
            )}
            <button type="button" onClick={() => { setView("consult"); track({ type: "consult_click", pageType: "selector", entityId: p?.variantId, ctaType: "selector_result" }); }} className="btn-primary w-full !min-h-[56px] !text-[18px] lg:!min-h-[70px] lg:!text-[24px]">Gửi thông tin cho tư vấn viên <Icon name="chevron" size={20} className="lg:hidden" /></button>
            <button type="button" onClick={edit} className="btn-outline w-full !min-h-[52px] !text-[17px] lg:!min-h-[66px] lg:!text-[24px]"><span className="text-ink lg:text-brand-dark">Sửa câu trả lời</span></button>
            {result.articleSlug && <Link href={`/kien-thuc/${result.articleSlug}`} className="block text-center font-semibold text-brand-dark underline">Đọc hướng dẫn đặt đèn</Link>}
            <p className="text-[12px] text-ink-muted">Quy tắc v{result.ruleVersion}. Kết quả ánh sáng thực tế phụ thuộc diện tích phòng, khoảng cách đặt đèn và thiết bị quay của bạn.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Màn 1: câu hỏi ──
  return (
    <div>
      <div className="relative -mx-4 mb-4 aspect-[941/300] overflow-hidden sm:mx-0 sm:rounded-card lg:hidden"><Image src="/demo/chon-den.jpg" alt="" fill priority sizes="100vw" className="object-cover" /></div>
      <h1 className="h-page">Chọn đèn theo phòng</h1>
      <p className="mt-1 text-[16px] text-ink-muted lg:hidden">Cho HULAKO biết góc live của bạn</p>
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mt-4 grid gap-6 lg:mt-8 lg:grid-cols-[800px_1fr] lg:gap-8">
        <div className="lg:card lg:px-8 lg:py-2">
          <Q n={1} icon="home" title="Không gian live" hint="Tính theo khu vực bạn thực sự dùng để live, không phải cả phòng.">
            <div className="relative">
              <label htmlFor="s-area" className="sr-only">Diện tích ước tính</label>
              <select id="s-area" value={area === "chua-biet" ? "" : area} onChange={(e) => setArea(e.target.value)} aria-invalid={!!error || undefined}
                className={`input appearance-none !min-h-[52px] pr-10 sm:text-[19px] ${error ? "input-error" : ""}`}>
                <option value="">Chọn diện tích ước tính</option>
                {AREA_OPTIONS.filter((o) => o.value !== "chua-biet").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Icon name="chevronDown" size={22} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            <button type="button" aria-pressed={area === "chua-biet"} onClick={() => setArea(area === "chua-biet" ? "" : "chua-biet")}
              className={`mt-2.5 rounded-lg border px-4 py-1.5 text-[15px] ${area === "chua-biet" ? "border-brand bg-brand-soft font-semibold text-brand-dark" : "border-line bg-white"}`}>Chưa biết</button>
            {error && <p className="field-error" role="alert"><Icon name="alert" size={16} />{error}</p>}
          </Q>
          <Q n={2} icon="tag" title="Bạn bán mặt hàng gì?"><Pills name="industry" opts={INDUSTRY_OPTIONS} value={industry} set={setIndustry} /></Q>
          <Q n={3} icon="video" title="Kiểu quay"><Pills name="style" opts={STYLE_OPTIONS.filter((o) => o.value !== "chua-xac-dinh")} value={style} set={setStyle} /></Q>
          <Q n={4} icon="layers" title="Thiết bị đang có">
            <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:gap-x-9">
              {OWNED_OPTIONS.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-3 text-[16px] sm:text-[19px]">
                  <input type="checkbox" className="h-6 w-6 accent-[#FA6803]" checked={owned.includes(o.value)}
                    onChange={(e) => setOwned((p) => o.value === "chua-co" ? (e.target.checked ? ["chua-co"] : []) : e.target.checked ? [...p.filter((x) => x !== "chua-co"), o.value] : p.filter((x) => x !== o.value))} />
                  {o.label}
                </label>
              ))}
            </div>
          </Q>
        </div>
        <div className="flex flex-col">
          <div className="relative hidden aspect-[784/474] overflow-hidden rounded-[16px] lg:block"><Image src="/demo/chon-den.jpg" alt="Góc live bán quần áo có softbox và giá điện thoại (ảnh minh họa)" fill priority sizes="45vw" className="object-cover" /></div>
          <p className="mt-6 hidden text-[28px] font-bold leading-tight lg:block">Gợi ý theo không gian và cách bạn livestream</p>
          <div className="mt-2 grid grid-cols-[1.1fr_1fr] gap-3 lg:mt-6 lg:gap-5">
            <button className="btn-primary !min-h-[54px] !text-[17px] lg:!min-h-[74px] lg:!text-[26px]" disabled={loading}>{loading ? "Đang tìm…" : <>Xem gợi ý setup <Icon name="chevron" size={20} className="lg:hidden" /></>}</button>
            <Link href={`/lien-he?chu-de=tu-van-chon-den&chon-den=${encodeURIComponent(Object.entries(context).map(([k, v]) => `${k}: ${v}`).join(" · "))}`}
              onClick={() => track({ type: "consult_click", pageType: "selector", ctaType: "selector_direct" })}
              className="btn-line !min-h-[54px] !text-[15px] lg:btn-outline lg:!min-h-[74px] lg:!text-[26px]">Nhờ tư vấn trực tiếp</Link>
          </div>
          <p className="mt-3 text-[13px] text-ink-muted">Xem gợi ý không cần để lại số điện thoại.</p>
        </div>
      </form>
    </div>
  );
}
