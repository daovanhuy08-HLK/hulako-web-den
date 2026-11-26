// Tìm kiếm /tim-kiem?q=… (ảnh 025, 089; rỗng 042, 090) — có dấu/không dấu, chỉ nội dung công khai, trang dùng noindex.
import type { Metadata } from "next";
import Link from "next/link";
import { search, type SearchItem, type SearchType } from "@/lib/search";
import { Cover, Pagination } from "@/components/ui";
import { Icon, type IconName } from "@/components/site/Icon";

export const metadata: Metadata = { title: "Tìm kiếm", robots: { index: false, follow: true }, alternates: { canonical: "/tim-kiem" } };
type SP = Promise<Record<string, string | undefined>>;

const TYPES: { value?: SearchType; label: string }[] = [
  { label: "Tất cả" }, { value: "product", label: "Thiết bị" }, { value: "article", label: "Kiến thức" }, { value: "setup", label: "Góc live" },
];
const TYPE_META: Record<SearchType, { label: string; icon: IconName }> = {
  article: { label: "Kiến thức", icon: "file" }, product: { label: "Thiết bị", icon: "layers" }, setup: { label: "Góc live", icon: "playCircle" },
};
const SUGGEST: { label: string; href: string; icon: IconName }[] = [
  { label: "Setup phòng nhỏ", href: "/goc-livestream?space=phong-nho", icon: "home" },
  { label: "Chọn softbox", href: "/tim-kiem?q=softbox", icon: "softbox" },
  { label: "Cách đặt đèn", href: "/tim-kiem?q=đặt đèn", icon: "bulb" },
];

