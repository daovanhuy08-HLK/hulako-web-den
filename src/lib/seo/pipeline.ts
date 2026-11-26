// AI SEO Agent (mục 10) + Vòng phản hồi (feedback loop).
//
//   Search Console / CSV / FAQ ──► gom từ khoá ──► chấm điểm cơ hội ──► brief + bản nháp (AI)
//        ▲                                                                     │
//        │                                                       người duyệt xuất bản
//        │                                                                     ▼
//   đo hiển thị, nhấp, CTR, vị trí + lượt bấm sang sàn, tư vấn ◄──────── bài trên website
//        │
//        └──► (1) cụm chủ đề nào ra chuyển đổi → tăng điểm ưu tiên cụm đó
//             (2) bài nào hiển thị nhiều/nhấp ít, rơi top → đề xuất cập nhật
//             (3) bộ hướng dẫn viết nào cho kết quả tốt → AI đề xuất phiên bản hướng dẫn mới
//
// AI chỉ tạo ĐỀ XUẤT và BẢN NHÁP. Xuất bản luôn đi qua tài khoản người duyệt.
import { and, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db";
import { generateStructured, type AiUsage } from "../ai/claude";
import { BRAND_SYSTEM, dataBlock, getActivePrompt } from "../ai/prompts";
import { checkClaims } from "../guardrails";
import { normalizeVi, slugify } from "../text";
import { expectedCtr, pagePerformance, queryPageAggregates } from "./metrics";
import { getSetting } from "../settings";
import { promptPerformance } from "./learning";

export type StepResult = { result: Record<string, unknown>; usage?: AiUsage; needsReview?: boolean };

const CORE_TERMS = ["den", "softbox", "livestream", "live", "chan den", "anh sang", "setup", "quay", "tripod", "goc live", "tan sang", "den led", "den vong"];
export const LAUNCH_CLUSTERS = ["setup-phong-nho", "anh-sang-ban-quan-ao", "chon-va-lap-softbox"];

function articlePath(a: { kind: string; slug: string }) {
  return `/${a.kind === "news" ? "tin-tuc" : "kien-thuc"}/${a.slug}`;
}

// ───────────── 1. Gom từ khoá từ Search Console ─────────────
export async function harvestKeywords(): Promise<StepResult> {
  const db = await getDb();
  const rows = await queryPageAggregates(28);
  const published = await db.select({ id: schema.articles.id, kind: schema.articles.kind, slug: schema.articles.slug })
    .from(schema.articles).where(isNotNull(schema.articles.publishedRevisionId));
  const byPath = new Map(published.map((a) => [articlePath(a), a.id]));

  // Gộp biến thể cùng ý định bằng dạng chuẩn hoá (bỏ dấu, thường) — giữ truy vấn gốc để tra cứu
  const agg = new Map<string, { query: string; variants: Set<string>; impressions: number; clicks: number; posW: number; topPage: string; topImpr: number }>();
  for (const r of rows) {
    const n = normalizeVi(r.query);
    if (!n) continue;
    const a = agg.get(n) ?? { query: r.query, variants: new Set<string>(), impressions: 0, clicks: 0, posW: 0, topPage: r.page, topImpr: 0 };
    a.variants.add(r.query);
    a.impressions += Number(r.impressions); a.clicks += Number(r.clicks); a.posW += Number(r.pos) * Number(r.impressions);
    if (Number(r.impressions) > a.topImpr) { a.topImpr = Number(r.impressions); a.topPage = r.page; }
    agg.set(n, a);
  }
  let upserts = 0;
  for (const [normalized, a] of agg) {
    const values = {
      query: a.query, normalized, variantsSeen: [...a.variants].slice(0, 20), source: "gsc", collectedAt: new Date(),
      impressions: a.impressions, clicks: a.clicks, position: a.impressions ? a.posW / a.impressions : null,
      targetArticleId: byPath.get(a.topPage) ?? null,
    };
    await db.insert(schema.keywords).values(values).onConflictDoUpdate({
      target: schema.keywords.normalized,
      set: { impressions: values.impressions, clicks: values.clicks, position: values.position, variantsSeen: values.variantsSeen, collectedAt: values.collectedAt, targetArticleId: values.targetArticleId },
    });
    upserts++;
  }
  return { result: { keywords: upserts, sourceRows: rows.length } };
}

// ───────────── 2. AI đề xuất từ khoá mới ─────────────
const SuggestSchema = z.object({
  keywords: z.array(z.object({
    query: z.string().describe("Truy vấn tiếng Việt có dấu như người dùng gõ trên Google"),
    cluster: z.string().describe("slug cụm chủ đề, ví dụ setup-phong-nho"),
    intent: z.enum(["rong", "sau", "san-pham", "xu-ly-loi", "xu-huong"]),
    reason: z.string().describe("Vì sao đáng viết, dựa trên dữ liệu được cung cấp"),
  })).max(30),
});

export async function suggestKeywords(): Promise<StepResult> {
  const db = await getDb();
  const [topics, existing, faqs, topConverting] = await Promise.all([
    db.select({ slug: schema.topics.slug, name: schema.topics.name }).from(schema.topics),
    db.select({ q: schema.keywords.query, impr: schema.keywords.impressions }).from(schema.keywords).orderBy(desc(schema.keywords.impressions)).limit(120),
    db.select({ q: schema.faqs.question }).from(schema.faqs).limit(60),
    clusterConversion(),
  ]);
  const { data, usage } = await generateStructured({
    schema: SuggestSchema,
    effort: "low",
    maxTokens: 8000,
    system: BRAND_SYSTEM,
    user: [
      "Nhiệm vụ: đề xuất tối đa 25 truy vấn tìm kiếm MỚI (chưa có trong danh sách hiện có) mà khách mục tiêu của HULAKO thật sự gõ trên Google tại Việt Nam, ưu tiên ý định xử lý lỗi và hướng dẫn setup cụ thể.",
      "Không bịa lượng tìm kiếm. Đây là giả thuyết để đội SEO kiểm chứng.",
      dataBlock("cum_chu_de", topics),
      dataBlock("cum_ra_mat_uu_tien", LAUNCH_CLUSTERS),
      dataBlock("tu_khoa_hien_co", existing.map((e) => e.q)),
      dataBlock("cau_hoi_doi_tu_van_tong_hop", faqs.map((f) => f.q)),
      dataBlock("cum_co_chuyen_doi_tot", topConverting.slice(0, 5)),
    ].join("\n\n"),
  });
  let added = 0;
  for (const k of data.keywords) {
    const normalized = normalizeVi(k.query);
    if (!normalized) continue;
    const res = await db.insert(schema.keywords).values({
      query: k.query.trim(), normalized, cluster: slugify(k.cluster), intent: k.intent, source: "ai_suggest", variantsSeen: [k.query],
    }).onConflictDoNothing({ target: schema.keywords.normalized }).returning({ id: schema.keywords.id });
    added += res.length;
  }
  return { result: { suggested: data.keywords.length, added }, usage };
}

/** Nhập từ khoá từ CSV: query,search_volume,trend_score,cluster,intent (cột thiếu để trống → lưu null) */
export async function importKeywordsCsv(csv: string): Promise<number> {
  const db = await getDb();
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines[0]?.toLowerCase().includes("query")) lines.shift();
  let n = 0;
  for (const line of lines.slice(0, 5000)) {
    const [query, vol, trend, cluster, intent] = line.split(",").map((s) => s?.trim() ?? "");
    const normalized = normalizeVi(query);
    if (!normalized) continue;
    const num = (s: string) => (s === "" || isNaN(Number(s)) ? null : Number(s));
    await db.insert(schema.keywords).values({
      query, normalized, source: "csv", searchVolume: num(vol), trendScore: num(trend), cluster: slugify(cluster ?? ""), intent: intent ?? "", variantsSeen: [query],
    }).onConflictDoUpdate({ target: schema.keywords.normalized, set: { searchVolume: num(vol), trendScore: num(trend), collectedAt: new Date() } });
    n++;
  }
  return n;
}

