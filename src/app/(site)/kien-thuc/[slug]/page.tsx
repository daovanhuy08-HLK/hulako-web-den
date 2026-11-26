import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { findRedirect, getPublishedArticle } from "@/lib/queries";
import { ArticleView } from "@/components/ArticleView";

export const revalidate = 300;
type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublishedArticle("guide", slug);
  if (!d) return { title: "Không tìm thấy bài viết" };
  return {
    title: { absolute: d.r.seoTitle || d.r.title },
    description: d.r.seoDescription || d.r.summary,
    alternates: { canonical: `/kien-thuc/${slug}` },
    openGraph: { type: "article", title: d.r.seoTitle || d.r.title, description: d.r.seoDescription || d.r.summary, images: d.r.coverUrl ? [{ url: d.r.coverUrl, alt: d.r.coverAlt }] : undefined, publishedTime: d.a.publishedAt?.toISOString() },
  };
}

export default async function GuidePage({ params }: P) {
  const { slug } = await params;
  const d = await getPublishedArticle("guide", slug);
  if (!d) {
    const to = await findRedirect(`/kien-thuc/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  return <ArticleView d={d} base="/kien-thuc" baseLabel="Kiến thức" />;
}
