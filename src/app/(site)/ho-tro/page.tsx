// P09 Hỏi đáp và hỗ trợ (ảnh 012, 082) — lọc theo nhóm (lắp đặt, ánh sáng, chân đỡ…), loại thiết bị hoặc mã sản phẩm;
// câu trả lời có bước làm + bài chi tiết + lối vào hỗ trợ theo nơi mua.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listFaqs } from "@/lib/queries";
import { DEVICE_TYPES, FAQ_TOPICS, pick } from "@/lib/catalog";
import { EmptyState, JsonLd } from "@/components/ui";
import { Icon, type IconName } from "@/components/site/Icon";

type SP = Promise<Record<string, string | string[] | undefined>>;
export const revalidate = 300;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: "Hỏi đáp và hỗ trợ: lắp đèn, ánh sáng, chân đỡ",
    description: "Câu hỏi thường gặp khi lắp softbox, kéo chân đèn, xử lý hình live bị tối và hỗ trợ sau mua theo nơi bạn mua hàng.",
    alternates: { canonical: "/ho-tro" }, robots: Object.keys(sp).length ? { index: false, follow: true } : undefined,
  };
}

const TOPIC_ICON: Record<string, IconName> = { "lap-dat": "tools", "anh-sang": "sun", "chan-do": "tripod", "mua-hang": "bag" };