// ───────────── Học từ chuyển đổi: cụm nào kéo khách sang sàn / tư vấn ─────────────
export async function clusterConversion(): Promise<{ cluster: string; views: number; conversions: number; rate: number }[]> {
  const db = await getDb();
  const perf = await pagePerformance(56);
  const arts = await db.select({ kind: schema.articles.kind, slug: schema.articles.slug, topic: schema.topics.slug })
    .from(schema.articles).leftJoin(schema.topics, eq(schema.topics.id, schema.articles.topicId))
    .where(isNotNull(schema.articles.publishedRevisionId));
  const by = new Map<string, { views: number; conversions: number }>();
  for (const a of arts) {
    const p = perf.get(articlePath(a));
    if (!p || !a.topic) continue;
    const c = by.get(a.topic) ?? { views: 0, conversions: 0 };
    c.views += p.views; c.conversions += p.marketplaceClicks + p.consultClicks + p.leads;
    by.set(a.topic, c);
  }
  return [...by].map(([cluster, c]) => ({ cluster, ...c, rate: c.views ? c.conversions / c.views : 0 }))
    .sort((a, b) => b.rate - a.rate);
}

// ───────────── 3. Chấm điểm cơ hội ─────────────
export async function scoreOpportunities(): Promise<StepResult> {
  const db = await getDb();
  const [kws, perf, conv, published, qp] = await Promise.all([
    db.select().from(schema.keywords).where(sql`${schema.keywords.status} <> 'skipped'`),
    pagePerformance(28),
    clusterConversion(),
    db.select({ id: schema.articles.id, kind: schema.articles.kind, slug: schema.articles.slug, title: schema.revisions.title, topicId: schema.articles.topicId })
      .from(schema.articles).innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId)),
    queryPageAggregates(28),
  ]);
  const convRate = new Map(conv.map((c) => [c.cluster, c.rate]));
  const W = await getSetting("scoringWeights"); // trọng số do vòng học điều chỉnh (mặc định 1)
  const maxRate = Math.max(0.0001, ...conv.map((c) => c.rate));
  const fmt = (v: number | null | undefined, unit = "") => (v == null ? "Chưa có dữ liệu" : `${Math.round(v * 100) / 100}${unit}`);
  let created = 0;

  const upsert = async (o: { type: string; dedupeKey: string; title: string; score: number; rationale: string; evidence: Record<string, unknown>; keywordIds?: string[]; targetArticleId?: string | null; competingUrls?: string[]; factors?: Record<string, number> }) => {
    const res = await db.insert(schema.opportunities).values({ ...o, keywordIds: o.keywordIds ?? [], competingUrls: o.competingUrls ?? [], factors: o.factors ?? {} })
      .onConflictDoUpdate({
        target: schema.opportunities.dedupeKey,
        set: { score: o.score, rationale: o.rationale, evidence: o.evidence, factors: o.factors ?? {} },
        setWhere: eq(schema.opportunities.status, "open"),
      }).returning({ id: schema.opportunities.id });
    created += res.length;
  };

  // (a) Bài đang có: hiển thị nhiều mà ít nhấp → sửa title/meta; vị trí 5–20 → cập nhật nội dung
  for (const a of published) {
    const p = perf.get(articlePath(a));
    if (!p || p.impressions < 50 || p.position == null) continue;
    const exp = expectedCtr(p.position);
    if (p.ctr < exp * 0.6) {
      await upsert({
        type: "ctr_fix", dedupeKey: `ctr_fix:${a.id}`, targetArticleId: a.id, title: `Viết lại tiêu đề/mô tả: ${a.title}`,
        score: Math.min(100, 40 + Math.log10(p.impressions + 1) * 15 + (exp - p.ctr) * 200),
        rationale: `Bài có ${p.impressions} lượt hiển thị, CTR ${fmt(p.ctr * 100, "%")} thấp hơn mức kỳ vọng ~${fmt(exp * 100, "%")} ở vị trí trung bình ${fmt(p.position)}.`,
        evidence: { ...p, expectedCtr: exp },
      });
    }
    if (p.position >= 5 && p.position <= 20) {
      await upsert({
        type: "update", dedupeKey: `update:${a.id}`, targetArticleId: a.id, title: `Cập nhật, mở rộng: ${a.title}`,
        score: Math.min(100, 35 + Math.log10(p.impressions + 1) * 15 + (20 - p.position)),
        rationale: `Vị trí trung bình ${fmt(p.position)} (trang 1–2), ${p.impressions} hiển thị. Bổ sung bước làm, ảnh thật, câu hỏi khách đang tìm có thể đẩy lên top.`,
        evidence: { ...p },
      });
    }
  }

  // (b) Hai trang cạnh tranh cùng ý định → đề xuất gộp (biên tập viên quyết)
  const byQuery = new Map<string, { page: string; impressions: number; pos: number }[]>();
  for (const r of qp) {
    const n = normalizeVi(r.query);
    byQuery.set(n, [...(byQuery.get(n) ?? []), { page: r.page, impressions: Number(r.impressions), pos: Number(r.pos) }]);
  }
  for (const [n, pages] of byQuery) {
    const real = pages.filter((p) => p.impressions >= 20 && /^\/(kien-thuc|tin-tuc)\//.test(p.page));
    if (real.length < 2) continue;
    await upsert({
      type: "merge", dedupeKey: `merge:${n}`, title: `Hai trang cạnh tranh truy vấn "${n}"`,
      score: Math.min(100, 30 + Math.log10(real.reduce((s, p) => s + p.impressions, 0) + 1) * 15),
      rationale: "Nhiều bài cùng nhận hiển thị cho một ý định. Cân nhắc gộp nội dung và chuyển hướng 301 sau khi người duyệt xác nhận.",
      evidence: { query: n, pages: real }, competingUrls: real.map((p) => p.page),
    });
  }

  // (c) Từ khoá chưa có trang mục tiêu → viết mới (bỏ qua nếu đã có bài nhắm đúng từ khoá này, kể cả bản nháp)
  const covered = new Map((await db.select({ id: schema.articles.id, kw: schema.articles.targetKeyword }).from(schema.articles))
    .filter((a) => a.kw).map((a) => [normalizeVi(a.kw), a.id]));
  for (const k of kws) {
    if (k.targetArticleId) continue;
    if (covered.has(k.normalized)) {
      await db.update(schema.keywords).set({ targetArticleId: covered.get(k.normalized)! }).where(eq(schema.keywords.id, k.id));
      await db.update(schema.opportunities).set({ status: "dismissed" }).where(and(eq(schema.opportunities.dedupeKey, `new:${k.normalized}`), eq(schema.opportunities.status, "open")));
      continue;
    }
    const norm = k.normalized;
    const brandFit = CORE_TERMS.some((t) => norm.includes(t)) ? 30 : LAUNCH_CLUSTERS.includes(k.cluster) ? 25 : 8;
    const demand = k.impressions != null ? Math.min(30, Math.log10(k.impressions + 1) * 12)
      : k.searchVolume != null ? Math.min(30, Math.log10(k.searchVolume + 1) * 9)
      : k.trendScore != null ? Math.min(25, k.trendScore / 4) : 5;
    const illustratable = ["xu-ly-loi", "sau"].includes(k.intent) ? 10 : 5;
    const learned = convRate.has(k.cluster) ? Math.round((convRate.get(k.cluster)! / maxRate) * 15) : 0;
    const launch = LAUNCH_CLUSTERS.includes(k.cluster) ? 10 : 0;
    await upsert({
      type: "new", dedupeKey: `new:${norm}`, keywordIds: [k.id], title: `Viết mới: ${k.query}`,
      score: Math.round(brandFit * W.brandFit + demand * W.demand + illustratable * W.illustratable + learned * W.learned + launch * W.launch),
      factors: { brandFit, demand: Math.round(demand), illustratable, learned, launch },
      rationale: [
        `Phù hợp thương hiệu ${brandFit}/30`,
        `Nhu cầu ${Math.round(demand)}/30 (hiển thị: ${fmt(k.impressions)}, lượng tìm kiếm: ${fmt(k.searchVolume)}, điểm xu hướng: ${fmt(k.trendScore)})`,
        `Khả năng minh hoạ ${illustratable}/10`,
        `Cụm "${k.cluster || "chưa gắn"}" có tỷ lệ chuyển đổi đã học: +${learned}`,
        launch ? "Thuộc cụm ra mắt: +10" : "",
        k.source === "ai_suggest" ? "Nguồn: AI đề xuất — cần kiểm chứng nhu cầu" : `Nguồn: ${k.source}`,
        W.basedOn ? `Trọng số đã học từ ${W.basedOn} bài` : "",
      ].filter(Boolean).join(" · "),
      evidence: { keyword: k.query, source: k.source, impressions: k.impressions, searchVolume: k.searchVolume, trendScore: k.trendScore, intent: k.intent, cluster: k.cluster, clusterConversionRate: convRate.get(k.cluster) ?? null },
    });
  }
  return { result: { upserted: created, clustersLearned: conv.length } };
}

