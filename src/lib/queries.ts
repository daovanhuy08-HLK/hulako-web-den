// Truy vấn dữ liệu CÔNG KHAI. Mọi hàm ở đây chỉ trả nội dung đã xuất bản / còn hiệu lực.
import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "./db";
import { isAllowedMarketUrl } from "./settings";
import { normalizeVi } from "./text";

const { articles, revisions, topics, products, variants, channelLinks, categories, setups, faqs, jobs, redirects } = schema;

export const PAGE_SIZE = 12;

// ---------- Bài viết ----------
export async function listPublishedArticles(opts: { kind?: "guide" | "news"; topicSlug?: string; page?: number; pageSize?: number; featured?: boolean; ids?: string[] } = {}) {
  const db = await getDb();
  const page = Math.max(1, opts.page ?? 1);
  const size = opts.pageSize ?? PAGE_SIZE;
  const where: SQL[] = [isNotNull(articles.publishedRevisionId)];
  if (opts.kind) where.push(eq(articles.kind, opts.kind));
  if (opts.featured) where.push(eq(articles.featured, true));
  if (opts.ids) where.push(opts.ids.length ? inArray(articles.id, opts.ids) : sql`false`);
  if (opts.topicSlug) where.push(eq(topics.slug, opts.topicSlug));
  const cond = and(...where);
  const rows = await db
    .select({
      id: articles.id, slug: articles.slug, kind: articles.kind, publishedAt: articles.publishedAt,
      contentUpdatedAt: articles.contentUpdatedAt, title: revisions.title, summary: revisions.summary,
      coverUrl: revisions.coverUrl, coverAlt: revisions.coverAlt, topicName: topics.name, topicSlug: topics.slug, isSample: articles.isSample, featured: articles.featured,
    })
    .from(articles)
    .innerJoin(revisions, eq(revisions.id, articles.publishedRevisionId))
    .leftJoin(topics, eq(topics.id, articles.topicId))
    .where(cond)
    .orderBy(desc(articles.publishedAt))
    .limit(size).offset((page - 1) * size);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(articles).leftJoin(topics, eq(topics.id, articles.topicId)).where(cond);
  return { items: rows, page, pageSize: size, total: Number(total) };
}

export async function getPublishedArticle(kind: "guide" | "news", slug: string) {
  const db = await getDb();
  const [row] = await db
    .select({ a: articles, r: revisions, topic: topics })
    .from(articles)
    .innerJoin(revisions, eq(revisions.id, articles.publishedRevisionId))
    .leftJoin(topics, eq(topics.id, articles.topicId))
    .where(and(eq(articles.kind, kind), eq(articles.slug, slug), isNotNull(articles.publishedRevisionId)));
  if (!row) return null;
  const [relatedProducts, relatedSetups, authorRow] = await Promise.all([
    row.r.relatedProductIds.length ? listProductCards({ ids: row.r.relatedProductIds }) : Promise.resolve([]),
    row.r.relatedSetupIds.length ? listSetups({ ids: row.r.relatedSetupIds }).then((x) => x.items) : Promise.resolve([]),
    row.a.authorId ? db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, row.a.authorId)) : Promise.resolve([]),
  ]);
  return { ...row, relatedProducts, relatedSetups, authorName: authorRow[0]?.name || "Đội nội dung HULAKO" };
}

export async function listTopics() {
  const db = await getDb();
  return db.select().from(topics).orderBy(asc(topics.sortOrder), asc(topics.name));
}

export async function getTopic(slug: string) {
  const db = await getDb();
  const [t] = await db.select().from(topics).where(eq(topics.slug, slug));
  return t ?? null;
}

// ---------- Thiết bị ----------
export type ProductCard = {
  id: string; slug: string; name: string; summary: string; useCases: string[]; status: string;
  categoryName: string | null; categorySlug: string | null; image: { url: string; alt: string } | null; isSample: boolean;
};

export async function listProductCards(opts: { category?: string; useCase?: string; page?: number; pageSize?: number; ids?: string[]; featured?: boolean } = {}): Promise<ProductCard[]> {
  return (await listProducts(opts)).items;
}

export async function listProducts(opts: { category?: string; useCase?: string; page?: number; pageSize?: number; ids?: string[]; featured?: boolean; q?: string } = {}) {
  const db = await getDb();
  const page = Math.max(1, opts.page ?? 1);
  const size = opts.pageSize ?? PAGE_SIZE;
  const where: SQL[] = [eq(products.status, "public")];
  if (opts.category) where.push(eq(categories.slug, opts.category));
  if (opts.useCase) where.push(sql`${products.useCases} @> ${JSON.stringify([opts.useCase])}::jsonb`);
  if (opts.ids) where.push(opts.ids.length ? inArray(products.id, opts.ids) : sql`false`);
  if (opts.featured) where.push(eq(products.featured, true));
  if (opts.q && normalizeVi(opts.q)) where.push(sql`${products.searchText} like ${"%" + normalizeVi(opts.q) + "%"}`);
  const cond = and(...where);
  const rows = await db
    .select({ p: products, c: categories })
    .from(products).leftJoin(categories, eq(categories.id, products.categoryId))
    .where(cond).orderBy(asc(products.sortOrder), asc(products.name))
    .limit(size).offset((page - 1) * size);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(products).leftJoin(categories, eq(categories.id, products.categoryId)).where(cond);
  const ids = rows.map((r) => r.p.id);
  const vs = ids.length
    ? await db.select().from(variants).where(and(inArray(variants.productId, ids), eq(variants.status, "public"))).orderBy(asc(variants.sortOrder))
    : [];
  const items: ProductCard[] = rows.map(({ p, c }) => {
    const first = vs.find((v) => v.productId === p.id && v.images.length);
    return {
      id: p.id, slug: p.slug, name: p.name, summary: p.summary, useCases: p.useCases, status: p.status,
      categoryName: c?.name ?? null, categorySlug: c?.slug ?? null, isSample: p.isSample,
      image: first ? { url: first.images[0].url, alt: first.images[0].alt } : null,
    };
  });
  return { items, page, pageSize: size, total: Number(total) };
}

