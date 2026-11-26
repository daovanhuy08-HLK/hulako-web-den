// P06 Chi tiết góc livestream (ảnh 005, 078): điều kiện phòng, góc máy, vị trí đèn & người, sơ đồ, các bước, thiết bị dùng thật.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { findRedirect, getSetup } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";
import { INDUSTRIES, SPACES, STYLES } from "@/lib/catalog";
import { ArticleRowCard, ConsultCta, Cover, JsonLd } from "@/components/ui";
import { Icon, type IconName } from "@/components/site/Icon";
import { SITE_URL } from "@/lib/settings";

export const revalidate = 300;
type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const d = await getSetup(slug);
  if (!d) return { title: "Không tìm thấy góc livestream" };
  return {
    title: d.setup.title, description: d.setup.summary.slice(0, 160), alternates: { canonical: `/goc-livestream/${slug}` },
    openGraph: { images: d.setup.coverUrl ? [{ url: d.setup.coverUrl, alt: d.setup.coverAlt }] : undefined },
  };
}

const STEP_ICONS: IconName[] = ["camera", "bulb", "phone", "checkCircle"];
const label = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
/** "Tiêu đề: mô tả" → tách thành 2 phần để hiện như ảnh 078 */
const splitStep = (t: string) => { const m = t.match(/^(.{3,60}?)[:—–]\s+(.+)$/); return m ? { title: m[1], text: m[2] } : { title: "", text: t }; };

