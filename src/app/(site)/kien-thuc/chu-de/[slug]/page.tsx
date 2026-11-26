// Trang cụm chủ đề (P07 /kien-thuc/chu-de/[slug]) có giới thiệu riêng
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTopic, listPublishedArticles, listTopics } from "@/lib/queries";
import { ArticleCard, Breadcrumbs, ConsultCta, EmptyState, Pagination } from "@/components/ui";

export const revalidate = 300;
type P = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTopic(slug);
  const sp = await searchParams;
  if (!t) return { title: "Không tìm thấy chủ đề" };
  return { title: t.name, description: t.intro.slice(0, 160), alternates: { canonical: `/kien-thuc/chu-de/${slug}` }, robots: sp.page ? { index: false, follow: true } : undefined };
}

export default async function TopicPage({ params, searchParams }: P) {
  const { slug } = await params;
  const t = await getTopic(slug);
  if (!t) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [data, topics] = await Promise.all([listPublishedArticles({ kind: "guide", topicSlug: slug, page, pageSize: 9 }), listTopics().then((ts) => ts.filter((x) => !x.slug.startsWith("tin-")))]);
  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs items={[{ href: "/kien-thuc", label: "Kiến thức" }, { label: t.name }]} />
      <h1 className="h-page">{t.name}</h1>
      <span className="accent-bar mt-4" />
      <p className="mt-4 max-w-3xl text-[18px] leading-relaxed text-ink-soft">{t.intro}</p>
      <ul className="mt-6 flex flex-wrap gap-3" aria-label="Cụm chủ đề khác">
        {topics.map((x) => <li key={x.id}><Link href={`/kien-thuc/chu-de/${x.slug}`} aria-current={x.slug === slug ? "page" : undefined} className={`chip ${x.slug === slug ? "chip-active" : ""}`}>{x.name}</Link></li>)}
      </ul>
      {data.items.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((a) => <ArticleCard key={a.id} a={a} cta="Xem bài viết" />)}</div>
        : <div className="mt-8"><EmptyState title="Chủ đề đang được biên soạn">Trong lúc chờ, bạn có thể <Link href="/lien-he?chu-de=tu-van-chon-den" className="font-semibold text-brand-dark underline">nhờ HULAKO tư vấn</Link>.</EmptyState></div>}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} makeHref={(p) => `/kien-thuc/chu-de/${slug}?page=${p}`} />
      <div className="mt-12"><ConsultCta /></div>
    </div>
  );
}