function SearchInput({ q, type }: { q: string; type?: string }) {
  return (
    <form role="search" action="/tim-kiem" className="relative">
      <label htmlFor="q" className="sr-only">Từ khoá tìm kiếm</label>
      <Icon name="search" size={26} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-soft" />
      <input id="q" name="q" type="search" defaultValue={q} autoFocus={!q} placeholder="Tìm thiết bị, cách setup…"
        className="input !min-h-[60px] !rounded-xl pl-16 pr-14 text-[18px] sm:text-[21px] [&::-webkit-search-cancel-button]:hidden" />
      {type && <input type="hidden" name="type" value={type} />}
      {q && <Link href="/tim-kiem" aria-label="Xóa từ khóa" className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-black/5"><Icon name="x" size={24} /></Link>}
    </form>
  );
}

function TypeTag({ t }: { t: SearchType }) {
  return <span className="tag gap-1.5"><Icon name={TYPE_META[t].icon} size={16} />{TYPE_META[t].label}</span>;
}

function BigResult({ i }: { i: SearchItem }) {
  return (
    <article className="card relative flex flex-col p-3">
      <div className="overflow-hidden rounded-xl"><Cover src={i.image} alt={i.imageAlt || i.title} ratio="aspect-[726/318]" sizes="(max-width:1024px) 100vw, 740px" /></div>
      <div className="px-3 pb-3 pt-4">
        <TypeTag t={i.type} />
        <h2 className="mt-3 text-[26px] font-extrabold leading-tight sm:text-[32px]"><Link href={i.url} className="after:absolute after:inset-0">{i.title}</Link></h2>
        <p className="mt-2 line-clamp-2 text-[17px] text-ink-soft">{i.summary}</p>
        <span className="btn-primary btn-sm mt-4">Xem chi tiết <Icon name="arrow" size={18} /></span>
      </div>
    </article>
  );
}

function RowResult({ i }: { i: SearchItem }) {
  return (
    <article className="card relative flex gap-4 p-2.5 sm:p-3">
      <div className="w-[48%] shrink-0 overflow-hidden rounded-xl sm:w-[45%]"><Cover src={i.image} alt={i.imageAlt || i.title} ratio="aspect-[366/240]" sizes="(max-width:640px) 48vw, 370px" /></div>
      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <div><TypeTag t={i.type} /></div>
        <h2 className="mt-2 text-[19px] font-extrabold leading-snug sm:text-[24px]"><Link href={i.url} className="after:absolute after:inset-0">{i.title}</Link></h2>
        <p className="mt-1.5 line-clamp-3 hidden text-[15px] text-ink-soft sm:block">{i.summary}</p>
        <span className="btn-primary btn-sm mt-auto hidden w-fit sm:inline-flex">Xem chi tiết <Icon name="arrow" size={18} /></span>
      </div>
      <span aria-hidden className="flex items-center pr-1 text-brand sm:hidden"><Icon name="arrow" size={26} className="rounded-full border-2 border-brand p-0.5" /></span>
    </article>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 120);
  const type = TYPES.find((t) => t.value === sp.type)?.value;
  const page = Math.max(1, Number(sp.page) || 1);
  const data = q ? await search(q, type, page, 9) : null;
  const empty = !data || data.total === 0;
  const tabHref = (v?: SearchType) => `/tim-kiem?${new URLSearchParams({ ...(q ? { q } : {}), ...(v ? { type: v } : {}) })}`;

  if (empty) {
    return (
      <div className="relative overflow-hidden">
        <div className="container-page max-w-[920px] py-8 text-center lg:py-14">
          <h1 className="text-left text-[34px] font-extrabold tracking-tight sm:text-center sm:text-[64px]">Tìm kiếm</h1>
          <div className="mt-5 text-left sm:mt-8"><SearchInput q={q} type={type} /></div>
          <nav aria-label="Loại nội dung" className="mt-4 flex border-b border-line">
            {TYPES.map((t) => (
              <Link key={t.label} href={tabHref(t.value)} aria-current={t.value === type ? "true" : undefined}
                className={`relative flex-1 py-3 text-[16px] sm:text-[19px] ${t.value === type ? "font-semibold text-brand" : "text-ink-soft hover:text-ink"}`}>
                {t.label}{t.value === type && <span aria-hidden className="absolute inset-x-[15%] -bottom-px h-[3px] rounded-full bg-brand" />}
              </Link>
            ))}
          </nav>
          <div role="status" aria-live="polite" className="mt-10">
            <span className="relative mx-auto block w-fit text-ink"><Icon name="search" size={88} stroke={1.6} /><Icon name="spark" size={36} className="absolute -right-6 -top-4 text-brand" stroke={2.4} /></span>
            <p className="mt-4 text-[26px] font-extrabold sm:text-[34px]">{q ? "Chưa tìm thấy kết quả" : "Bạn đang tìm gì?"}</p>
            <p className="mt-2 text-[16px] text-ink-soft sm:text-[19px]">{q ? "Thử từ khóa ngắn hơn hoặc chọn một chủ đề bên dưới." : "Gõ có dấu hay không dấu đều được, hoặc chọn một chủ đề bên dưới."}</p>
          </div>
          <ul className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-6">
            {SUGGEST.map((s) => (
              <li key={s.label}><Link href={s.href} className="card flex min-h-[60px] items-center gap-4 px-5 text-left text-[17px] font-semibold hover:border-brand sm:justify-center sm:text-[19px]">
                <Icon name={s.icon} size={30} className="shrink-0 text-brand sm:text-ink" /><span className="flex-1 sm:flex-none">{s.label}</span><Icon name="chevron" size={20} className="sm:hidden" />
              </Link></li>
            ))}
          </ul>
          <div className="mt-8 grid gap-3 sm:flex sm:justify-center sm:gap-6">
            <Link href="/lien-he?chu-de=tu-van-chon-den" className="btn-primary !min-h-[56px] sm:!min-w-[244px] sm:!text-[19px]">Nhờ tư vấn <Icon name="chevron" size={20} className="sm:hidden" /></Link>
            {q && <Link href="/tim-kiem" className="btn-line !min-h-[56px] sm:!min-w-[234px] sm:!text-[19px]">Xóa từ khóa</Link>}
          </div>
        </div>
      </div>
    );
  }

  const [first, ...rest] = data.items;
  const showBig = page === 1 && rest.length > 0;
  return (
    <div className="container-page py-7 lg:py-10">
      <h1 className="h-page">Kết quả tìm kiếm</h1>
      <div className="mt-5 lg:mt-7"><SearchInput q={q} type={type} /></div>
      <nav aria-label="Loại nội dung" className="mt-5 flex gap-2.5 overflow-x-auto pb-1 sm:gap-5">
        {TYPES.map((t) => (
          <Link key={t.label} href={tabHref(t.value)} aria-current={t.value === type ? "true" : undefined}
            className={`inline-flex min-h-[46px] shrink-0 items-center rounded-lg border px-5 text-[16px] sm:px-8 sm:text-[19px] ${t.value === type ? "border-brand bg-brand font-semibold text-white" : "border-line bg-white hover:border-brand"}`}>{t.label}</Link>
        ))}
      </nav>
      <p className="sr-only" aria-live="polite">{data.total} kết quả cho {q}</p>
      <div className={`mt-6 grid gap-4 lg:mt-7 ${showBig ? "lg:grid-cols-[1fr_1.07fr] lg:gap-5" : ""}`}>
        {showBig && <div className="hidden lg:block"><BigResult i={first} /></div>}
        <div className={`grid gap-4 ${showBig ? "" : "lg:grid-cols-2"}`}>
          {showBig && <div className="lg:hidden"><RowResult i={first} /></div>}
          {(showBig ? rest : data.items).map((i) => <RowResult key={i.url} i={i} />)}
        </div>
      </div>
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total}
        makeHref={(p) => `/tim-kiem?${new URLSearchParams({ q, ...(type ? { type } : {}), page: String(p) })}`} />
    </div>
  );
}
