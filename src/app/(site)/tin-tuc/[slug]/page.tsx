import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { findRedirect, getPublishedArticle } from "@/lib/queries";
import { ArticleView } from "@/components/ArticleView";

export const revalidate = 300;
type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublishedArticle("news", slug);
  if (!d) return { title: "Không tìm thấy tin" };
  return {
    title: { absolute: d.r.seoTitle || d.r.title },
    description: d.r.seoDescription || d.r.summary,
    alternates: { canonical: `/tin-tuc/${slug}` },
    openGraph: { type: "article", images: d.r.coverUrl ? [{ url: d.r.coverUrl, alt: d.r.coverAlt }] : undefined },
  };
}

export default async function NewsPage({ params }: P) {
  const { slug } = await params;
  const d = await getPublishedArticle("news", slug);
  if (!d) {
    const to = await findRedirect(`/tin-tuc/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  return <ArticleView d={d} base="/tin-tuc" baseLabel="Tin tức" />;
}
