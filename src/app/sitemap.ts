// Sitemap chỉ gồm URL canonical, đã xuất bản và được phép lập chỉ mục (mục 11).
import type { MetadataRoute } from "next";
import { eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { SITE_URL } from "@/lib/settings";
import { listOpenJobs } from "@/lib/queries";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ["", "/ve-hulako", "/thiet-bi", "/goc-livestream", "/kien-thuc", "/tin-tuc", "/ho-tro", "/lien-he", "/tuyen-dung", "/chon-den"]
    .map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  try {
    const db = await getDb();
    const [arts, prods, setups, topics, jobs] = await Promise.all([
      db.select({ kind: schema.articles.kind, slug: schema.articles.slug, at: schema.articles.contentUpdatedAt }).from(schema.articles).where(isNotNull(schema.articles.publishedRevisionId)),
      db.select({ slug: schema.products.slug, at: schema.products.updatedAt }).from(schema.products).where(eq(schema.products.status, "public")),
      db.select({ slug: schema.setups.slug, at: schema.setups.updatedAt }).from(schema.setups).where(eq(schema.setups.status, "public")),
      db.select({ slug: schema.topics.slug }).from(schema.topics),
      listOpenJobs(),
    ]);
    return [
      ...statics,
      ...arts.map((a) => ({ url: `${SITE_URL}/${a.kind === "news" ? "tin-tuc" : "kien-thuc"}/${a.slug}`, lastModified: a.at ?? undefined })),
      ...prods.map((p) => ({ url: `${SITE_URL}/thiet-bi/${p.slug}`, lastModified: p.at })),
      ...setups.map((s) => ({ url: `${SITE_URL}/goc-livestream/${s.slug}`, lastModified: s.at })),
      ...topics.map((t) => ({ url: `${SITE_URL}/kien-thuc/chu-de/${t.slug}` })),
      ...jobs.map((j) => ({ url: `${SITE_URL}/tuyen-dung/${j.slug}` })),
    ];
  } catch {
    return statics;
  }
}
