// P07 Trung tâm kiến thức (ảnh 006, 079): tìm bài, chọn cụm chủ đề, bài nổi bật của cụm, bài viết mới.
// Tin hoạt động HULAKO tách riêng ở /tin-tuc (đặc tả phần 14).
import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedArticles, listTopics } from "@/lib/queries";
import { ArticleRowCard, Cover, EmptyState, Pagination, SearchBox, articleHref } from "@/components/ui";
import { Icon } from "@/components/site/Icon";

type SP = Promise<Record<string, string | string[] | undefined>>;
export const revalidate = 300;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: "Kiến thức livestream: setup ánh sáng, chọn đèn, xử lý hình tối",
    description: "Hướng dẫn, kinh nghiệm và gợi ý setup ánh sáng livestream từ HULAKO: đặt đèn cho phòng nhỏ, ánh sáng khi bán quần áo, chọn và lắp softbox.",
    alternates: { canonical: "/kien-thuc" },
    robots: Object.keys(sp).length ? { index: false, follow: true } : undefined,
  };
}

export default async function KnowledgePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const topics = (await listTopics()).filter((t) => !t.slug.startsWith("tin-")); // cụm "tin-*" dành cho Tin tức
  const current = topics.find((t) => t.slug === sp.chu_de) ?? topics[0];
  const [inTopic, latest, all, topicCovers] = await Promise.all([
    current ? listPublishedArticles({ kind: "guide", topicSlug: current.slug, pageSize: 6 }).then((r) => r.items) : Promise.resolve([]),
    listPublishedArticles({ kind: "guide", pageSize: 8 }).then((r) => r.items),
    page > 1 ? listPublishedArticles({ kind: "guide", page, pageSize: 12 }) : listPublishedArticles({ kind: "guide", page: 1, pageSize: 12 }),
    Promise.all(topics.map((t) => listPublishedArticles({ kind: "guide", topicSlug: t.slug, pageSize: 1 }).then((r) => r.items[0] ?? null))),
  ]);
  const featured = inTopic.find((a) => a.featured) ?? inTopic[0] ?? latest[0];
  const others = [...inTopic, ...latest].filter((a, i, arr) => a.id !== featured?.id && arr.findIndex((x) => x.id === a.id) === i);
  const side = [...others.filter((a) => a.featured), ...others.filter((a) => !a.featured)].slice(0, 2);
  const shown = new Set([featured?.id, ...side.map((s) => s.id)]);
  const fresh = latest.filter((a) => !shown.has(a.id)).slice(0, 4);

  return (
    <div className="container-page py-6 lg:py-9">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="h-page">Kiến thức livestream</h1>
          <p className="mt-2 hidden text-[20px] text-ink-muted sm:block">Hướng dẫn, kinh nghiệm và gợi ý setup ánh sáng livestream từ HULAKO.</p>
        </div>
        <div className="lg:mt-3 lg:w-[556px]"><SearchBox action="/tim-kiem" placeholder="Tìm bài hướng dẫn" extra={{ type: "article" }} /></div>
      </div>

      {topics.length > 0 && (
        <>
          {/* Điện thoại: 3 thẻ cụm có ảnh (ảnh 006) */}
          <ul className="mt-5 grid grid-cols-3 gap-2.5 sm:hidden">
            {topics.slice(0, 3).map((t, i) => (
              <li key={t.id}>
                <Link href={`/kien-thuc/chu-de/${t.slug}`} className="card block overflow-hidden">
                  <Cover src={topicCovers[i]?.coverUrl} alt="" ratio="aspect-[4/3]" sizes="33vw" />
                  <span className="flex items-center justify-between gap-1 px-2 py-2 text-[12.5px] font-semibold leading-tight">{t.name}<Icon name="chevron" size={14} className="shrink-0 text-brand" /></span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Máy tính: pill cụm (ảnh 079) */}
          <ul className="mt-6 hidden flex-wrap gap-3 sm:flex" aria-label="Cụm chủ đề">
            {topics.map((t) => (
              <li key={t.id}><Link href={`/kien-thuc?chu_de=${t.slug}`} scroll={false} aria-current={t.id === current?.id ? "true" : undefined}
                className={`chip !min-h-[46px] !px-6 !text-[17px] ${t.id === current?.id ? "chip-active" : ""}`}>{t.name}</Link></li>
            ))}
          </ul>
        </>
      )}

      {featured ? (
        <div className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-[1.9fr_1fr]">
          <article className="card group relative grid overflow-hidden sm:grid-cols-[1.37fr_1fr]">
            <Cover src={featured.coverUrl} alt={featured.coverAlt || featured.title} priority ratio="aspect-[16/10] sm:aspect-auto sm:h-full" sizes="(max-width:1024px) 100vw, 640px" />
            <div className="flex flex-col justify-center p-5 sm:p-7">
              <h2 className="text-[22px] font-extrabold leading-tight sm:text-[32px]"><Link href={articleHref(featured)} className="after:absolute after:inset-0 hover:text-brand-dark">{featured.title}</Link></h2>
              <p className="mt-4 hidden text-[17px] leading-relaxed text-ink-muted sm:block">{featured.summary}</p>
              <span className="btn-primary mt-6 hidden w-fit sm:inline-flex">Xem bài viết <Icon name="arrow" size={20} /></span>
            </div>
            <span aria-hidden className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white sm:hidden"><Icon name="chevron" size={20} stroke={2.4} /></span>
          </article>
          <div className="hidden gap-5 lg:grid">
            {side.map((a) => (
              <Link key={a.id} href={articleHref(a)} className="card group flex gap-4 p-3 hover:border-brand">
                <div className="w-[48%] shrink-0 overflow-hidden rounded-lg"><Cover src={a.coverUrl} alt="" ratio="aspect-[230/145]" sizes="240px" /></div>
                <div className="py-2 pr-2"><h3 className="text-[21px] font-bold leading-snug group-hover:text-brand-dark">{a.title}</h3><p className="mt-2 line-clamp-3 text-[15.5px] text-ink-muted">{a.summary}</p></div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8"><EmptyState title="Chưa có bài viết">Đội nội dung đang chuẩn bị bài hướng dẫn đầu tiên.</EmptyState></div>
      )}

      {fresh.length > 0 && (
        <section className="mt-10" aria-labelledby="bai-moi">
          <h2 id="bai-moi" className="flex items-center gap-3 text-[24px] font-extrabold sm:text-[32px]"><span aria-hidden className="h-7 w-1 rounded bg-brand sm:hidden" /><span className="sm:hidden">Bài mới</span><span className="hidden sm:inline">Bài viết mới</span></h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fresh.map((a) => <ArticleRowCard key={a.id} a={a} />)}</div>
        </section>
      )}

      {all.total > 6 && (
        <section className="mt-12" aria-labelledby="tat-ca">
          <h2 id="tat-ca" className="h-section">Tất cả bài hướng dẫn</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{all.items.map((a) => <ArticleRowCard key={a.id} a={a} />)}</div>
          <Pagination page={all.page} pageSize={all.pageSize} total={all.total} makeHref={(p) => `/kien-thuc?page=${p}`} />
        </section>
      )}

      <Link href="/tin-tuc" className="card mt-10 flex items-center justify-between gap-3 p-5 hover:border-brand">
        <span><span className="block text-[20px] font-bold">Tin tức HULAKO</span><span className="text-ink-muted">Hoạt động công ty, sản phẩm mới và thông báo cập nhật tài liệu.</span></span>
        <Icon name="arrow" size={24} className="shrink-0 text-brand" />
      </Link>
    </div>
  );
}