export async function listCategories() {
  const db = await getDb();
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

export async function getProduct(slug: string) {
  const db = await getDb();
  const [row] = await db.select({ p: products, c: categories }).from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), inArray(products.status, ["public", "paused"])));
  if (!row) return null;
  const vs = await db.select().from(variants)
    .where(and(eq(variants.productId, row.p.id), inArray(variants.status, ["public", "paused"])))
    .orderBy(asc(variants.sortOrder));
  const links = vs.length
    ? await db.select().from(channelLinks).where(and(inArray(channelLinks.variantId, vs.map((v) => v.id)), eq(channelLinks.status, "ok")))
    : [];
  return {
    product: row.p,
    category: row.c,
    variants: vs.map((v) => ({
      ...v,
      // Chỉ trả link hợp lệ: HTTPS + tên miền sàn cho phép; sản phẩm tạm ngừng không có link mua
      links: row.p.status === "public" && v.status === "public"
        ? links.filter((l) => l.variantId === v.id && isAllowedMarketUrl(l.url)).map((l) => ({ channel: l.channel as "shopee" | "tiktok", url: l.url }))
        : [],
    })),
  };
}

// ---------- Mẫu góc live ----------
export async function listSetups(opts: { space?: string; industry?: string; style?: string; ids?: string[]; featured?: boolean; page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  const page = Math.max(1, opts.page ?? 1);
  const size = opts.pageSize ?? PAGE_SIZE;
  const where: SQL[] = [eq(setups.status, "public")];
  if (opts.space) where.push(eq(setups.space, opts.space));
  if (opts.industry) where.push(eq(setups.industry, opts.industry));
  if (opts.style) where.push(eq(setups.style, opts.style));
  if (opts.featured) where.push(eq(setups.featured, true));
  if (opts.ids) where.push(opts.ids.length ? inArray(setups.id, opts.ids) : sql`false`);
  const cond = and(...where);
  const items = await db.select().from(setups).where(cond).orderBy(desc(setups.featured), asc(setups.title)).limit(size).offset((page - 1) * size);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(setups).where(cond);
  return { items, page, pageSize: size, total: Number(total) };
}

export async function getSetup(slug: string) {
  const db = await getDb();
  const [s] = await db.select().from(setups).where(and(eq(setups.slug, slug), eq(setups.status, "public")));
  if (!s) return null;
  const vs = s.variantIds.length
    ? await db.select({ v: variants, p: products }).from(variants).innerJoin(products, eq(products.id, variants.productId))
      .where(inArray(variants.id, s.variantIds))
    : [];
  const related = s.relatedArticleIds.length ? (await listPublishedArticles({ ids: s.relatedArticleIds, pageSize: 6 })).items : [];
  return {
    setup: s,
    // Giữ tham chiếu kể cả khi sản phẩm ngừng bán, nhưng đánh dấu trạng thái để giao diện xử lý
    devices: vs.map(({ v, p }) => ({ variantId: v.id, sku: v.sku, variantName: v.name, productName: p.name, productSlug: p.slug, available: p.status === "public" && v.status === "public", image: v.images[0] ?? null })),
    related,
  };
}

// ---------- FAQ, tuyển dụng ----------
export async function listFaqs(opts: { topic?: string; device?: string; q?: string } = {}) {
  const db = await getDb();
  const where: SQL[] = [eq(faqs.status, "public")];
  if (opts.topic) where.push(eq(faqs.topic, opts.topic));
  if (opts.device) where.push(eq(faqs.deviceType, opts.device));
  const rows = await db.select().from(faqs).where(and(...where)).orderBy(asc(faqs.sortOrder));
  if (!opts.q) return rows;
  const term = normalizeVi(opts.q);
  return rows.filter((f) => normalizeVi(`${f.question} ${f.answer} ${f.deviceType}`).includes(term));
}

export async function listOpenJobs() {
  const db = await getDb();
  return db.select().from(jobs).where(and(eq(jobs.status, "open"), sql`(${jobs.deadline} is null or ${jobs.deadline} >= (now() at time zone 'Asia/Ho_Chi_Minh')::date)`)).orderBy(desc(jobs.publishedAt));
}

export async function getJob(slug: string) {
  const db = await getDb();
  const [j] = await db.select().from(jobs).where(and(eq(jobs.slug, slug), inArray(jobs.status, ["open", "closed"])));
  return j ?? null;
}

export function isJobOpen(j: { status: string; deadline: string | null }): boolean {
  if (j.status !== "open") return false;
  if (!j.deadline) return true;
  const todayVN = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  return j.deadline >= todayVN;
}

// ---------- Chuyển hướng 301 ----------
export async function findRedirect(path: string): Promise<string | null> {
  const db = await getDb();
  const [r] = await db.select().from(redirects).where(eq(redirects.fromPath, path));
  return r?.toPath ?? null;
}