export default async function SetupPage({ params }: P) {
  const { slug } = await params;
  const d = await getSetup(slug);
  if (!d) {
    const to = await findRedirect(`/goc-livestream/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  const { setup: s, devices, related } = d;
  const body = s.body ? renderMarkdown(s.body).html : "";
  const info: { icon: IconName; k: string; v: string }[] = [
    { icon: "bag", k: "Ngành hàng", v: s.industry ? label(INDUSTRIES, s.industry) : "" },
    { icon: "video", k: "Kiểu quay", v: s.style ? label(STYLES, s.style) : "" },
    { icon: "home", k: "Không gian", v: s.space ? label(SPACES, s.space) : "" },
    { icon: "frame", k: "Điều kiện phòng", v: s.roomConditions },
    { icon: "camera", k: "Góc máy", v: s.cameraAngle },
    { icon: "bulb", k: "Vị trí đèn và người", v: s.lightPosition },
  ].filter((x) => x.v) as { icon: IconName; k: string; v: string }[];

  const deviceList = (
    <div className="space-y-3">
      {devices.length ? devices.map((dv) => (
        <div key={dv.variantId} className="flex items-center gap-4 overflow-hidden rounded-xl border border-line bg-white">
          <div className="relative h-[110px] w-[44%] max-w-[165px] shrink-0 bg-[#EFECE8]">{dv.image && <Image src={dv.image.url} alt={dv.image.alt} fill sizes="165px" className="object-cover" />}</div>
          <div className="min-w-0 py-3 pr-3">
            <p className="text-[18px] font-semibold leading-snug">{dv.productName}</p>
            <p className="text-sm text-ink-muted">{dv.variantName}</p>
            {dv.available
              ? <Link href={`/thiet-bi/${dv.productSlug}`} className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-brand-dark underline underline-offset-4">Xem sản phẩm <Icon name="arrow" size={18} /></Link>
              : <p className="mt-1 text-sm text-brand-dark">Đã ngừng bán — <Link href="/lien-he?chu-de=tu-van-chon-den" className="underline">hỏi phương án thay thế</Link></p>}
          </div>
        </div>
      )) : <p className="text-ink-muted">Thiết bị đang được cập nhật.</p>}
    </div>
  );

  return (
    <article className="container-page py-6 lg:py-7">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "HowTo", name: s.title, description: s.summary, url: `${SITE_URL}/goc-livestream/${s.slug}`, step: s.steps.map((t, i) => ({ "@type": "HowToStep", position: i + 1, text: t })) }} />
      <Link href="/goc-livestream" className="hidden items-center gap-2 text-[17px] text-ink-muted hover:text-brand lg:inline-flex"><Icon name="arrowLeft" size={22} />Góc livestream</Link>
      <h1 className="text-[30px] font-extrabold leading-tight tracking-tight sm:text-[40px] lg:mt-3 lg:text-[46px]">{s.title}</h1>
      <span className="accent-bar mt-3 lg:hidden" />
      <p className="mt-2 hidden text-[19px] text-ink-muted lg:block">{s.isSample ? "Bố trí minh họa" : s.summary}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-9">
        <div className="overflow-hidden rounded-[16px]"><Cover src={s.coverUrl} alt={s.coverAlt || s.title} priority ratio="aspect-[1036/620] lg:aspect-[1036/462]" sizes="(max-width: 1024px) 100vw, 66vw" /></div>
        <aside className="card h-fit p-6 lg:p-7">
          <h2 className="text-[24px] font-bold">Thông tin góc live</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {info.slice(0, 2).map((x) => (
              <div key={x.k} className="flex items-center gap-4 py-4 text-[18px]"><Icon name={x.icon} size={28} className="shrink-0" /><dt className="font-semibold">{x.k}:</dt><dd>{x.v}</dd></div>
            ))}
          </dl>
          <h2 className="mt-7 text-[24px] font-bold">Thiết bị tham khảo</h2>
          <div className="mt-4">{deviceList}</div>
        </aside>
      </div>

      {s.isSample && <p className="mt-3 text-sm text-ink-muted lg:hidden">Ảnh bố trí minh họa</p>}
      {s.summary && <p className="mt-6 max-w-3xl text-[17px] leading-relaxed text-ink-soft lg:hidden">{s.summary}</p>}

      {info.length > 2 && (
        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.slice(2).map((x) => (
            <div key={x.k} className="card p-5"><dt className="flex items-center gap-2 font-semibold"><Icon name={x.icon} size={22} className="text-brand" />{x.k}</dt><dd className="mt-2 text-[15px] text-ink-soft">{x.v}</dd></div>
          ))}
        </dl>
      )}

      {s.diagramUrl && (
        <section className="card mt-8 p-4 sm:p-6">
          <h2 className="text-[24px] font-bold">Sơ đồ bố trí</h2>
          <div className="relative mt-4 aspect-[825/335] overflow-hidden rounded-xl bg-white">
            <Image src={s.diagramUrl} alt={`Sơ đồ nhìn từ trên xuống: vị trí người live, đèn và điện thoại của góc ${s.title}`} fill sizes="(max-width: 1024px) 100vw, 900px" className="object-contain" />
          </div>
        </section>
      )}

      {s.steps.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[32px]">Các bước bố trí</h2>
          <ol className="mt-5 grid gap-4 lg:grid-cols-3 lg:gap-0">
            {s.steps.map((t, i) => {
              const st = splitStep(t);
              return (
                <li key={i} className="flex items-center">
                  <div className="card flex flex-1 items-start gap-4 p-5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{i + 1}</span>
                    <Icon name={STEP_ICONS[i % STEP_ICONS.length]} size={36} className="mt-0.5 hidden shrink-0 sm:block" />
                    <div>
                      {st.title && <p className="text-[19px] font-bold leading-snug">{st.title}</p>}
                      <p className="mt-1 text-[16px] leading-relaxed text-ink-soft">{st.text}</p>
                    </div>
                  </div>
                  {i < s.steps.length - 1 && (i + 1) % 3 !== 0 && <Icon name="chevron" size={26} className="mx-3 hidden shrink-0 text-ink-muted lg:block" />}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {s.demoNote && <p className="mt-6 rounded-xl border-l-4 border-brand bg-brand-tint p-4 text-[15px]"><strong>Điều kiện quay thực tế:</strong> {s.demoNote}</p>}
      {body && <div className="prose-hlk mt-6 max-w-3xl" dangerouslySetInnerHTML={{ __html: body }} />}
      <p className="mt-4 text-[13px] text-ink-muted">Kết quả ánh sáng thực tế phụ thuộc diện tích phòng, khoảng cách đặt đèn và thiết bị quay của bạn.</p>

      {related.length > 0 && (
        <section className="mt-12"><h2 className="h-section">Hướng dẫn liên quan</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{related.map((a) => <ArticleRowCard key={a.id} a={a} />)}</div></section>
      )}
      <div className="mt-12"><ConsultCta context={`mau-setup=${encodeURIComponent(s.title)}`} title="Phòng của bạn khác mẫu này?" text="Gửi diện tích, món hàng và kiểu live — HULAKO gợi ý cách đặt đèn hợp phòng bạn." /></div>
    </article>
  );
}
