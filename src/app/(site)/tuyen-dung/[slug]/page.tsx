// P12 Chi tiết việc làm và ứng tuyển (ảnh 015, 085; đã đóng 061). Tin đóng/hết hạn: hiện trạng thái, ẩn form,
// gỡ markup JobPosting; máy chủ cũng từ chối hồ sơ mới.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, isJobOpen } from "@/lib/queries";
import { getSetting, SITE_URL } from "@/lib/settings";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateVN } from "@/lib/text";
import { CV_MAX_BYTES } from "@/lib/storage";
import { JsonLd } from "@/components/ui";
import { ApplyForm } from "@/components/ApplyForm";
import { Icon, type IconName } from "@/components/site/Icon";

export const revalidate = 300;
type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const j = await getJob((await params).slug);
  if (!j) return { title: "Không tìm thấy vị trí" };
  return { title: `Tuyển dụng: ${j.title}`, description: `${j.title} — ${j.location}, ${j.employmentType}.`, alternates: { canonical: `/tuyen-dung/${j.slug}` }, robots: isJobOpen(j) ? undefined : { index: false } };
}

export default async function JobPage({ params }: P) {
  const j = await getJob((await params).slug);
  if (!j) notFound();
  const [consent, company] = await Promise.all([getSetting("consent"), getSetting("company")]);
  const open = isJobOpen(j);
  const sections: { h: string; md: string; icon: IconName }[] = ([
    { h: "Công việc", md: j.description, icon: "clapper" }, { h: "Yêu cầu", md: j.requirements, icon: "user" }, { h: "Quyền lợi", md: j.benefits, icon: "gift" },
  ] as { h: string; md: string; icon: IconName }[]).filter((s) => s.md);

  const meta = (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px] text-ink-soft sm:text-[20px]">
      <span className="flex items-center gap-1.5"><Icon name="pin" size={22} className="text-brand" />{j.location}</span><span aria-hidden>·</span>
      <span className="flex items-center gap-1.5"><Icon name="briefcase" size={20} className="sm:hidden" />{j.employmentType}</span>
      {j.deadline && <><span aria-hidden>·</span><span>Hạn nhận: {formatDateVN(j.deadline)}</span></>}
    </p>
  );

  return (
    <div className="container-page py-5 lg:py-8">
      {open && (
        <JsonLd data={{
          "@context": "https://schema.org", "@type": "JobPosting", title: j.title, description: renderMarkdown(`${j.description}\n\n${j.requirements}\n\n${j.benefits}`).html,
          datePosted: (j.publishedAt ?? new Date()).toISOString().slice(0, 10), validThrough: j.deadline ? `${j.deadline}T23:59:59+07:00` : undefined,
          employmentType: j.employmentType.toLowerCase().includes("bán") ? "PART_TIME" : "FULL_TIME",
          hiringOrganization: { "@type": "Organization", name: company.legalName, sameAs: SITE_URL },
          jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", streetAddress: j.location || company.address, addressCountry: "VN" } },
        }} />
      )}

      {!open ? (
        /* Tin đã đóng (ảnh 061) */
        <div className="mx-auto max-w-2xl">
          <div className="relative aspect-[941/520] overflow-hidden rounded-card"><Image src="/demo/viec-lam-hero.jpg" alt="" fill priority sizes="700px" className="object-cover" /></div>
          {j.isSample && <span className="mt-4 inline-block rounded bg-black/5 px-2 py-1 text-[13px] text-ink-soft">Vị trí minh họa</span>}
          <h1 className="mt-3 text-[32px] font-extrabold tracking-tight sm:text-[42px]">{j.title}</h1>
          <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-1.5 font-semibold text-brand-dark"><Icon name="alert" size={20} />Đã đóng tuyển dụng</p>
          <p className="mt-4 text-[17px] text-ink-soft">Vị trí này đã ngừng nhận hồ sơ. Bạn có thể xem các cơ hội khác tại HULAKO.</p>
          <div className="card mt-5 p-5">
            <h2 className="text-[19px] font-bold">Thông tin vị trí</h2>
            <p className="mt-3 flex items-center gap-3 border-b border-line pb-3"><Icon name="pin" size={22} />{j.location}</p>
            <p className="mt-3 flex items-center gap-3"><Icon name="briefcase" size={22} />{j.employmentType}</p>
          </div>
          <div className="mt-6 grid gap-3">
            <Link href="/tuyen-dung" className="btn-primary !min-h-[54px]">Xem vị trí đang tuyển <Icon name="chevron" size={20} /></Link>
            <Link href="/" className="btn-line !min-h-[54px]">Về trang chủ</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.27fr_1fr] lg:gap-8">
          <div>
            <div className="relative hidden aspect-[933/313] overflow-hidden rounded-card lg:block"><Image src="/demo/viec-lam-hero.jpg" alt="" fill priority sizes="60vw" className="object-cover" /></div>
            <div className="flex flex-wrap items-center gap-3 lg:mt-7">
              <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[46px]">{j.title}</h1>
              {j.isSample && <span className="tag !rounded-full !px-4 !py-1.5 !text-[15px] sm:!text-[19px]">Vị trí mẫu</span>}
            </div>
            {meta}
            <div className="mt-6 divide-y divide-line lg:space-y-4 lg:divide-y-0">
              {sections.map((s) => (
                <section key={s.h} className="flex gap-4 py-4 lg:card lg:items-center lg:gap-6 lg:px-6 lg:py-5">
                  <Icon name={s.icon} size={44} className="shrink-0 text-brand lg:size-12" stroke={1.6} />
                  <span aria-hidden className="hidden h-14 w-px bg-line lg:block" />
                  <div><h2 className="text-[21px] font-bold sm:text-[24px]">{s.h}</h2><div className="prose-hlk !text-[16px] !leading-7 sm:!text-[18px] [&_p]:my-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.md).html }} /></div>
                </section>
              ))}
            </div>
          </div>
          <section className="lg:card h-fit lg:p-9" aria-labelledby="ung-tuyen">
            <h2 id="ung-tuyen" className="mb-5 text-[28px] font-extrabold sm:text-[40px]">Ứng tuyển</h2>
            <ApplyForm jobId={j.id} jobTitle={j.title} consentText={consent.application} maxMb={CV_MAX_BYTES / 1024 / 1024} />
          </section>
        </div>
      )}
    </div>
  );
}
