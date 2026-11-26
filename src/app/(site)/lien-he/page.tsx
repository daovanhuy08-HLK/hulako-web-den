// P10 Liên hệ (ảnh 013, 083) — nhận ngữ cảnh từ sản phẩm, bài viết hoặc công cụ chọn đèn qua query.
import type { Metadata } from "next";
import Image from "next/image";
import { getSetting } from "@/lib/settings";
import { LeadForm } from "@/components/LeadForm";
import { Icon } from "@/components/site/Icon";
import { ChannelButtons, prettyPhone, telHref } from "@/components/site/Channels";

export const metadata: Metadata = {
  title: "Liên hệ HULAKO — nhờ tư vấn góc livestream",
  description: "Gửi yêu cầu để được tư vấn giải pháp chiếu sáng phù hợp cho góc livestream của bạn: diện tích phòng, món hàng và kiểu live.",
  alternates: { canonical: "/lien-he" },
};

type SP = Promise<Record<string, string | undefined>>;
const CONTEXT_KEYS: Record<string, string> = { "san-pham": "Sản phẩm", "bai-viet": "Bài viết", "mau-setup": "Góc live", "cau-hoi": "Câu hỏi", "chon-den": "Kết quả chọn đèn" };

export default async function ContactPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [c, ch, consent] = await Promise.all([getSetting("company"), getSetting("channels"), getSetting("consent")]);
  const context = Object.fromEntries(Object.entries(CONTEXT_KEYS).filter(([k]) => sp[k]).map(([k, label]) => [label, String(sp[k]).slice(0, 300)]));
  const source = sp["chon-den"] ? "selector" : sp["san-pham"] ? "product" : sp["bai-viet"] ? "article" : sp["cau-hoi"] ? "support" : "contact";

  const companyCard = (
    <div className="space-y-4 text-[17px] sm:text-[20px]">
      <p className="flex items-center gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand"><Icon name="building" size={26} /></span><span className="font-semibold sm:font-bold">{c.legalName}</span></p>
      <p className="flex items-center gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand"><Icon name="mail" size={26} /></span><a href={`mailto:${c.email}`} className="hover:text-brand">{c.email}</a></p>
      {c.phone && <p className="flex items-center gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand"><Icon name="phone" size={26} /></span><a href={telHref(c.phone)} className="hover:text-brand">Hotline: <b>{prettyPhone(c.phone)}</b></a></p>}
    </div>
  );

  return (
    <div>
      {/* Điện thoại: ảnh + tiêu đề đè (ảnh 013) */}
      <section className="relative lg:hidden">
        <div className="relative aspect-[941/470]"><Image src="/demo/lien-he.jpg" alt="" fill priority sizes="100vw" className="object-cover object-top" /></div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-paper via-paper/70 to-transparent" />
        <h1 className="absolute bottom-2 left-4 text-[34px] font-extrabold tracking-tight">Liên hệ HULAKO</h1>
      </section>

      <div className="container-page py-4 lg:py-10">
        <h1 className="hidden text-[58px] font-extrabold tracking-tight lg:block">Liên hệ HULAKO</h1>
        <p className="mt-2 hidden text-[20px] text-ink-soft lg:block">Gửi yêu cầu cho chúng tôi để được tư vấn giải pháp chiếu sáng phù hợp cho góc livestream của bạn.</p>
        <div className="mt-2 grid gap-6 lg:mt-8 lg:grid-cols-[1fr_1fr] lg:gap-8">
          <div className="card h-fit p-4 sm:p-6">
            {companyCard}
            <div className="relative mt-6 hidden aspect-[780/458] overflow-hidden rounded-xl lg:block"><Image src="/demo/lien-he.jpg" alt="Góc live quay mỹ phẩm có softbox HULAKO (ảnh minh họa)" fill sizes="50vw" className="object-cover" /></div>
            <ChannelButtons ch={ch} className="mt-5" />
          </div>
          <section aria-labelledby="form-title" className="lg:card lg:p-8">
            <h2 id="form-title" className="mb-4 text-[26px] font-extrabold tracking-tight sm:text-[34px]">Nhờ tư vấn góc livestream</h2>
            <LeadForm defaultTopic={sp["chu-de"]} context={context} source={source} consentText={consent.lead} />
          </section>
        </div>
      </div>
    </div>
  );
}
