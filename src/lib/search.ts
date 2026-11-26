// Tìm kiếm nội bộ (P07, GET /api/search): có dấu/không dấu, ưu tiên khớp tên/tiêu đề,
// CHỈ trả dữ liệu công khai đã xuất bản. search_text được tạo từ bản công khai lúc xuất bản.
import { and, asc, eq, ilike, inArray, isNotNull } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb, schema } from "./db";
import { normalizeVi } from "./text";

export type SearchType = "article" | "product" | "setup";
export type SearchItem = { type: SearchType; title: string; summary: string; url: string; score: number; image: string | null; imageAlt: string };

export async function search(q: string, type?: SearchType, page = 1, pageSize = 10) {
  const norm = normalizeVi(q);
  if (!norm) return { items: [] as SearchItem[], page, pageSize, total: 0 };
  const words = norm.split(" ").filter(Boolean).slice(0, 8);
  const db = await getDb();
  const like = (col: AnyPgColumn) => and(...words.map((w) => ilike(col, `%${w}%`)))!;

  const results: SearchItem[] = [];
  if (!type || type === "article") {
    const rows = await db.select({ slug: schema.articles.slug, kind: schema.articles.kind, title: schema.revisions.title, summary: schema.revisions.summary, image: schema.revisions.coverUrl, imageAlt: schema.revisions.coverAlt })
      .from(schema.articles).innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId))
      .where(and(isNotNull(schema.articles.publishedRevisionId), like(schema.articles.searchText))).limit(100);
    for (const r of rows) results.push({ type: "article", title: r.title, summary: r.summary, image: r.image, imageAlt: r.imageAlt, url: `/${r.kind === "news" ? "tin-tuc" : "kien-thuc"}/${r.slug}`, score: 0 });
  }
  if (!type || type === "product") {
    const rows = await db.select({ id: schema.products.id, slug: schema.products.slug, title: schema.products.name, summary: schema.products.summary })
      .from(schema.products).where(and(eq(schema.products.status, "public"), like(schema.products.searchText))).limit(100);
    const vs = rows.length ? await db.select({ productId: schema.variants.productId, images: schema.variants.images }).from(schema.variants)
      .where(and(inArray(schema.variants.productId, rows.map((r) => r.id)), eq(schema.variants.status, "public"))).orderBy(asc(schema.variants.sortOrder)) : [];
    for (const r of rows) {
      const im = vs.find((v) => v.productId === r.id && v.images.length)?.images[0];
      results.push({ type: "product", title: r.title, summary: r.summary, image: im?.url ?? null, imageAlt: im?.alt ?? "", url: `/thiet-bi/${r.slug}`, score: 0 });
    }
  }
  if (!type || type === "setup") {
    const rows = await db.select({ slug: schema.setups.slug, title: schema.setups.title, summary: schema.setups.summary, image: schema.setups.coverUrl, imageAlt: schema.setups.coverAlt })
      .from(schema.setups).where(and(eq(schema.setups.status, "public"), like(schema.setups.searchText))).limit(100);
    for (const r of rows) results.push({ type: "setup", title: r.title, summary: r.summary, image: r.image, imageAlt: r.imageAlt, url: `/goc-livestream/${r.slug}`, score: 0 });
  }
  for (const r of results) {
    const t = normalizeVi(r.title);
    r.score = (t.includes(norm) ? 10 : 0) + words.filter((w) => t.includes(w)).length * 2 + (t.startsWith(words[0]) ? 1 : 0);
  }
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "vi"));
  const start = (page - 1) * pageSize;
  return { items: results.slice(start, start + pageSize), page, pageSize, total: results.length };
}

/** Tạo search_text cho từng loại (bỏ dấu, viết thường) */
export const buildSearchText = (...parts: (string | null | undefined | string[])[]) =>
  normalizeVi(parts.flat().filter(Boolean).join(" "));

