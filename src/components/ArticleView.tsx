// P08 Bài viết — hướng dẫn (ảnh 007, 080: mục lục trái, nội dung giữa, thiết bị + tư vấn phải)
// và tin tức (ảnh 092: nội dung trái, "Nội dung liên quan" phải). JSON-LD Article/NewsArticle.
import Image from "next/image";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateVN } from "@/lib/text";
import { getSetting, SITE_URL } from "@/lib/settings";
import { LeadMagnet } from "./LeadMagnet";
import type { getPublishedArticle } from "@/lib/queries";
import { Breadcrumbs, ProductCard, ConsultCta, Cover, JsonLd, SetupCard } from "./ui";
import { Icon, type IconName } from "./site/Icon";
import { Toc } from "./Toc";

type Data = NonNullable<Awaited<ReturnType<typeof getPublishedArticle>>>;

export async function ArticleView({ d, base, baseLabel }: { d: Data; base: string; baseLabel: string }) {
  const { a, r, topic } = d;
  // Popup quà tặng (cấu hình ở Quản trị › Trang công ty › Popup)
  const [magnet, consent, company] = await Promise.all([getSetting("leadMagnet"), getSetting("consent"), getSetting("company")]);
  const months = Math.max(1, Math.round(consent.retentionDaysLead / 30));
  const { html, toc } = renderMarkdown(r.body);
  const url = `${SITE_URL}${base}/${a.slug}`;
  const isNews = a.kind === "news";
  const updated = a.contentUpdatedAt && a.publishedAt && a.contentUpdatedAt.getTime() - a.publishedAt.getTime() > 86400_000 ? a.contentUpdatedAt : null;
  const h2s = toc.filter((t) => t.level === 2);
  const product = d.relatedProducts[0];

  const meta = (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[16px] text-ink-soft sm:text-[18px]">
      {isNews && a.isSample && <><span className="tag !px-4 !py-1.5 !text-[16px]">Bài minh họa</span><span aria-hidden className="h-6 w-px bg-line" /></>}
      <span className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isNews ? "" : "bg-brand-soft text-brand"}`}><Icon name={isNews ? "users" : "user"} size={22} /></span>
        {d.authorName}
      </span>
      <span className="text-[14px] text-ink-muted sm:text-[15px]">Đăng {formatDateVN(a.publishedAt)}{updated ? ` · Cập nhật ${formatDateVN(updated)}` : ""}</span>
      {!isNews && a.isSample && <span className="tag">Bài mẫu</span>}
    </div>
  );

  const related: { href: string; label: string; icon: IconName }[] = [
    ...d.relatedSetups.map((s) => ({ href: `/goc-livestream/${s.slug}`, label: s.title, icon: "home" as IconName })),
    ...d.relatedProducts.map((p) => ({ href: `/thiet-bi/${p.slug}`, label: p.name, icon: "softbox" as IconName })),
    { href: "/ho-tro", label: "Hỏi đáp về lắp đặt", icon: "chat" as IconName },
  ].slice(0, 5);

  return (
    <article className="container-page py-5 lg:py-6">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": isNews ? "NewsArticle" : "Article",
        headline: r.title, description: r.summary, image: r.coverUrl ? [r.coverUrl.startsWith("http") ? r.coverUrl : `${SITE_URL}${r.coverUrl}`] : undefined,
        datePublished: a.publishedAt?.toISOString(), dateModified: (a.contentUpdatedAt ?? a.publishedAt)?.toISOString(),
        author: { "@type": "Organization", name: d.authorName }, publisher: { "@type": "Organization", name: "HULAKO — Vua Đèn Lives" },
        mainEntityOfPage: url,
      }} />
      <Breadcrumbs className="hidden sm:block" items={[{ href: base, label: baseLabel }, ...(topic && !isNews ? [{ href: `/kien-thuc/chu-de/${topic.slug}`, label: topic.name }] : [])]} />

      <div className={`grid gap-8 ${isNews ? "lg:grid-cols-[1fr_500px]" : "lg:grid-cols-[282px_1fr_396px] lg:gap-10"}`}>
        {/* Mục lục trái (chỉ bài hướng dẫn, máy tính) */}
        {!isNews && (
          <aside className="hidden lg:block">
            {h2s.length > 0 && <div className="card sticky top-36 min-h-[300px] p-5"><Toc items={h2s} /></div>}
          </aside>
        )}

        <div className="min-w-0">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight sm:text-[40px] lg:text-[46px]">{r.title}</h1>
          {meta}
          {!isNews && <hr className="my-6 hidden border-line lg:block" />}
          {r.summary && <p className="mt-4 text-[17px] leading-relaxed text-ink-soft lg:hidden">{r.summary}</p>}
          {r.coverUrl && <div className="mt-5 overflow-hidden rounded-[14px] lg:mt-0"><Cover src={r.coverUrl} alt={r.coverAlt || r.title} priority ratio="aspect-[870/428]" sizes="(max-width: 1024px) 100vw, 880px" /></div>}

          {/* Mục lục thu gọn trên điện thoại (ảnh 007) */}
          {!isNews && h2s.length > 0 && (
            <details open className="card group mt-5 lg:hidden">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold"><span className="flex items-center gap-3"><Icon name="list" size={22} className="text-brand" />Mục lục</span><Icon name="chevronDown" size={20} className="group-open:rotate-180" /></summary>
              <ol className="divide-y divide-line border-t border-line">{h2s.map((t) => <li key={t.id}><a href={`#${t.id}`} className="flex items-center justify-between px-4 py-2.5 text-[15px]">{t.text}<Icon name="chevron" size={16} className="text-brand" /></a></li>)}</ol>
            </details>
          )}

          <div className="prose-hlk mt-6 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-3 [&_h2]:before:block [&_h2]:before:h-7 [&_h2]:before:w-1 [&_h2]:before:shrink-0 [&_h2]:before:rounded [&_h2]:before:bg-brand lg:[&_h2]:before:hidden" dangerouslySetInnerHTML={{ __html: html }} />

          {magnet.enabled && (
            <LeadMagnet articleTitle={r.title} consentText={`Dữ liệu được lưu tối đa ${months} tháng, bạn có thể yêu cầu xem hoặc xoá qua email ${company.email}.`} cfg={{
              title: magnet.title, subtitle: magnet.subtitle, bullets: magnet.bullets, buttonLabel: magnet.buttonLabel,
              delaySeconds: magnet.delaySeconds, scrollPercent: magnet.scrollPercent, businessOptions: magnet.businessOptions ?? [],
            }} />
          )}

          {isNews ? (
            <Link href="/ho-tro" className="btn-primary mt-6 !min-h-[56px] !px-7 !text-[18px]">Xem mục hỗ trợ <Icon name="arrow" size={22} /></Link>
          ) : d.relatedSetups[0] ? (
            <Link href={`/goc-livestream/${d.relatedSetups[0].slug}`} className="btn-outline mt-6 w-full justify-between lg:hidden">Xem góc livestream mẫu <Icon name="chevron" size={20} /></Link>
          ) : null}
        </div>

        {/* Cột phải */}
        <aside className="space-y-6">
          {isNews ? (
            <div className="card p-6 lg:sticky lg:top-36 lg:p-7">
              <h2 className="text-[26px] font-bold">Nội dung liên quan</h2>
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {related.map((x) => (
                  <li key={x.href}><Link href={x.href} className="flex items-center gap-4 py-4 text-[18px] hover:text-brand-dark"><Icon name={x.icon === "home" ? "file" : x.icon} size={28} className="shrink-0 text-ink-soft" /><span className="flex-1">{x.label}</span><Icon name="chevron" size={20} /></Link></li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-6 lg:sticky lg:top-36">
              {product && (
                <div className="card p-5">
                  <h2 className="flex items-center gap-3 text-[22px] font-bold"><Icon name="layers" size={26} />Thiết bị tham khảo</h2>
                  <Link href={`/thiet-bi/${product.slug}`} className="group mt-4 block">
                    <div className="relative aspect-[358/212] overflow-hidden rounded-xl bg-[#EFECE8]">{product.image && <Image src={product.image.url} alt={product.image.alt} fill sizes="360px" className="object-cover" />}</div>
                    <span className="mt-3 flex items-center justify-between gap-3">
                      <span><span className="block text-[18px] font-bold group-hover:text-brand-dark">{product.name}</span><span className="mt-1 line-clamp-2 block text-[15px] text-ink-muted">{product.summary}</span></span>
                      <Icon name="chevron" size={20} className="shrink-0" />
                    </span>
                  </Link>
                </div>
              )}
              <ConsultCta compact context={`bai-viet=${encodeURIComponent(r.title)}`} />
            </div>
          )}
        </aside>
      </div>

      {!isNews && d.relatedSetups.length > 0 && (
        <section className="mt-12"><h2 className="h-section">Góc livestream liên quan</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.relatedSetups.map((s) => <SetupCard key={s.id} s={s} />)}</div></section>
      )}
      {!isNews && d.relatedProducts.length > 1 && (
        <section className="mt-12"><h2 className="h-section">Thiết bị dùng trong bài</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">{d.relatedProducts.map((p) => <ProductCard key={p.id} p={p} />)}</div></section>
      )}
      <p className="mt-10 text-[15px]"><Link href={base} className="inline-flex items-center gap-2 font-semibold text-brand-dark hover:underline"><Icon name="arrowLeft" size={18} />Xem thêm bài khác</Link></p>
    </article>
  );
}