export default async function SupportPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const topic = pick(sp.chu_de, FAQ_TOPICS), device = pick(sp.thiet_bi, DEVICE_TYPES);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const faqs = await listFaqs({ topic, device, q });
  const href = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ chu_de: topic, thiet_bi: device, q, ...p }).filter(([, v]) => v) as [string, string][]).toString();
    return s ? `/ho-tro?${s}` : "/ho-tro";
  };

  return (
    <div>
      {!topic && !device && !q && faqs.length > 0 && (
        <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.slice(0, 30).map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }} />
      )}
      {/* Banner (ảnh 082): tiêu đề + ô tìm bên trái, ảnh góc live bên phải */}
      <section className="relative overflow-hidden lg:min-h-[346px]">
        <div className="absolute inset-y-0 right-0 hidden w-[62%] lg:block">
          <Image src="/demo/ho-tro-banner.jpg" alt="" fill priority sizes="62vw" className="object-cover" />
          <div aria-hidden className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-paper to-transparent" />
        </div>
        <div className="container-page relative py-7 lg:py-24">
          <h1 className="text-[36px] font-extrabold tracking-tight sm:text-[46px] lg:text-[58px]">Hỏi đáp và hỗ trợ</h1>
          <form role="search" className="relative mt-5 max-w-[556px] lg:mt-7">
            <label htmlFor="q-faq" className="sr-only">Tìm câu hỏi hoặc mã sản phẩm</label>
            <Icon name="search" size={24} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input id="q-faq" name="q" type="search" defaultValue={q} className="input !min-h-[58px] !rounded-xl pl-14 text-[17px] lg:text-[19px]" placeholder="Tìm câu hỏi hoặc mã sản phẩm" />
            {topic && <input type="hidden" name="chu_de" value={topic} />}
          </form>
        </div>
      </section>

      <div className="container-page">
        {/* Điện thoại: pill nhóm (ảnh 012) */}
        <ul className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Nhóm câu hỏi">
          {FAQ_TOPICS.map((t) => <li key={t.value}><Link href={href({ chu_de: topic === t.value ? undefined : t.value })} className={`chip whitespace-nowrap ${topic === t.value ? "chip-active" : ""}`}>{t.label}</Link></li>)}
        </ul>

        <div className="mt-5 grid gap-6 lg:mt-12 lg:grid-cols-[334px_1fr_386px] lg:gap-8">
          <nav aria-label="Nhóm câu hỏi" className="hidden lg:block">
            <ul className="card overflow-hidden p-3">
              {FAQ_TOPICS.map((t, i) => {
                const on = topic === t.value;
                return (
                  <li key={t.value} className={i ? "border-t border-line" : ""}>
                    <Link href={href({ chu_de: on ? undefined : t.value })} aria-current={on ? "true" : undefined}
                      className={`relative flex min-h-[72px] items-center gap-4 rounded-lg px-4 text-[21px] font-medium ${on ? "bg-brand-tint font-semibold text-brand" : "hover:bg-paper"}`}>
                      {on && <span aria-hidden className="absolute -left-3 inset-y-0 w-1 rounded bg-brand" />}
                      <Icon name={TOPIC_ICON[t.value] ?? "chat"} size={32} className={on ? "text-brand" : "text-ink"} />
                      <span className="flex-1">{t.label}</span><Icon name="chevron" size={20} />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Loại thiết bị</p>
            <ul className="flex flex-wrap gap-2">
              {DEVICE_TYPES.map((d) => <li key={d.value}><Link href={href({ thiet_bi: device === d.value ? undefined : d.value })} className={`chip !min-h-[38px] !px-4 !text-sm ${device === d.value ? "chip-active" : ""}`}>{d.label}</Link></li>)}
            </ul>
          </nav>

          <div aria-live="polite">
            {(topic || device || q) && (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-[15px] text-ink-muted">{faqs.length} câu hỏi{q ? ` cho “${q}”` : ""}<Link href="/ho-tro" className="font-semibold text-brand-dark underline">Xoá lọc</Link></p>
            )}
            {faqs.length ? (
              <div className="space-y-4">
                {faqs.map((f, i) => (
                  <details key={f.id} open={i === 0} className="card group overflow-hidden open:border-brand">
                    <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[18px] font-bold sm:px-7 sm:text-[22px]">
                      {f.question}<Icon name="chevronDown" size={24} className="shrink-0 transition group-open:rotate-180 group-open:text-brand" />
                    </summary>
                    <div className="mx-2 mb-2 rounded-lg bg-paper px-4 py-4 sm:px-5">
                      <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink-soft sm:text-[18px]">{f.answer}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
                        {f.articleSlug && <Link href={`/kien-thuc/${f.articleSlug}`} className="inline-flex items-center gap-1 font-semibold text-brand-dark hover:underline">Xem bài hướng dẫn chi tiết <Icon name="arrow" size={16} /></Link>}
                        <Link href={`/lien-he?chu-de=ho-tro-sau-mua&cau-hoi=${encodeURIComponent(f.question)}`} className="font-semibold underline">Vẫn chưa được? Gửi câu hỏi</Link>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có câu trả lời phù hợp" icon="chat">
                <p>Thử từ khoá khác hoặc <Link href="/lien-he?chu-de=ho-tro-sau-mua" className="font-semibold text-brand-dark underline">gửi câu hỏi kèm mã sản phẩm</Link> để HULAKO hỗ trợ.</p>
              </EmptyState>
            )}

            <section className="card mt-8 p-5 sm:p-6">
              <h2 className="text-[20px] font-bold">Hỗ trợ theo nơi mua</h2>
              <ul className="mt-3 space-y-2 text-[16px] text-ink-soft">
                <li className="flex gap-2.5"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />Mua trên Shopee hoặc TikTok Shop: đổi trả theo chính sách của sàn nơi bạn mua. Nhắn gian hàng HULAKO trên sàn kèm mã đơn.</li>
                <li className="flex gap-2.5"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span>Cần hướng dẫn lắp đặt, chỉnh đèn: <Link href="/lien-he?chu-de=ho-tro-sau-mua" className="font-semibold text-brand-dark underline">gửi câu hỏi kèm sản phẩm và kênh mua</Link>.</span></li>
              </ul>
            </section>
          </div>

          <aside className="card relative h-fit overflow-hidden p-5">
            <div className="relative hidden aspect-[341/161] overflow-hidden rounded-xl lg:block"><Image src="/demo/ho-tro-side.jpg" alt="" fill sizes="340px" className="object-cover" /></div>
            <div className="absolute inset-y-0 right-0 w-1/2 lg:hidden"><Image src="/demo/ho-tro-side.jpg" alt="" fill sizes="50vw" className="object-cover" /><div aria-hidden className="absolute inset-0 bg-gradient-to-r from-white to-transparent" /></div>
            <div className="relative max-w-[60%] lg:max-w-none">
              <Icon name="chat" size={34} className="text-brand lg:hidden" />
              <h2 className="mt-2 text-[24px] font-extrabold leading-tight lg:mt-4">Bạn cần hướng dẫn thêm?</h2>
              <p className="mt-2 hidden text-[17px] text-ink-muted lg:block">Gửi câu hỏi để HULAKO hỗ trợ bạn nhanh chóng và chi tiết.</p>
              <Link href="/lien-he?chu-de=ho-tro-sau-mua" className="btn-primary mt-5 lg:w-full lg:!min-h-[58px] lg:!text-[20px]"><Icon name="send" size={22} className="hidden lg:block" />Gửi câu hỏi<Icon name="chevron" size={18} className="lg:hidden" /></Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
