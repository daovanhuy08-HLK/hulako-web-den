// P11 Tuyển dụng (ảnh 014, 084; chưa có vị trí 073): vị trí còn mở, bộ phận, địa điểm, hình thức, hạn nhận.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listOpenJobs } from "@/lib/queries";
import { formatDateVN } from "@/lib/text";
import { Icon, type IconName } from "@/components/site/Icon";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Tuyển dụng — Cơ hội làm việc tại HULAKO",
  description: "Các vị trí đang mở tại HULAKO — Vua Đèn Lives (Hà Nội): nội dung, vận hành sàn, tư vấn.",
  alternates: { canonical: "/tuyen-dung" },
};

const DEPTS: Record<string, { label: string; icon: IconName }> = {
  "noi-dung": { label: "Nội dung", icon: "video" }, "van-hanh": { label: "Vận hành", icon: "layers" }, "tu-van": { label: "Tư vấn", icon: "chat" }, "kho": { label: "Kho", icon: "building" },
};

type SP = Promise<Record<string, string | undefined>>;

export default async function JobsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const all = await listOpenJobs();
  const depts = [...new Set(all.map((j) => j.department).filter(Boolean))];
  const dept = depts.includes(sp.bo_phan ?? "") ? sp.bo_phan : undefined;
  const jobs = dept ? all.filter((j) => j.department === dept) : all;
  const anySample = all.some((j) => j.isSample);

  if (!all.length) {
    return (
      <div className="container-page max-w-3xl py-0 lg:py-10">
        <div className="relative -mx-4 aspect-[941/520] overflow-hidden sm:mx-0 sm:rounded-card"><Image src="/demo/tuyen-dung.jpg" alt="" fill priority sizes="800px" className="object-cover" /></div>
        <h1 className="mt-6 text-[30px] font-extrabold tracking-tight sm:text-[42px]">Cơ hội làm việc tại HULAKO</h1>
        <div role="status" className="card mt-6 p-6 text-center sm:p-10">
          <span className="relative mx-auto block w-fit"><Icon name="briefcase" size={72} stroke={1.5} /><Icon name="spark" size={30} className="absolute -right-6 -top-3 text-brand" stroke={2.4} /></span>
          <p className="mt-4 text-[24px] font-extrabold sm:text-[30px]">Hiện chưa có vị trí đang tuyển</p>
          <p className="mt-2 text-ink-soft">Bạn có thể quay lại trang này để xem các vị trí mới.</p>
          <div className="mx-auto mt-6 grid max-w-sm gap-3">
            <Link href="/" className="btn-primary justify-between !min-h-[54px]">Về trang chủ <Icon name="chevron" size={20} /></Link>
            <Link href="/ve-hulako" className="btn-outline justify-between !min-h-[54px] !text-ink">Tìm hiểu về HULAKO <Icon name="chevron" size={20} /></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="relative lg:hidden">
        <div className="relative aspect-[941/520]"><Image src="/demo/tuyen-dung.jpg" alt="" fill priority sizes="100vw" className="object-cover" /></div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-paper to-transparent" />
      </section>
      <div className="container-page grid gap-8 pb-4 lg:grid-cols-[650px_1fr] lg:items-start lg:gap-10 lg:py-14">
        <div className="relative hidden aspect-[650/720] overflow-hidden rounded-[18px] lg:block">
          <Image src="/demo/tuyen-dung.jpg" alt="Góc làm việc quay nội dung tại HULAKO (ảnh minh họa)" fill priority sizes="650px" className="object-cover" />
          {anySample && <span className="absolute left-5 top-5 rounded-md bg-white/90 px-3 py-1 text-[15px] text-ink-soft">Dữ liệu minh họa</span>}
        </div>
        <div>
          <h1 className="-mt-10 text-[34px] font-extrabold leading-tight tracking-tight sm:text-[46px] lg:mt-6 lg:text-[58px]">Cơ hội làm việc tại HULAKO</h1>
          <span className="accent-bar mt-5 hidden !w-32 lg:block" />
          {anySample && <span className="tag-sample mt-3 lg:hidden">Giao diện minh họa</span>}
          {depts.length > 0 && (
            <ul className="mt-6 grid grid-cols-3 gap-3 sm:flex lg:mt-12" aria-label="Bộ phận">
              <li><Link href="/tuyen-dung" aria-current={!dept ? "true" : undefined} className={`chip w-full justify-center !rounded-xl !min-h-[54px] sm:!px-9 sm:!text-[19px] ${!dept ? "chip-active" : ""}`}>Tất cả</Link></li>
              {depts.map((d) => <li key={d}><Link href={`/tuyen-dung?bo_phan=${d}`} aria-current={dept === d ? "true" : undefined} className={`chip w-full justify-center !rounded-xl !min-h-[54px] sm:!px-9 sm:!text-[19px] ${dept === d ? "chip-active" : ""}`}>{DEPTS[d]?.label ?? d}</Link></li>)}
            </ul>
          )}
          <ul className="mt-6 space-y-5 lg:mt-10 lg:space-y-9">
            {jobs.map((j) => {
              const dp = DEPTS[j.department] ?? { label: "", icon: "briefcase" as IconName };
              return (
                <li key={j.id} className="card relative p-5 sm:flex sm:items-center sm:gap-6 sm:p-7">
                  <span className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center text-brand sm:static sm:h-[90px] sm:w-[90px] sm:shrink-0 sm:rounded-xl sm:bg-brand-tint"><Icon name={dp.icon} size={44} stroke={1.6} /></span>
                  <div className="min-w-0 flex-1">
                    {j.isSample && <span className="tag !text-[12px] sm:hidden">Vị trí mẫu</span>}
                    <h2 className="mt-1 pr-14 text-[22px] font-bold sm:mt-0 sm:pr-0 sm:text-[30px]"><Link href={`/tuyen-dung/${j.slug}`} className="after:absolute after:inset-0">{j.title}</Link></h2>
                    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-soft sm:text-[19px]">
                      {j.isSample && <span className="hidden items-center gap-2 sm:flex"><Icon name="tag" size={22} />Vị trí mẫu<span aria-hidden className="ml-2 h-7 w-px bg-line" /></span>}
                      <span className="flex items-center gap-2"><Icon name="pin" size={22} />{j.location}</span>
                      <span aria-hidden className="h-6 w-px bg-line" />
                      <span className="flex items-center gap-2"><Icon name="calendar" size={20} />{j.employmentType}</span>
                      {j.deadline && <span className="w-full text-[14px] text-ink-muted">Hạn nhận hồ sơ: {formatDateVN(j.deadline)}</span>}
                    </p>
                  </div>
                  <span className="btn-primary relative mt-4 w-full !min-h-[50px] sm:mt-0 sm:w-auto sm:!px-7 sm:!text-[19px]">Xem công việc <Icon name="chevron" size={18} className="sm:hidden" /></span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
