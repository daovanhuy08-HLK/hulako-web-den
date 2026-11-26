// Thành phần dùng chung trang công khai, vẽ theo bộ ảnh thiết kế: breadcrumbs, JSON-LD, thẻ thiết bị/bài/góc live,
// phân trang, trạng thái rỗng, CTA tư vấn, nhãn "minh họa" cho dữ liệu DEMO.
import Image from "next/image";
import Link from "next/link";
import { SITE_URL } from "@/lib/settings";
import { formatDateVN } from "@/lib/text";
import { Icon } from "./site/Icon";

export function JsonLd({ data }: { data: object }) {
  // Escape "<" để không thể đóng thẻ script từ dữ liệu
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** Breadcrumbs kiểu ảnh 080/092: icon nhà › mục (cam) › trang hiện tại */
export function Breadcrumbs({ items, className = "" }: { items: { href?: string; label: string }[]; className?: string }) {
  const all = [{ href: "/", label: "Trang chủ" }, ...items];
  return (
    <>
      <nav aria-label="Đường dẫn" className={`mb-5 ${className}`}>
        <ol className="crumbs">
          {all.map((i, n) => {
            const last = n === all.length - 1;
            return (
              <li key={n} className="flex items-center gap-2">
                {n > 0 && <Icon name="chevron" size={16} className="text-ink-muted" />}
                {n === 0 ? (
                  <Link href="/" className="flex items-center hover:text-brand" aria-label="Trang chủ"><Icon name="home" size={20} /></Link>
                ) : i.href && !last ? (
                  <Link href={i.href} className="text-brand-dark hover:underline">{i.label}</Link>
                ) : (
                  <span aria-current="page" className="text-ink-soft">{i.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: all.map((i, n) => ({ "@type": "ListItem", position: n + 1, name: i.label, ...(i.href ? { item: `${SITE_URL}${i.href}` } : {}) })),
      }} />
    </>
  );
}

export function Cover({ src, alt, priority, ratio = "aspect-[4/3]", sizes = "(max-width: 640px) 100vw, 33vw", className = "" }: { src: string | null | undefined; alt: string; priority?: boolean; ratio?: string; sizes?: string; className?: string }) {
  return (
    <div className={`relative ${ratio} w-full overflow-hidden bg-gradient-to-br from-brand-tint to-[#EFEAE4] ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center font-black tracking-tight text-ink/20" aria-hidden>HULAKO</div>
      )}
    </div>
  );
}

/** Nhãn dữ liệu minh họa (DEMO) — ảnh thiết kế dùng "Sản phẩm minh họa", "Bài mẫu", "Vị trí mẫu"... */
export function SampleTag({ show, children = "Minh họa", className = "" }: { show?: boolean; children?: React.ReactNode; className?: string }) {
  if (!show) return null;
  return <span className={`tag ${className}`}>{children}</span>;
}

/** Ô vuông cam có mũi tên (thẻ thiết bị, ảnh 075) */
export function ArrowBox() {
  return <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition group-hover:bg-brand-dark"><Icon name="arrow" size={20} stroke={2.4} /></span>;
}

export type ProductCardData = { slug: string; name: string; summary: string; categoryName: string | null; useCases: string[]; image: { url: string; alt: string } | null; isSample?: boolean; status?: string };

export function ProductCard({ p }: { p: ProductCardData }) {
  return (
    <Link href={`/thiet-bi/${p.slug}`} className="card group block overflow-hidden transition hover:border-brand hover:shadow-card">
      <div className="relative">
        <Cover src={p.image?.url} alt={p.image?.alt ?? p.name} ratio="aspect-[3/2]" sizes="(max-width: 640px) 50vw, 30vw" />
        {p.isSample && <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-xs font-semibold text-ink-soft">Ảnh minh họa</span>}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h3 className="text-[17px] font-semibold leading-snug sm:text-[19px]">{p.name}</h3>
        <ArrowBox />
      </div>
    </Link>
  );
}

type ArticleLike = { slug: string; kind: string; title: string; summary: string; coverUrl: string | null; coverAlt: string; topicName?: string | null; publishedAt: Date | null; isSample?: boolean };
export const articleHref = (a: { kind: string; slug: string }) => `/${a.kind === "news" ? "tin-tuc" : "kien-thuc"}/${a.slug}`;

/** Thẻ bài ngang nhỏ (ảnh 079 "Bài viết mới") */
export function ArticleRowCard({ a }: { a: ArticleLike }) {
  return (
    <Link href={articleHref(a)} className="card group flex gap-3 p-2.5 transition hover:border-brand hover:shadow-card">
      <div className="relative w-[42%] shrink-0 overflow-hidden rounded-lg">
        <Cover src={a.coverUrl} alt={a.coverAlt || a.title} ratio="aspect-[4/3]" sizes="200px" />
      </div>
      <div className="min-w-0 py-1 pr-1">
        <h3 className="line-clamp-2 text-[16px] font-bold leading-snug group-hover:text-brand-dark">{a.title}</h3>
        <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-snug text-ink-muted">{a.summary}</p>
      </div>
    </Link>
  );
}

/** Thẻ bài dọc (ảnh 091 Tin tức): ảnh, nhãn, tiêu đề, nút "Đọc bài" */
export function ArticleCard({ a, cta = "Đọc bài" }: { a: ArticleLike; cta?: string }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={articleHref(a)} tabIndex={-1} aria-hidden><Cover src={a.coverUrl} alt="" ratio="aspect-[16/10]" /></Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2">
          {a.isSample ? <span className="tag">Bài mẫu</span> : a.topicName ? <span className="tag">{a.topicName}</span> : null}
          {a.publishedAt && <span className="self-center text-[13px] text-ink-muted">{formatDateVN(a.publishedAt)}</span>}
        </div>
        <h3 className="mt-3 text-[20px] font-bold leading-snug"><Link href={articleHref(a)} className="hover:text-brand-dark">{a.title}</Link></h3>
        {a.summary && <p className="mt-2 line-clamp-2 text-[15px] text-ink-muted">{a.summary}</p>}
        <div className="mt-auto pt-4">
          <Link href={articleHref(a)} className="btn-primary btn-sm" aria-label={`${cta}: ${a.title}`}>{cta} <Icon name="arrow" size={18} stroke={2.2} /></Link>
        </div>
      </div>
    </article>
  );
}

type SetupLike = { slug: string; title: string; summary: string; coverUrl: string | null; coverAlt: string; roomConditions: string; isSample?: boolean };

/** Thẻ góc live (ảnh 077): ảnh lớn, tiêu đề, "Ảnh bố trí minh họa", nút cam "Xem cách bố trí" */
export function SetupCard({ s }: { s: SetupLike }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={`/goc-livestream/${s.slug}`} tabIndex={-1} aria-hidden><Cover src={s.coverUrl} alt="" ratio="aspect-[4/3]" /></Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-[21px] font-bold leading-snug sm:text-[24px]"><Link href={`/goc-livestream/${s.slug}`} className="hover:text-brand-dark">{s.title}</Link></h3>
        <p className="mt-2 flex items-center gap-2 text-[15px] text-ink-muted">
          <Icon name="image" size={20} />{s.isSample ? "Ảnh bố trí minh họa" : s.roomConditions || s.summary}
        </p>
        <div className="mt-auto pt-5">
          <Link href={`/goc-livestream/${s.slug}`} className="btn-primary" aria-label={`Xem cách bố trí: ${s.title}`}>Xem cách bố trí <Icon name="arrow" size={20} stroke={2.2} /></Link>
        </div>
      </div>
    </article>
  );
}

export function Pagination({ page, pageSize, total, makeHref }: { page: number; pageSize: number; total: number; makeHref: (p: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="mt-10 flex items-center justify-center gap-2">
      {page > 1 ? <Link className="btn-line btn-sm" href={makeHref(page - 1)} rel="prev">← Trước</Link> : null}
      {Array.from({ length: pages }, (_, i) => i + 1).filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === pages).map((p) => (
        <Link key={p} href={makeHref(p)} aria-current={p === page ? "page" : undefined}
          className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold ${p === page ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}>{p}</Link>
      ))}
      {page < pages ? <Link className="btn-line btn-sm" href={makeHref(page + 1)} rel="next">Sau →</Link> : null}
    </nav>
  );
}

export function EmptyState({ title, icon = "search", children }: { title: string; icon?: Parameters<typeof Icon>[0]["name"]; children?: React.ReactNode }) {
  return (
    <div role="status" className="card px-6 py-12 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-brand"><Icon name={icon} size={32} /></span>
      <p className="mt-4 text-[22px] font-bold">{title}</p>
      {children && <div className="mt-2 text-ink-muted">{children}</div>}
    </div>
  );
}

/** Khối "Nhờ tư vấn" (ảnh 080 cột phải / cuối trang) */
export function ConsultCta({ context, title = "Nhờ tư vấn", text = "Bạn đang setup phòng live và cần gợi ý cách chọn đèn, bố trí phù hợp?", compact }: { context?: string; title?: string; text?: string; compact?: boolean }) {
  const href = `/lien-he?chu-de=tu-van-chon-den${context ? `&${context}` : ""}`;
  return (
    <section className={`card ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <h2 className="flex items-center gap-3 text-[22px] font-bold"><Icon name="chat" size={28} />{title}</h2>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">{text}</p>
      <div className={`mt-5 grid gap-3 ${compact ? "" : "sm:flex"}`}>
        <Link href={href} className="btn-primary w-full sm:w-auto"><Icon name="chat" size={20} />Nhờ tư vấn ngay</Link>
        {!compact && <Link href="/chon-den" className="btn-outline">Tự chọn đèn theo phòng</Link>}
      </div>
    </section>
  );
}

/** Nhóm chip lọc lưu trong URL (chia sẻ, quay lại được) — kiểu pill ảnh 079/091 */
export function FilterChips({ label, param, options, current, base, params, allLabel = "Tất cả", hideLabel }: {
  label: string; param: string; options: { value: string; label: string }[]; current?: string; base: string; params: Record<string, string | undefined>; allLabel?: string; hideLabel?: boolean;
}) {
  const href = (v?: string) => {
    const q = new URLSearchParams(Object.entries({ ...params, [param]: v, page: undefined }).filter(([, x]) => x) as [string, string][]);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav aria-label={label} className="min-w-0">
      {!hideLabel && <p className="mb-2 text-sm font-semibold text-ink-muted">{label}</p>}
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        <li><Link href={href(undefined)} className={`chip shrink-0 ${!current ? "chip-active" : ""}`} aria-current={!current ? "true" : undefined}>{allLabel}</Link></li>
        {options.map((o) => (
          <li key={o.value}><Link href={href(o.value)} className={`chip shrink-0 whitespace-nowrap ${current === o.value ? "chip-active" : ""}`} aria-current={current === o.value ? "true" : undefined}>{o.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

/** Ô tìm kiếm dạng form GET (không cần JS) */
export function SearchBox({ action, placeholder, defaultValue, name = "q", extra, big }: { action: string; placeholder: string; defaultValue?: string; name?: string; extra?: Record<string, string | undefined>; big?: boolean }) {
  return (
    <form role="search" action={action} className="relative w-full">
      <label className="sr-only" htmlFor={`sb-${action}`}>{placeholder}</label>
      <Icon name="search" size={24} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
      <input id={`sb-${action}`} name={name} defaultValue={defaultValue} placeholder={placeholder} type="search"
        className={`input !rounded-xl pl-14 ${big ? "!min-h-[60px] text-lg" : "!min-h-[54px]"}`} />
      {extra && Object.entries(extra).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </form>
  );
}
