// P04 Chi tiết thiết bị (ảnh 003, 076; tạm ngừng bán 070). Không tồn tại → kiểm bảng chuyển hướng (301) → 404.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { findRedirect, getProduct, listFaqs, listPublishedArticles, listSetups } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";
import { getDb, schema } from "@/lib/db";
import { ArticleRowCard, Breadcrumbs, SetupCard } from "@/components/ui";
import { VariantPicker } from "@/components/VariantPicker";
import { Tabs } from "@/components/Tabs";
import { Icon } from "@/components/site/Icon";

export const revalidate = 300;
type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const d = await getProduct(slug);
  if (!d) return { title: "Không tìm thấy thiết bị" };
  const img = d.variants[0]?.images[0];
  return {
    title: d.product.name,
    description: d.product.summary.slice(0, 160),
    alternates: { canonical: `/thiet-bi/${slug}` },
    openGraph: { title: d.product.name, description: d.product.summary, images: img ? [{ url: img.url, alt: img.alt }] : undefined },
  };
}

export default async function ProductPage({ params }: P) {
  const { slug } = await params;
  const d = await getProduct(slug);
  if (!d) {
    const to = await findRedirect(`/thiet-bi/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  const { product, category, variants } = d;
  const paused = product.status === "paused";
  const db = await getDb();
  const variantIds = variants.map((v) => v.id);
  const [setups, articleIds, faqs] = await Promise.all([
    listSetups({ pageSize: 200 }).then((r) => r.items.filter((x) => x.variantIds.some((v) => variantIds.includes(v))).slice(0, 3)),
    db.select({ id: schema.articles.id }).from(schema.articles).innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId))
      .where(sql`${schema.revisions.relatedProductIds} @> ${JSON.stringify([product.id])}::jsonb`).limit(6),
    listFaqs().then((f) => f.filter((x) => x.productId === product.id)),
  ]);
  const articles = articleIds.length ? (await listPublishedArticles({ ids: articleIds.map((a) => a.id), pageSize: 6 })).items : [];
  const body = product.body ? renderMarkdown(product.body).html : "";
  const sideImage = variants[0]?.images.find((i) => i.kind === "detail") ?? variants[0]?.images[1];

  const info = (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="text-[17px] leading-relaxed text-ink-soft sm:text-[19px]">{product.summary}</p>
        {body && <div className="prose-hlk mt-4" dangerouslySetInnerHTML={{ __html: body }} />}
        {product.useCases.length > 0 && <p className="mt-4 text-[15px] text-ink-muted">Phù hợp: {product.useCases.join(" · ")}</p>}
      </div>
      {sideImage && <div className="relative aspect-[624/300] overflow-hidden rounded-xl"><Image src={sideImage.url} alt={sideImage.alt} fill sizes="(max-width:1024px) 100vw, 480px" className="object-cover" /></div>}
    </div>
  );
  const guides = articles.length ? (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{articles.map((a) => <ArticleRowCard key={a.id} a={a} />)}</div>
  ) : <p className="text-ink-muted">Bài hướng dẫn lắp cho sản phẩm này đang được biên soạn. <Link href="/lien-he?chu-de=ho-tro-sau-mua" className="font-semibold text-brand-dark underline">Nhờ HULAKO hướng dẫn</Link>.</p>;
  const faqBlock = faqs.length ? (
    <div className="space-y-3">{faqs.map((f) => (
      <details key={f.id} className="card group open:border-brand"><summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold">{f.question}<Icon name="chevronDown" size={20} className="shrink-0 group-open:rotate-180" /></summary><p className="px-4 pb-4 whitespace-pre-line text-ink-soft">{f.answer}</p></details>
    ))}</div>
  ) : <p className="text-ink-muted">Chưa có câu hỏi cho sản phẩm này. <Link href="/ho-tro" className="font-semibold text-brand-dark underline">Xem trang Hỗ trợ</Link>.</p>;

  return (
    <div className="container-page py-5 lg:py-7">
      <Breadcrumbs className="hidden lg:block" items={[{ href: "/thiet-bi", label: "Thiết bị" }, ...(category ? [{ href: `/thiet-bi?danh_muc=${category.slug}`, label: category.name }] : []), { label: product.name }]} />
      <VariantPicker productId={product.id} productName={product.name} paused={paused} isSample={product.isSample}
        variants={variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name, status: v.status, components: v.components, specs: v.specs, images: v.images, links: v.links }))} />

      <div className="mt-10">
        <Tabs tabs={[{ label: "Thông tin", content: info }, { label: "Hướng dẫn lắp", content: guides }, { label: "Hỏi đáp", content: faqBlock }]} />
      </div>

      {setups.length > 0 && (
        <section className="mt-12"><h2 className="h-section">Góc livestream dùng thiết bị này</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{setups.map((s) => <SetupCard key={s.id} s={s} />)}</div></section>
      )}
    </div>
  );
}