// ───────────── 4. Brief + bản nháp bài mới ─────────────
const DraftSchema = z.object({
  brief: z.object({
    intent: z.string(),
    primaryQuery: z.string(),
    secondaryQueries: z.array(z.string()),
    outline: z.array(z.string()),
    photosNeeded: z.array(z.string()).describe("Ảnh thật đội HULAKO cần chụp"),
    productSkus: z.array(z.string()).describe("SKU phù hợp chọn từ danh sách được cung cấp"),
    internalLinks: z.array(z.string()).describe("URL nội bộ nên liên kết"),
  }),
  article: z.object({
    title: z.string(),
    slug: z.string().describe("slug không dấu, ngắn"),
    summary: z.string().describe("Mô tả ngắn 1–2 câu hiện dưới tiêu đề"),
    body: z.string().describe("Nội dung Markdown theo template"),
    seoTitle: z.string(),
    seoDescription: z.string(),
    coverAlt: z.string(),
  }),
  factChecks: z.array(z.string()).describe("Dữ kiện cần đội HULAKO kiểm chứng trước khi xuất bản"),
  sources: z.array(z.string()).describe("Nguồn dữ liệu đã dùng (tên bộ dữ liệu được cung cấp)"),
});

export async function siteContext() {
  const db = await getDb();
  const [prods, setupsList, arts] = await Promise.all([
    db.select({ id: schema.products.id, name: schema.products.name, slug: schema.products.slug, summary: schema.products.summary, sku: schema.variants.sku, variant: schema.variants.name, variantId: schema.variants.id })
      .from(schema.products).innerJoin(schema.variants, eq(schema.variants.productId, schema.products.id))
      .where(and(eq(schema.products.status, "public"), eq(schema.variants.status, "public"))).limit(60),
    db.select({ id: schema.setups.id, title: schema.setups.title, slug: schema.setups.slug }).from(schema.setups).where(eq(schema.setups.status, "public")).limit(40),
    db.select({ kind: schema.articles.kind, slug: schema.articles.slug, title: schema.revisions.title })
      .from(schema.articles).innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId)).limit(80),
  ]);
  return {
    prods, setupsList,
    links: [
      ...arts.map((a) => ({ url: articlePath(a), title: a.title })),
      ...setupsList.map((s) => ({ url: `/goc-livestream/${s.slug}`, title: s.title })),
      ...prods.map((p) => ({ url: `/thiet-bi/${p.slug}`, title: p.name })),
      { url: "/chon-den", title: "Công cụ chọn đèn theo phòng" },
      { url: "/lien-he", title: "Nhờ HULAKO tư vấn" },
    ],
  };
}

