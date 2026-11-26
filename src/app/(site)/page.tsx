// P01 Trang chủ (ảnh 001 điện thoại, 074 máy tính): ảnh góc live + 2 CTA → lối vào theo nhu cầu → góc live thực tế
// → bài xử lý lỗi/hướng dẫn → thiết bị tiêu biểu → hỏi đáp nhanh → tư vấn. Khối thiếu dữ liệu thì ẩn.
import Image from "next/image";
import Link from "next/link";
import { getSetting, SITE_URL } from "@/lib/settings";
import { listFaqs, listProducts, listPublishedArticles, listSetups } from "@/lib/queries";
import { safe } from "@/lib/safe";
import { ArticleRowCard, ConsultCta, JsonLd, ProductCard, SetupCard } from "@/components/ui";
import { TrackedLink } from "@/components/Tracking";
import { Icon, type IconName } from "@/components/site/Icon";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const revalidate = 300;

async function selectorReady() {
  const db = await getDb();
  const [s] = await db.select().from(schema.ruleSets).where(eq(schema.ruleSets.status, "active"));
  return !!s;
}

const NEED_ICONS: IconName[] = ["home", "shirt", "play"];

export default async function HomePage() {
  const [home, company, channels, setups, products, guides, faqs, hasSelector] = await Promise.all([
    getSetting("home"),
    getSetting("company"),
    getSetting("channels"),
    safe(listSetups({ pageSize: 3 }).then((r) => r.items), []),
    safe(listProducts({ featured: true, pageSize: 6 }).then((r) => r.items), []),
    safe(listPublishedArticles({ kind: "guide", pageSize: 4 }).then((r) => r.items), []),
    safe(listFaqs().then((r) => r.slice(0, 4)), []),
    safe(selectorReady(), false),
  ]);
  const consult = { type: "consult_click" as const, pageType: "home", ctaType: "hero" };

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Organization", name: "HULAKO — Vua Đèn Lives", legalName: company.legalName,
        url: SITE_URL, email: company.email, taxID: company.taxCode, slogan: company.slogan, telephone: company.phone || undefined,
        sameAs: Object.values(channels).filter((u) => typeof u === "string" && u.startsWith("https://")), logo: `${SITE_URL}/icon.svg`,
        address: { "@type": "PostalAddress", streetAddress: company.address, addressCountry: "VN" },
      }} />

      {/* ── Hero điện thoại (ảnh 001): ảnh tràn ngang, tiêu đề đè lên phần mờ dưới ảnh ── */}
      <section className="lg:hidden">
        <div className="relative">
          <div className="relative aspect-[941/760] w-full">
            <Image src={home.heroImage} alt={home.heroAlt} fill priority sizes="100vw" className="object-cover object-[60%_30%]" />
          </div>
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-paper via-paper/80 to-transparent" />
          <h1 className="absolute inset-x-4 bottom-1 text-[40px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{home.heroTitle}</h1>
        </div>
        <div className="container-page mt-5 grid grid-cols-2 gap-3">
          <Link href="/goc-livestream" className="btn-primary whitespace-nowrap !min-h-[54px] !gap-1 !px-2 !text-[15px] min-[400px]:!text-[17px]">Xem cách setup <Icon name="chevron" size={20} stroke={2.4} /></Link>
          <TrackedLink href="/lien-he?chu-de=tu-van-chon-den" className="btn-outline whitespace-nowrap !min-h-[54px] !px-2 !text-[14px] !text-ink min-[400px]:!text-[16px]" event={consult}>Nhờ tư vấn chọn đèn</TrackedLink>
        </div>
      </section>

      {/* ── Hero máy tính (ảnh 074) ── */}
      <section className="container-page hidden pt-8 lg:block">
        <div className="grid grid-cols-[0.86fr_1.14fr] items-center gap-8">
          <div>
            <h1 className="text-[56px] font-extrabold leading-[1.08] tracking-tight xl:text-[66px]">{home.heroTitle}</h1>
            <span className="accent-bar mt-7 !w-20" />
            <p className="mt-7 max-w-xl text-[20px] leading-relaxed text-ink-soft">{home.heroSubtitle}</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/goc-livestream" className="btn-primary !min-h-[64px] !px-7 !text-[19px]"><Icon name="playCircle" size={28} />Xem cách setup</Link>
              <TrackedLink href="/lien-he?chu-de=tu-van-chon-den" className="btn-outline !min-h-[64px] !px-6 !text-[19px]" event={consult}><Icon name="chat" size={26} />Nhờ tư vấn chọn đèn</TrackedLink>
            </div>
          </div>
          <div className="relative aspect-[950/533] overflow-hidden rounded-[18px]">
            <Image src={home.heroImage} alt={home.heroAlt} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* ── Lối vào theo nhu cầu ── */}
      <section className="container-page pt-9 lg:pt-8" aria-labelledby="nhu-cau">
        <h2 id="nhu-cau" className="text-[26px] font-bold tracking-tight lg:sr-only">Tôi cần giải pháp cho</h2>
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-4 lg:mt-0 lg:gap-6">
          {home.needs.map((n, i) => (
            <Link key={n.href} href={n.href} className="group relative block overflow-hidden rounded-card border border-line bg-white transition hover:border-brand hover:shadow-card">
              <div className="relative aspect-[282/180] lg:aspect-[520/238]">
                <Image src={n.image} alt={n.alt} fill sizes="(min-width:1024px) 33vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
              </div>
              {/* điện thoại: nhãn dưới ảnh; máy tính: nhãn trắng nổi trên ảnh */}
              <span className="flex items-center justify-between px-3 py-3 text-[15px] font-semibold sm:text-[18px] lg:absolute lg:bottom-4 lg:left-4 lg:gap-3 lg:rounded-xl lg:bg-white/95 lg:px-4 lg:py-2.5 lg:text-[22px] lg:shadow-sm">
                <Icon name={NEED_ICONS[i] ?? "home"} size={30} className="hidden lg:block" />
                {n.label}
                <Icon name="chevron" size={20} stroke={2.2} className="text-brand lg:hidden" />
              </span>
            </Link>
          ))}
        </div>
        {hasSelector && (
          <Link href="/chon-den" className="card mt-4 flex items-center justify-between gap-3 border-brand bg-brand-tint p-4 font-semibold hover:shadow-card sm:p-5">
            <span className="flex items-center gap-3"><Icon name="bulb" size={26} className="text-brand" />Chọn đèn theo phòng của bạn</span>
            <Icon name="arrow" size={22} className="text-brand" />
          </Link>
        )}
      </section>

      {/* ── Góc livestream thực tế ── */}
      {setups.length > 0 && (
        <section className="container-page pt-12" aria-labelledby="goc-live">
          <Link href="/goc-livestream" className="card group flex items-center gap-4 p-3 transition hover:border-brand sm:hidden">
            <div className="relative aspect-[432/162] w-1/2 shrink-0 overflow-hidden rounded-xl">
              <Image src={setups[0].coverUrl ?? home.heroImage} alt="" fill sizes="50vw" className="object-cover" />
            </div>
            <span id="goc-live" className="flex-1 text-[22px] font-bold leading-tight">Góc livestream thực tế</span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-brand text-brand"><Icon name="arrow" size={22} /></span>
          </Link>
          <div className="hidden items-end justify-between gap-4 sm:flex">
            <h2 className="h-section">Góc livestream thực tế</h2>
            <Link href="/goc-livestream" className="inline-flex items-center gap-1 font-semibold text-brand-dark hover:underline">Xem tất cả <Icon name="arrow" size={18} /></Link>
          </div>
          <div className="mt-6 hidden gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3">{setups.map((s) => <SetupCard key={s.id} s={s} />)}</div>
        </section>
      )}

      {/* ── Bài hướng dẫn / xử lý lỗi thường gặp ── */}
      {guides.length > 0 && (
        <section className="container-page pt-14" aria-labelledby="huong-dan">
          <div className="flex items-end justify-between gap-4">
            <h2 id="huong-dan" className="h-section">Hướng dẫn & lỗi thường gặp</h2>
            <Link href="/kien-thuc" className="hidden items-center gap-1 font-semibold text-brand-dark hover:underline sm:inline-flex">Trung tâm kiến thức <Icon name="arrow" size={18} /></Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{guides.map((a) => <ArticleRowCard key={a.id} a={a} />)}</div>
          <Link href="/kien-thuc" className="mt-4 inline-flex items-center gap-1 font-semibold text-brand-dark sm:hidden">Trung tâm kiến thức <Icon name="arrow" size={18} /></Link>
        </section>
      )}

      {/* ── Thiết bị tiêu biểu ── */}
      {products.length > 0 && (
        <section className="container-page pt-14" aria-labelledby="thiet-bi">
          <div className="flex items-end justify-between gap-4">
            <h2 id="thiet-bi" className="h-section">Thiết bị tiêu biểu</h2>
            <Link href="/thiet-bi" className="inline-flex items-center gap-1 font-semibold text-brand-dark hover:underline">Xem danh mục <Icon name="arrow" size={18} /></Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}

      {/* ── Hỏi đáp nhanh + tư vấn ── */}
      <section className="container-page grid gap-6 pt-14 lg:grid-cols-[1.4fr_1fr]" aria-labelledby="hoi-dap">
        {faqs.length > 0 && (
          <div>
            <h2 id="hoi-dap" className="h-section">Hỏi đáp nhanh</h2>
            <div className="mt-6 space-y-3">
              {faqs.map((f) => (
                <details key={f.id} className="card group open:border-brand">
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-[17px] font-semibold">
                    {f.question}<Icon name="chevronDown" size={22} className="shrink-0 transition group-open:rotate-180 group-open:text-brand" />
                  </summary>
                  <p className="mx-5 mb-4 whitespace-pre-line rounded-lg bg-paper p-3 text-ink-soft">{f.answer}</p>
                </details>
              ))}
            </div>
            <Link href="/ho-tro" className="mt-4 inline-flex items-center gap-1 font-semibold text-brand-dark hover:underline">Xem tất cả câu hỏi <Icon name="arrow" size={18} /></Link>
          </div>
        )}
        <div className={faqs.length ? "lg:pt-[60px]" : "lg:col-span-2"}><ConsultCta /></div>
      </section>
    </>
  );
}
