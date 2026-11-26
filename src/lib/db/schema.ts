// Mô hình dữ liệu theo mục 08 của đặc tả.
// Quy ước: id là uuid ổn định; thời điểm lưu dạng timestamptz (UTC);
// trường "version" dùng cho khoá lạc quan (trả 409 khi dữ liệu đã đổi).
import {
  pgTable, text, uuid, integer, boolean, timestamp, jsonb, real, customType, index, uniqueIndex, primaryKey, date,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Người dùng, quyền, nhật ký ----------
export const ROLES = ["admin", "seo_editor", "reviewer", "product_ops", "consultant", "recruiter", "ai_agent"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  roles: jsonb("roles").$type<Role[]>().notNull().default([]),
  status: text("status").notNull().default("active"), // active | disabled
  createdAt: createdAt(),
});

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  changes: jsonb("changes").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)]);

// Cấu hình dùng chung: thông tin công ty, menu, trang chủ, kênh chat, thông báo thu thập dữ liệu
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// ---------- Nội dung ----------
export const topics = pgTable("topics", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  intro: text("intro").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const ARTICLE_STATUS = ["draft", "review", "approved", "scheduled", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUS)[number];

export const articles = pgTable("articles", {
  id: id(),
  kind: text("kind").notNull().default("guide"), // guide (kiến thức) | news (tin tức)
  slug: text("slug").notNull(),
  status: text("status").$type<ArticleStatus>().notNull().default("draft"),
  topicId: uuid("topic_id").references(() => topics.id),
  targetKeyword: text("target_keyword").notNull().default(""),
  draftRevisionId: uuid("draft_revision_id"),
  publishedRevisionId: uuid("published_revision_id"),
  approvedRevisionId: uuid("approved_revision_id"),
  authorId: uuid("author_id"),
  reviewerId: uuid("reviewer_id"),
  reviewComment: text("review_comment"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  contentUpdatedAt: timestamp("content_updated_at", { withTimezone: true }),
  isSample: boolean("is_sample").notNull().default(false), // dữ liệu/ảnh minh hoạ (DEMO) — hiện nhãn "minh họa" ngoài web
  featured: boolean("featured").notNull().default(false),
  searchText: text("search_text").notNull().default(""), // chỉ từ bản công khai, đã bỏ dấu
  aiGenerated: boolean("ai_generated").notNull().default(false),
  promptVersion: integer("prompt_version"),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("articles_kind_slug_idx").on(t.kind, t.slug),
  index("articles_status_idx").on(t.status),
  index("articles_published_at_idx").on(t.publishedAt),
  index("articles_topic_idx").on(t.topicId),
]);

export const revisions = pgTable("revisions", {
  id: id(),
  articleId: uuid("article_id").notNull().references(() => articles.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  body: text("body").notNull().default(""), // Markdown
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  coverUrl: text("cover_url"),
  coverAlt: text("cover_alt").notNull().default(""),
  relatedProductIds: jsonb("related_product_ids").$type<string[]>().notNull().default([]),
  relatedSetupIds: jsonb("related_setup_ids").$type<string[]>().notNull().default([]),
  factChecks: jsonb("fact_checks").$type<string[]>().notNull().default([]), // dữ kiện AI đánh dấu cần kiểm chứng
  sources: jsonb("sources").$type<string[]>().notNull().default([]),
  origin: text("origin").notNull().default("human"), // human | ai | restore
  aiJobId: uuid("ai_job_id"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
}, (t) => [index("revisions_article_idx").on(t.articleId)]);

// ---------- Thiết bị ----------
export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const PRODUCT_STATUS = ["draft", "public", "paused", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];

export type SpecRow = { label: string; value: string };
export type ImageRef = { url: string; alt: string; kind?: "full" | "box" | "detail" | "video" };

export const products = pgTable("products", {
  id: id(),
  slug: text("slug").notNull().unique(),
  categoryId: uuid("category_id").references(() => categories.id),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  useCases: jsonb("use_cases").$type<string[]>().notNull().default([]),
  body: text("body").notNull().default(""),
  status: text("status").$type<ProductStatus>().notNull().default("draft"),
  isSample: boolean("is_sample").notNull().default(false), // dữ liệu/ảnh minh hoạ (DEMO) — hiện nhãn "minh họa" ngoài web
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  searchText: text("search_text").notNull().default(""),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("products_status_idx").on(t.status), index("products_category_idx").on(t.categoryId)]);

export const variants = pgTable("variants", {
  id: id(),
  productId: uuid("product_id").notNull().references(() => products.id),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  components: jsonb("components").$type<string[]>().notNull().default([]),
  specs: jsonb("specs").$type<SpecRow[]>().notNull().default([]),
  images: jsonb("images").$type<ImageRef[]>().notNull().default([]),
  status: text("status").$type<ProductStatus>().notNull().default("public"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("variants_product_idx").on(t.productId)]);

export const channelLinks = pgTable("channel_links", {
  id: id(),
  variantId: uuid("variant_id").notNull().references(() => variants.id),
  channel: text("channel").notNull(), // shopee | tiktok
  url: text("url").notNull(),
  status: text("status").notNull().default("ok"), // ok | pending_check | broken
  checkedAt: timestamp("checked_at", { withTimezone: true }),
}, (t) => [uniqueIndex("channel_links_variant_channel_idx").on(t.variantId, t.channel)]);

export const policies = pgTable("policies", {
  id: id(),
  scope: text("scope").notNull(), // product | variant | channel
  refId: text("ref_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("draft"), // draft | approved
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo: timestamp("valid_to", { withTimezone: true }),
});

// ---------- Media & tệp riêng tư ----------
export const mediaAssets = pgTable("media_assets", {
  id: id(),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  alt: text("alt").notNull().default(""),
  source: text("source").notNull().default(""),
  usageRights: text("usage_rights").notNull().default(""),
  sku: text("sku"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("pending"), // pending | approved | archived
  uploadedBy: uuid("uploaded_by"),
  approvedBy: uuid("approved_by"),
  data: bytea("data"), // chỉ dùng khi không cấu hình Vercel Blob
  createdAt: createdAt(),
}, (t) => [index("media_sku_idx").on(t.sku)]);

export const privateFiles = pgTable("private_files", {
  id: id(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

// ---------- Mẫu góc live & quy tắc chọn đèn ----------
export const setups = pgTable("setups", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  space: text("space").notNull().default(""), // phong-nho | goc-ban | ...
  industry: text("industry").notNull().default(""), // quan-ao | my-pham | khac
  style: text("style").notNull().default(""), // ngoi | dung | tren-ban | review
  roomConditions: text("room_conditions").notNull().default(""),
  cameraAngle: text("camera_angle").notNull().default(""),
  lightPosition: text("light_position").notNull().default(""),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  demoNote: text("demo_note").notNull().default(""),
  body: text("body").notNull().default(""),
  coverUrl: text("cover_url"),
  coverAlt: text("cover_alt").notNull().default(""),
  diagramUrl: text("diagram_url"),
  variantIds: jsonb("variant_ids").$type<string[]>().notNull().default([]),
  relatedArticleIds: jsonb("related_article_ids").$type<string[]>().notNull().default([]),
  isSample: boolean("is_sample").notNull().default(false), // dữ liệu/ảnh minh hoạ (DEMO) — hiện nhãn "minh họa" ngoài web
  status: text("status").notNull().default("draft"), // draft | public | archived
  featured: boolean("featured").notNull().default(false),
  searchText: text("search_text").notNull().default(""),
  version: integer("version").notNull().default(1),
  updatedAt: updatedAt(),
});

export const ruleSets = pgTable("rule_sets", {
  version: integer("version").primaryKey(),
  status: text("status").notNull().default("draft"), // draft | active | archived
  note: text("note").notNull().default(""),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  activatedBy: uuid("activated_by"),
});

export type RuleConditions = { area?: string[]; industry?: string[]; style?: string[] };

export const recommendationRules = pgTable("recommendation_rules", {
  id: id(),
  ruleSetVersion: integer("rule_set_version").notNull().references(() => ruleSets.version),
  name: text("name").notNull(),
  conditions: jsonb("conditions").$type<RuleConditions>().notNull().default({}),
  priority: integer("priority").notNull().default(0),
  setupId: uuid("setup_id").references(() => setups.id),
  variantIds: jsonb("variant_ids").$type<string[]>().notNull().default([]),
  advice: text("advice").notNull().default(""),
  articleSlug: text("article_slug"),
  note: text("note").notNull().default(""),
}, (t) => [index("rules_version_idx").on(t.ruleSetVersion)]);

// ---------- Hỗ trợ, tư vấn, tuyển dụng ----------
export const faqs = pgTable("faqs", {
  id: id(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  topic: text("topic").notNull().default("chung"), // loi-thuong-gap | lap-dat | mua-hang ...
  deviceType: text("device_type").notNull().default(""),
  productId: uuid("product_id"),
  articleSlug: text("article_slug"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("public"),
});

export type HistoryEntry = { at: string; by?: string; status?: string; note?: string };

export const leads = pgTable("leads", {
  id: id(),
  code: text("code").notNull().unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  payloadHash: text("payload_hash").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  businessField: text("business_field"), // lĩnh vực kinh doanh (popup quà tặng)
  shippingAddress: text("shipping_address"), // địa chỉ nhận quà — dữ liệu cá nhân, xoá theo hạn lưu như các trường khác
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
  source: text("source").notNull().default("contact"), // contact | product | article | selector
  consent: boolean("consent").notNull(),
  consentVersion: text("consent_version").notNull(),
  status: text("status").notNull().default("new"), // new | assigned | in_progress | resolved | closed
  assigneeId: uuid("assignee_id"),
  notes: jsonb("notes").$type<HistoryEntry[]>().notNull().default([]),
  history: jsonb("history").$type<HistoryEntry[]>().notNull().default([]),
  notifyStatus: text("notify_status").notNull().default("pending"), // pending | sent | failed | skipped
  notifyAttempts: integer("notify_attempts").notNull().default(0),
  notifyError: text("notify_error"),
  retainUntil: timestamp("retain_until", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("leads_status_idx").on(t.status), index("leads_created_idx").on(t.createdAt)]);

export const jobs = pgTable("jobs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  location: text("location").notNull().default(""),
  employmentType: text("employment_type").notNull().default("Toàn thời gian"),
  deadline: date("deadline"),
  description: text("description").notNull().default(""),
  requirements: text("requirements").notNull().default(""),
  benefits: text("benefits").notNull().default(""),
  status: text("status").notNull().default("draft"), // draft | open | closed
  department: text("department").notNull().default(""), // noi-dung | van-hanh ...
  isSample: boolean("is_sample").notNull().default(false), // dữ liệu/ảnh minh hoạ (DEMO) — hiện nhãn "minh họa" ngoài web
  publishedAt: timestamp("published_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

export const applications = pgTable("applications", {
  id: id(),
  code: text("code").notNull().unique(),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  note: text("note").notNull().default(""),
  cvFileId: uuid("cv_file_id").notNull(),
  consent: boolean("consent").notNull(),
  consentVersion: text("consent_version").notNull(),
  status: text("status").notNull().default("new"), // new | screening | interview | result
  notes: jsonb("notes").$type<HistoryEntry[]>().notNull().default([]),
  history: jsonb("history").$type<HistoryEntry[]>().notNull().default([]),
  retainUntil: timestamp("retain_until", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("applications_job_idx").on(t.jobId)]);

// ---------- SEO, AI, đo lường (feedback loop) ----------
// SourceSnapshot: số liệu Search Console theo ngày × truy vấn × trang
export const gscMetrics = pgTable("gsc_metrics", {
  date: date("date").notNull(),
  query: text("query").notNull(),
  page: text("page").notNull(),
  clicks: integer("clicks").notNull(),
  impressions: integer("impressions").notNull(),
  ctr: real("ctr").notNull(),
  position: real("position").notNull(),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.date, t.query, t.page] }), index("gsc_page_idx").on(t.page)]);

export const keywords = pgTable("keywords", {
  id: id(),
  query: text("query").notNull(),
  normalized: text("normalized").notNull().unique(),
  variantsSeen: jsonb("variants_seen").$type<string[]>().notNull().default([]),
  cluster: text("cluster").notNull().default(""),
  intent: text("intent").notNull().default(""), // rong | sau | san-pham | xu-ly-loi | xu-huong
  // Loại từ khoá do Agent R&D phân nhóm: sieu-rong | dai | nganh | san-pham | ngan | dia-ly | trend
  kind: text("kind").notNull().default(""),
  source: text("source").notNull(), // gsc | csv | manual | consultant | ai_suggest | agent_research | agent_trends | agent_autocomplete
  market: text("market").notNull().default("VN"),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  impressions: integer("impressions"),
  clicks: integer("clicks"),
  position: real("position"),
  searchVolume: integer("search_volume"), // null = chưa có dữ liệu
  trendScore: real("trend_score"), // null = chưa có dữ liệu; tách riêng với lượng tìm kiếm
  note: text("note").notNull().default(""), // ghi chú của agent: vì sao từ khoá có khả năng ra khách
  targetArticleId: uuid("target_article_id"),
  status: text("status").notNull().default("new"), // new | in_opportunity | skipped
  createdAt: createdAt(),
});

export const opportunities = pgTable("opportunities", {
  id: id(),
  type: text("type").notNull(), // new | update | merge | ctr_fix
  title: text("title").notNull(),
  keywordIds: jsonb("keyword_ids").$type<string[]>().notNull().default([]),
  targetArticleId: uuid("target_article_id"),
  competingUrls: jsonb("competing_urls").$type<string[]>().notNull().default([]),
  score: real("score").notNull().default(0),
  rationale: text("rationale").notNull().default(""),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  factors: jsonb("factors").$type<Record<string, number>>().notNull().default({}), // điểm thành phần (để học trọng số)
  brief: jsonb("brief").$type<Record<string, unknown>>(),
  draftArticleId: uuid("draft_article_id"),
  status: text("status").notNull().default("open"), // open | briefed | drafted | done | dismissed
  dedupeKey: text("dedupe_key").notNull().unique(),
  createdAt: createdAt(),
});

export const aiJobs = pgTable("ai_jobs", {
  id: id(),
  type: text("type").notNull(), // collect_gsc | suggest_keywords | score_opportunities | write_brief | write_draft | refresh_article | improve_prompt
  scope: jsonb("scope").$type<Record<string, unknown>>().notNull().default({}),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").notNull().default("queued"), // queued | running | waiting_runner | runner_running | done | failed | skipped | cancelled
  attempts: integer("attempts").notNull().default(0),
  model: text("model"),
  promptVersion: integer("prompt_version"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  error: text("error"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  needsReview: boolean("needs_review").notNull().default(false),
  // Chạy AI qua Claude CLI của Claude Desktop trên máy (runner) — không dùng API key:
  // waiting_runner (chờ runner nhận) → runner_running → runner gửi kết quả → chạy lại bước với kết quả đó.
  aiRequest: jsonb("ai_request").$type<{ system: string; user: string; schema: unknown; effort: string }>(),
  aiResponse: jsonb("ai_response").$type<unknown>(),
  runner: text("runner"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdBy: text("created_by").notNull().default("system"),
  createdAt: createdAt(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [index("ai_jobs_status_idx").on(t.status), index("ai_jobs_created_idx").on(t.createdAt)]);

// Bộ hướng dẫn viết (prompt) có phiên bản — vòng phản hồi đề xuất bản mới, người duyệt kích hoạt
export const promptVersions = pgTable("prompt_versions", {
  id: id(),
  key: text("key").notNull(), // article_writer
  version: integer("version").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("draft"), // draft | active | retired
  rationale: text("rationale").notNull().default(""),
  origin: text("origin").notNull().default("human"), // human | ai
  createdAt: createdAt(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
}, (t) => [uniqueIndex("prompt_key_version_idx").on(t.key, t.version)]);

export const redirects = pgTable("redirects", {
  id: id(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  createdAt: createdAt(),
});

export const EVENT_TYPES = ["marketplace_click", "consult_click", "lead_submit", "selector_complete", "job_apply", "page_view"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const events = pgTable("events", {
  id: id(),
  eventId: text("event_id").notNull().unique(),
  type: text("type").$type<EventType>().notNull(),
  pagePath: text("page_path").notNull().default(""),
  pageType: text("page_type").notNull().default(""),
  entityId: text("entity_id"),
  variantId: text("variant_id"),
  channel: text("channel"),
  ctaType: text("cta_type"),
  createdAt: createdAt(),
}, (t) => [index("events_type_created_idx").on(t.type, t.createdAt), index("events_page_idx").on(t.pagePath)]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

// ---------- Vòng phản hồi tự học (feedback loop v2) ----------
// Mỗi thay đổi do AI đề xuất (bài mới, viết lại title/meta, cập nhật nội dung, đổi trọng số) là một "thí nghiệm":
// chụp số liệu nền lúc xuất bản → sau 28 ngày đo lại → kết luận thắng/thua/hoà. Kết quả dùng để
// (1) học lại trọng số chấm điểm cơ hội, (2) làm căn cứ cho AI đề xuất bộ hướng dẫn viết mới.
export const experiments = pgTable("experiments", {
  id: id(),
  kind: text("kind").notNull(), // new_article | ctr_fix | update | prompt_version | weights
  articleId: uuid("article_id"),
  opportunityId: uuid("opportunity_id"),
  revisionId: uuid("revision_id"),
  promptVersion: integer("prompt_version"),
  hypothesis: text("hypothesis").notNull().default(""),
  baseline: jsonb("baseline").$type<Record<string, number | null>>().notNull().default({}),
  result: jsonb("result").$type<Record<string, number | null>>(),
  factors: jsonb("factors").$type<Record<string, number>>().notNull().default({}), // điểm thành phần lúc chấm cơ hội
  verdict: text("verdict").notNull().default("running"), // running | win | loss | neutral | insufficient
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  evaluateAfter: timestamp("evaluate_after", { withTimezone: true }).notNull(),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
}, (t) => [index("experiments_verdict_idx").on(t.verdict), index("experiments_article_idx").on(t.articleId)]);

// Nhật ký học: mỗi lần hệ thống tự điều chỉnh (trọng số, ưu tiên cụm, đề xuất prompt) ghi lại căn cứ để người xem lại / hoàn tác
export const learningLog = pgTable("learning_log", {
  id: id(),
  kind: text("kind").notNull(), // weights | cluster_priority | prompt_proposal | experiment_verdict
  summary: text("summary").notNull(),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  applied: boolean("applied").notNull().default(false),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("learning_created_idx").on(t.createdAt)]);

// ---------- Hỗ trợ index ----------
// Trạng thái index từng URL bài viết: lần gửi IndexNow/sitemap gần nhất + kết quả kiểm tra URL của Google (URL Inspection API)
export const indexStatus = pgTable("index_status", {
  path: text("path").primaryKey(), // vd /kien-thuc/softbox-bat-giac-hay-chu-nhat
  articleId: uuid("article_id"),
  submitCount: integer("submit_count").notNull().default(0),
  lastSubmittedAt: timestamp("last_submitted_at", { withTimezone: true }),
  indexNowCode: integer("index_now_code"), // 200/202 = đã nhận
  submitNote: text("submit_note").notNull().default(""),
  inspectedAt: timestamp("inspected_at", { withTimezone: true }),
  verdict: text("verdict"), // PASS | NEUTRAL | FAIL | PARTIAL | UNKNOWN (từ Google)
  coverage: text("coverage").notNull().default(""), // vd "Đã gửi và được lập chỉ mục"
  lastCrawlAt: timestamp("last_crawl_at", { withTimezone: true }),
  indexedAt: timestamp("indexed_at", { withTimezone: true }), // lần đầu thấy PASS
  removed: boolean("removed").notNull().default(false), // bài đã gỡ
  updatedAt: updatedAt(),
}, (t) => [index("index_status_article_idx").on(t.articleId)]);

// ---------- SEO Agent chạy trên máy (tools/seo-agent.mjs) ----------
// Ảnh chụp kết quả tìm kiếm + "decode" cấu trúc các bài đứng đầu cho 1 từ khoá (chỉ cấu trúc, không lưu nội dung của họ)
export const serpSnapshots = pgTable("serp_snapshots", {
  id: id(),
  keyword: text("keyword").notNull(),
  normalized: text("normalized").notNull(),
  results: jsonb("results").$type<{ position: number; url: string; title: string; domain: string }[]>().notNull().default([]),
  ourPosition: integer("our_position"), // vị trí của website mình trong danh sách (null = không có)
  decode: jsonb("decode").$type<Record<string, unknown>>().notNull().default({}),
  source: text("source").notNull().default("claude_websearch"),
  createdAt: createdAt(),
}, (t) => [index("serp_norm_idx").on(t.normalized, t.createdAt)]);

export const competitors = pgTable("competitors", {
  id: id(),
  domain: text("domain").notNull().unique(), // vd tenmien.vn (không www)
  name: text("name").notNull().default(""),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("active"), // active | suggested | ignored
  discoveredBy: text("discovered_by").notNull().default("manual"), // manual | agent
  seenInSerp: integer("seen_in_serp").notNull().default(0),
  pageCount: integer("page_count").notNull().default(0),
  lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: createdAt(),
});

export const competitorPages = pgTable("competitor_pages", {
  id: id(),
  competitorId: uuid("competitor_id").notNull().references(() => competitors.id, { onDelete: "cascade" }),
  url: text("url").notNull().unique(),
  title: text("title").notNull().default(""),
  lastmod: text("lastmod"),
  hash: text("hash"), // dấu vân tay cấu trúc (tiêu đề + H2) để biết trang có sửa không
  wordCount: integer("word_count"),
  headings: jsonb("headings").$type<string[]>().notNull().default([]),
  state: text("state").notNull().default("seen"), // new | updated | seen
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  changedAt: timestamp("changed_at", { withTimezone: true }),
}, (t) => [index("competitor_pages_comp_idx").on(t.competitorId, t.firstSeenAt)]);

// Kết quả của agent: kế hoạch bài viết mỗi ngày, phân tích đối thủ, xu hướng, báo cáo thứ hạng
export const agentInsights = pgTable("agent_insights", {
  id: id(),
  kind: text("kind").notNull(), // plan | spy | trend | rank | research
  day: date("day").notNull(),
  title: text("title").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("agent_insights_kind_day_idx").on(t.kind, t.day)]);