export async function writeDraft(opportunityId: string, actorId: string | null): Promise<StepResult> {
  const db = await getDb();
  const [opp] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  if (!opp) throw new Error("Không tìm thấy cơ hội");
  if (opp.draftArticleId) return { result: { skipped: "Đã có bản nháp", articleId: opp.draftArticleId } }; // chạy lại không tạo trùng
  if (opp.type !== "new") return refreshArticle(opportunityId, actorId);

  const kws = opp.keywordIds.length ? await db.select().from(schema.keywords).where(inArray(schema.keywords.id, opp.keywordIds)) : [];
  const guide = await getActivePrompt();
  const ctx = await siteContext();
  const topics = await db.select().from(schema.topics);
  const { data, usage } = await generateStructured({
    schema: DraftSchema, effort: "high", maxTokens: 20000, system: BRAND_SYSTEM,
    user: [
      guide.content,
      "Nhiệm vụ: lập brief rồi viết bản nháp bài kiến thức cho cơ hội SEO dưới đây. Chỉ chọn SKU và URL có trong dữ liệu. Không bịa thông số.",
      ...(opp.evidence && (opp.evidence as { serpStructure?: unknown }).serpStructure ? [[
        "Có sẵn bản DECODE cấu trúc các bài đang đứng đầu tìm kiếm (mục serpStructure). Cách dùng:",
        "- Học CẤU TRÚC: thứ tự ý, các mục bắt buộc phải có, câu hỏi người đọc hay hỏi, độ dài tham khảo, định dạng (bảng, danh sách bước, FAQ).",
        "- KHÔNG sao chép, KHÔNG diễn đạt lại câu chữ/đoạn văn/ví dụ của bài khác. Nội dung, ví dụ, số liệu, góc nhìn phải MỚI 100% từ góc của HULAKO và dữ liệu được cung cấp.",
        "- Lấp các 'khoảng trống' (contentGaps) mà bài top còn thiếu để bài hữu ích hơn.",
        "- Viết cho người đọc trước (nội dung hữu ích theo chính sách Google), không nhồi từ khoá, không tạo nội dung chỉ để lên hạng.",
      ].join("\n")] : []),
      dataBlock("co_hoi", { title: opp.title, rationale: opp.rationale, evidence: opp.evidence }),
      dataBlock("tu_khoa", kws.map((k) => ({ query: k.query, variants: k.variantsSeen, intent: k.intent, cluster: k.cluster }))),
      dataBlock("san_pham_cong_khai", ctx.prods.map((p) => ({ sku: p.sku, ten: `${p.name} — ${p.variant}`, url: `/thiet-bi/${p.slug}`, mo_ta: p.summary }))),
      dataBlock("url_noi_bo", ctx.links),
    ].join("\n\n"),
  });

  const a = data.article;
  const issues = checkClaims({ title: a.title, summary: a.summary, body: a.body, seoTitle: a.seoTitle, seoDescription: a.seoDescription, coverAlt: a.coverAlt });
  const kwCluster = kws[0]?.cluster;
  const topic = topics.find((t) => t.slug === kwCluster) ?? null;
  const relatedVariantProducts = ctx.prods.filter((p) => data.brief.productSkus.includes(p.sku));
  const relatedProductIds = [...new Set(relatedVariantProducts.map((p) => p.id))].slice(0, 4);
  let slug = slugify(a.slug || a.title) || `bai-${Date.now()}`;
  const [{ taken }] = await db.select({ taken: sql<number>`count(*)::int` }).from(schema.articles).where(and(eq(schema.articles.kind, "guide"), eq(schema.articles.slug, slug)));
  if (Number(taken)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const articleId = await db.transaction(async (tx) => {
    const [art] = await tx.insert(schema.articles).values({
      kind: "guide", slug, status: "draft", topicId: topic?.id ?? null, targetKeyword: data.brief.primaryQuery,
      aiGenerated: true, promptVersion: guide.version, authorId: actorId,
    }).returning();
    const [rev] = await tx.insert(schema.revisions).values({
      articleId: art.id, number: 1, title: a.title, summary: a.summary, body: a.body, seoTitle: a.seoTitle, seoDescription: a.seoDescription,
      coverAlt: a.coverAlt, relatedProductIds, factChecks: [...data.factChecks, ...issues.map((i) => `Claim bị chặn (${i.field}): "${i.match}" — ${i.hint}`)],
      sources: data.sources, origin: "ai", createdBy: actorId,
    }).returning();
    await tx.update(schema.articles).set({ draftRevisionId: rev.id }).where(eq(schema.articles.id, art.id));
    await tx.update(schema.opportunities).set({ status: "drafted", draftArticleId: art.id, brief: data.brief }).where(eq(schema.opportunities.id, opp.id));
    await tx.update(schema.keywords).set({ status: "in_opportunity", targetArticleId: art.id }).where(inArray(schema.keywords.id, opp.keywordIds.length ? opp.keywordIds : ["00000000-0000-0000-0000-000000000000"]));
    return art.id;
  });
  return { result: { articleId, slug, factChecks: data.factChecks.length, blockedClaims: issues.length }, usage, needsReview: issues.length > 0 };
}

// ───────────── 5. Cập nhật bài cũ dựa trên số liệu sau xuất bản ─────────────
const RefreshSchema = z.object({
  title: z.string(), summary: z.string(), seoTitle: z.string(), seoDescription: z.string(),
  body: z.string().describe("Toàn bộ nội dung Markdown mới; nếu chỉ sửa tiêu đề/mô tả thì giữ nguyên nội dung cũ"),
  changeNotes: z.array(z.string()).describe("Đã đổi gì và vì sao, dựa trên số liệu"),
  factChecks: z.array(z.string()),
});

export async function refreshArticle(opportunityId: string, actorId: string | null): Promise<StepResult> {
  const db = await getDb();
  const [opp] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  if (!opp?.targetArticleId) throw new Error("Cơ hội không gắn bài mục tiêu");
  const [row] = await db.select({ a: schema.articles, r: schema.revisions }).from(schema.articles)
    .innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId))
    .where(eq(schema.articles.id, opp.targetArticleId));
  if (!row) throw new Error("Bài mục tiêu chưa công khai");
  if (row.a.draftRevisionId && row.a.draftRevisionId !== row.a.publishedRevisionId && row.a.status !== "published") {
    return { result: { skipped: "Bài đang có bản nháp chưa xử lý — không ghi đè" } };
  }
  const path = articlePath(row.a);
  const queries = (await queryPageAggregates(28)).filter((q) => q.page === path).sort((x, y) => y.impressions - x.impressions).slice(0, 25);
  const guide = await getActivePrompt();
  const ctx = await siteContext();
  const onlyMeta = opp.type === "ctr_fix";
  const { data, usage } = await generateStructured({
    schema: RefreshSchema, effort: onlyMeta ? "medium" : "high", maxTokens: 20000, system: BRAND_SYSTEM,
    user: [
      guide.content,
      onlyMeta
        ? "Nhiệm vụ: bài có nhiều hiển thị nhưng ít nhấp. Viết lại title, summary, seoTitle, seoDescription hấp dẫn và khớp truy vấn thật. Giữ NGUYÊN body."
        : "Nhiệm vụ: cập nhật bài để trả lời đầy đủ các truy vấn người dùng đang tìm, bổ sung bước làm/lỗi hay gặp còn thiếu, giữ phần đúng. Không bịa thông số.",
      dataBlock("so_lieu", { rationale: opp.rationale, evidence: opp.evidence, truy_van_cua_trang: queries }),
      dataBlock("bai_hien_tai", { title: row.r.title, summary: row.r.summary, seoTitle: row.r.seoTitle, seoDescription: row.r.seoDescription, body: row.r.body }),
      dataBlock("url_noi_bo", ctx.links),
    ].join("\n\n"),
  });
  const body = onlyMeta ? row.r.body : data.body;
  const issues = checkClaims({ title: data.title, summary: data.summary, body, seoTitle: data.seoTitle, seoDescription: data.seoDescription });
  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: max(schema.revisions.number) }).from(schema.revisions).where(eq(schema.revisions.articleId, row.a.id));
    const [rev] = await tx.insert(schema.revisions).values({
      articleId: row.a.id, number: (n ?? 0) + 1, title: data.title, summary: data.summary, body, seoTitle: data.seoTitle, seoDescription: data.seoDescription,
      coverUrl: row.r.coverUrl, coverAlt: row.r.coverAlt, relatedProductIds: row.r.relatedProductIds, relatedSetupIds: row.r.relatedSetupIds,
      factChecks: [...data.changeNotes.map((c) => `Thay đổi: ${c}`), ...data.factChecks, ...issues.map((i) => `Claim bị chặn (${i.field}): "${i.match}"`)],
      sources: ["Search Console 28 ngày", "Sự kiện website"], origin: "ai", createdBy: actorId,
    }).returning();
    // Bản công khai giữ nguyên phục vụ khách cho tới khi bản mới được duyệt và xuất bản
    await tx.update(schema.articles).set({ draftRevisionId: rev.id, status: "draft", approvedRevisionId: null, updatedAt: new Date() }).where(eq(schema.articles.id, row.a.id));
    await tx.update(schema.opportunities).set({ status: "drafted", draftArticleId: row.a.id }).where(eq(schema.opportunities.id, opp.id));
  });
  return { result: { articleId: row.a.id, changeNotes: data.changeNotes }, usage, needsReview: issues.length > 0 };
}

