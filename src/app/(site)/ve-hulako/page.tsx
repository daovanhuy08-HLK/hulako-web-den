// P02 Về HULAKO (ảnh 011, 081) — sứ mệnh/tầm nhìn/giá trị chỉ hiện khi bản nội dung đã duyệt (A02).
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { Icon } from "@/components/site/Icon";
import { ChannelButtons, prettyPhone, telHref } from "@/components/site/Channels";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Về HULAKO — Vua Đèn Lives",
  description: "HULAKO bán đèn, softbox và chân đỡ cho người bán hàng online tự dựng góc live tại nhà. Thông tin công ty, người sáng lập và cách liên hệ.",
  alternates: { canonical: "/ve-hulako" },
};

export default async function AboutPage() {
  const [c, ch] = await Promise.all([getSetting("company"), getSetting("channels")]);
  const img = c.aboutImage || "/demo/ve-hulako.jpg";
  return (
    <div className="pb-4">
      {/* Điện thoại: ảnh tràn, tiêu đề đè (ảnh 011) */}
      <section className="relative lg:hidden">
        <div className="relative aspect-[941/740]"><Image src={img} alt={c.aboutImageAlt ?? ""} fill priority sizes="100vw" className="object-cover" /></div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-paper to-transparent" />
        <div className="absolute left-4 top-4"><h1 className="text-[36px] font-extrabold tracking-tight">Về HULAKO</h1><span className="accent-bar mt-1" /></div>
      </section>

      <div className="container-page lg:pt-10">
        <h1 className="hidden text-[64px] font-extrabold tracking-tight lg:block">Về HULAKO</h1>
        <div className="grid gap-6 lg:mt-6 lg:grid-cols-[1.08fr_1fr] lg:items-center lg:gap-14">
          <div className="relative hidden aspect-[772/478] overflow-hidden rounded-[16px] lg:block"><Image src={img} alt={c.aboutImageAlt ?? ""} fill priority sizes="50vw" className="object-cover" /></div>
          <div>
            <p className="text-[24px] font-extrabold leading-tight tracking-tight sm:text-[34px] lg:text-[42px]">{c.aboutHeadline}</p>
            <span className="accent-bar mt-6 hidden lg:block" />
            <dl className="mt-7 hidden space-y-4 text-[20px] lg:block">
              <div className="flex items-center gap-5"><Icon name="building" size={34} className="text-ink-soft" /><dt className="sr-only">Công ty</dt><dd>{c.legalName}</dd></div>
              <div className="flex items-center gap-5"><Icon name="mail" size={34} className="text-ink-soft" /><dt className="sr-only">Email</dt><dd><a href={`mailto:${c.email}`} className="hover:text-brand">{c.email}</a></dd></div>
            </dl>
            <Link href="/lien-he" className="btn-primary mt-8 hidden !min-h-[66px] !px-10 !text-[22px] lg:inline-flex">Liên hệ HULAKO <Icon name="arrow" size={26} /></Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:mt-12 lg:grid-cols-[1fr_1.1fr] lg:gap-9">
          <Link href="/thiet-bi" className="card flex items-center gap-5 p-4 hover:border-brand lg:p-7">
            <Icon name="layers" size={44} className="shrink-0 text-brand" stroke={1.6} />
            <span className="flex-1"><span className="block text-[19px] font-bold lg:text-[26px]">Thiết bị theo nhu cầu</span><span className="mt-1 hidden text-[17px] text-ink-soft lg:block">Đèn, softbox và chân đỡ phù hợp để dựng góc live tại nhà.</span></span>
            <Icon name="chevron" size={22} className="text-brand lg:hidden" />
          </Link>
          <Link href="/lien-he?chu-de=tu-van-chon-den" className="card flex items-center gap-5 p-4 hover:border-brand lg:p-7">
            <Icon name="chat" size={44} className="shrink-0 text-brand" stroke={1.6} />
            <span className="flex-1"><span className="block text-[19px] font-bold lg:text-[26px]">Hướng dẫn setup qua chat</span><span className="mt-1 hidden text-[17px] text-ink-soft lg:block">Hỗ trợ tư vấn cách setup và sắp xếp góc live phù hợp với không gian của bạn.</span></span>
            <Icon name="chevron" size={22} className="text-brand lg:hidden" />
          </Link>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-8 text-[17px] leading-8 text-ink-soft">
            <section><h2 className="text-[26px] font-extrabold text-ink">Vì sao có HULAKO</h2><p className="mt-3">{c.aboutWhy}</p><p className="mt-3">{c.aboutIntro}</p></section>
            <section><h2 className="text-[26px] font-extrabold text-ink">Người sáng lập</h2><p className="mt-3">HULAKO do {c.founder} sáng lập và điều hành cùng đội ngũ vận hành, tư vấn và kho tại Hà Nội.</p></section>
            {c.teamImage && <div className="relative aspect-[16/9] overflow-hidden rounded-card"><Image src={c.teamImage} alt="Đội ngũ HULAKO" fill sizes="(max-width:1024px) 100vw, 60vw" className="object-cover" /></div>}
            {c.mission?.approved && <section><h2 className="text-[26px] font-extrabold text-ink">Sứ mệnh</h2><p className="mt-3">{c.mission.text}</p></section>}
            {c.vision?.approved && <section><h2 className="text-[26px] font-extrabold text-ink">Tầm nhìn</h2><p className="mt-3">{c.vision.text}</p></section>}
            {c.values?.approved && c.values.items.length > 0 && (
              <section><h2 className="text-[26px] font-extrabold text-ink">Giá trị</h2><ol className="mt-3 list-decimal space-y-1 pl-6">{c.values.items.map((v) => <li key={v}>{v}</li>)}</ol></section>
            )}
          </div>
          <aside>
            <h2 className="text-[22px] font-bold lg:hidden">Thông tin công ty</h2>
            <dl className="card mt-3 divide-y divide-line text-[16px] lg:mt-0">
              <div className="flex gap-4 p-4"><Icon name="building" size={24} className="shrink-0 text-ink-soft" /><div><dt className="text-sm text-ink-muted">Tên công ty</dt><dd className="font-semibold">{c.legalName}</dd></div></div>
              <div className="flex gap-4 p-4"><Icon name="file" size={24} className="shrink-0 text-ink-soft" /><div><dt className="text-sm text-ink-muted">Mã số thuế</dt><dd>{c.taxCode}</dd></div></div>
              <div className="flex gap-4 p-4"><Icon name="pin" size={24} className="shrink-0 text-ink-soft" /><div><dt className="text-sm text-ink-muted">Địa chỉ</dt><dd>{c.address}</dd></div></div>
              <div className="flex gap-4 p-4"><Icon name="mail" size={24} className="shrink-0 text-ink-soft" /><div><dt className="text-sm text-ink-muted">Email</dt><dd><a className="hover:text-brand" href={`mailto:${c.email}`}>{c.email}</a></dd></div></div>
              {c.phone && <div className="flex gap-4 p-4"><Icon name="phone" size={24} className="shrink-0 text-ink-soft" /><div><dt className="text-sm text-ink-muted">Hotline</dt><dd><a className="font-semibold hover:text-brand" href={telHref(c.phone)}>{prettyPhone(c.phone)}</a></dd></div></div>}
            </dl>
            <ChannelButtons ch={ch} className="mt-4" />
            <p className="mt-3 text-[13px] text-ink-muted">{c.trademarkNote}</p>
            <Link href="/lien-he" className="btn-primary mt-5 w-full !min-h-[54px] lg:hidden">Liên hệ HULAKO <Icon name="chevron" size={20} /></Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