// ───────────── 6. Tự nâng cấp: đề xuất phiên bản hướng dẫn viết mới ─────────────
const ImproveSchema = z.object({
  newGuide: z.string().describe("Toàn văn hướng dẫn viết + template mới (Markdown)"),
  rationale: z.string().describe("Giải thích thay đổi, trích số liệu làm căn cứ"),
  expectedEffect: z.string(),
});

export async function improvePrompt(): Promise<StepResult> {
  const db = await getDb();
  const perf = await pagePerformance(56);
  const ai = await db.select({ a: schema.articles, title: schema.revisions.title, seoTitle: schema.revisions.seoTitle })
    .from(schema.articles).innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId))
    .where(isNotNull(schema.articles.publishedAt));
  const rows = ai.map((x) => ({ ...x, p: perf.get(articlePath(x.a)) })).filter((x) => x.p && x.p.impressions > 0);
  if (rows.length < 3) {
    return { result: { skipped: `Chưa đủ dữ liệu: cần ≥ 3 bài công khai có số liệu Search Console, hiện có ${rows.length}.` } };
  }
  const feedback = await db.select({ reason: sql<string>`${schema.auditLogs.changes}->>'reason'` }).from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.action, "article.request_changes"))).orderBy(desc(schema.auditLogs.createdAt)).limit(30);
  const guide = await getActivePrompt();
  const winRates = await promptPerformance();
  const table = rows.map((x) => ({
    tieu_de: x.title, seo_title: x.seoTitle, ai: x.a.aiGenerated, prompt_version: x.a.promptVersion,
    hien_thi: x.p!.impressions, nhap: x.p!.clicks, ctr: Number((x.p!.ctr * 100).toFixed(2)), vi_tri: x.p!.position && Number(x.p!.position.toFixed(1)),
    luot_xem: x.p!.views, bam_sang_san: x.p!.marketplaceClicks, tu_van: x.p!.consultClicks + x.p!.leads,
  }));
  const { data, usage } = await generateStructured({
    schema: ImproveSchema, effort: "high", maxTokens: 12000, system: BRAND_SYSTEM,
    user: [
      "Nhiệm vụ: bạn là trưởng nhóm SEO. Phân tích hiệu quả các bài đã xuất bản và nhận xét của người duyệt, rồi đề xuất phiên bản MỚI của bộ hướng dẫn viết dưới đây để bài sau đạt CTR, vị trí và lượt bấm sang sàn tốt hơn. Giữ nguyên toàn bộ luật cứng thương hiệu. Chỉ thay đổi điều có số liệu ủng hộ; nói rõ điều gì là giả thuyết.",
      dataBlock("huong_dan_hien_tai", guide.content),
      dataBlock("hieu_qua_bai_56_ngay", table),
      dataBlock("nhan_xet_nguoi_duyet", feedback.map((f) => f.reason).filter(Boolean)),
      dataBlock("ty_le_thang_theo_phien_ban_huong_dan (thí nghiệm đo 28 ngày sau xuất bản)", winRates),
    ].join("\n\n"),
  });
  const issues = checkClaims({ guide: data.newGuide });
  const [{ v }] = await db.select({ v: max(schema.promptVersions.version) }).from(schema.promptVersions).where(eq(schema.promptVersions.key, "article_writer"));
  const [pv] = await db.insert(schema.promptVersions).values({
    key: "article_writer", version: (v ?? 1) + 1, content: data.newGuide, status: "draft", origin: "ai",
    rationale: `${data.rationale}\n\nKỳ vọng: ${data.expectedEffect}`,
  }).returning();
  return { result: { promptVersion: pv.version, articlesAnalysed: rows.length }, usage, needsReview: issues.length > 0 };
}

// ───────────── Tự chọn cơ hội tốt nhất để viết nháp (giới hạn mỗi tuần) ─────────────
export async function topOpenOpportunities(limit: number) {
  const db = await getDb();
  return db.select().from(schema.opportunities).where(eq(schema.opportunities.status, "open")).orderBy(desc(schema.opportunities.score)).limit(limit);
}
