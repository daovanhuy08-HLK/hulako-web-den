// Quy trình nội dung (mục 07):
// Nháp → Chờ duyệt → Đã duyệt → Lên lịch/Xuất bản → Lưu trữ. Yêu cầu sửa đưa về Nháp kèm nhận xét.
// Sửa bài đang công khai tạo bản nháp mới; bản công khai vẫn phục vụ khách tới khi bản mới được xuất bản.
import { and, eq, lte, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { announceUrl } from "./indexing";
import { getDb, schema } from "./db";
import { can } from "./permissions";
import { checkClaims, type GuardIssue } from "./guardrails";
import { buildSearchText } from "./search";
import { stripMarkdown } from "./text";
import { audit } from "./audit";
import type { ArticleStatus, Role } from "./db/schema";

export type Transition = "submit" | "request_changes" | "approve" | "schedule" | "publish" | "unpublish" | "archive" | "restore";

export class WorkflowError extends Error {
  constructor(public status: number, public code: string, message: string, public issues?: GuardIssue[]) { super(message); }
}

const ALLOWED: Record<Transition, { from: ArticleStatus[]; perm: "content.submit" | "content.review" }> = {
  submit: { from: ["draft"], perm: "content.submit" },
  request_changes: { from: ["review", "approved", "scheduled"], perm: "content.review" },
  approve: { from: ["review"], perm: "content.review" },
  schedule: { from: ["approved"], perm: "content.review" },
  publish: { from: ["approved", "scheduled"], perm: "content.review" },
  unpublish: { from: ["draft", "review", "approved", "scheduled", "published"], perm: "content.review" },
  archive: { from: ["draft", "review", "approved", "published"], perm: "content.review" },
  restore: { from: ["draft", "review", "approved", "published", "archived"], perm: "content.review" },
};

export function revisionGuardIssues(r: typeof schema.revisions.$inferSelect): GuardIssue[] {
  return checkClaims({
    "Tiêu đề": r.title, "Mô tả ngắn": r.summary, "Nội dung": r.body,
    "SEO title": r.seoTitle, "Meta description": r.seoDescription, "Alt ảnh bìa": r.coverAlt,
  });
}

type Actor = { id: string; roles: Role[] };

export async function transitionArticle(actor: Actor, articleId: string, action: Transition, opts: { revisionId?: string; scheduledAt?: Date | null; reason?: string } = {}) {
  const rule = ALLOWED[action];
  if (!rule) throw new WorkflowError(422, "invalid_action", "Hành động không hợp lệ");
  if (!can(actor.roles, rule.perm)) throw new WorkflowError(403, "forbidden", "Bạn không có quyền thực hiện thao tác này");
  const db = await getDb();

  const result = await db.transaction(async (tx) => {
    const [a] = await tx.select().from(schema.articles).where(eq(schema.articles.id, articleId)).for("update");
    if (!a) throw new WorkflowError(404, "not_found", "Không tìm thấy bài");
    if (!rule.from.includes(a.status)) throw new WorkflowError(409, "invalid_state", `Không thể "${action}" khi bài đang ở trạng thái "${a.status}"`);
    if (opts.revisionId && action !== "restore" && opts.revisionId !== a.draftRevisionId && opts.revisionId !== a.approvedRevisionId) {
      throw new WorkflowError(409, "stale_revision", "Bản nháp đã thay đổi từ lúc bạn mở. Hãy tải lại.");
    }
    const patch: Partial<typeof schema.articles.$inferInsert> = { updatedAt: new Date(), version: a.version + 1 };

    if (action === "submit" || action === "approve") {
      const [rev] = await tx.select().from(schema.revisions).where(eq(schema.revisions.id, a.draftRevisionId!));
      const issues = rev ? revisionGuardIssues(rev) : [];
      if (issues.length) throw new WorkflowError(422, "blocked_claims", "Nội dung chứa claim bị chặn, cần sửa trước khi gửi/duyệt.", issues);
    }
    switch (action) {
      case "submit": patch.status = "review"; break;
      case "request_changes":
        patch.status = "draft"; patch.reviewComment = opts.reason ?? ""; patch.approvedRevisionId = null; patch.scheduledAt = null; break;
      case "approve":
        patch.status = "approved"; patch.approvedRevisionId = a.draftRevisionId; patch.reviewerId = actor.id; patch.reviewComment = null; break;
      case "schedule":
        if (!opts.scheduledAt || opts.scheduledAt.getTime() < Date.now()) throw new WorkflowError(422, "invalid_time", "Thời điểm hẹn phải ở tương lai");
        patch.status = "scheduled"; patch.scheduledAt = opts.scheduledAt; patch.reviewerId = actor.id; break;
      case "publish": {
        const revId = a.approvedRevisionId;
        if (!revId) throw new WorkflowError(409, "not_approved", "Chưa có bản đã duyệt");
        const [rev] = await tx.select().from(schema.revisions).where(eq(schema.revisions.id, revId));
        const issues = revisionGuardIssues(rev);
        if (issues.length) throw new WorkflowError(422, "blocked_claims", "Bản duyệt chứa claim bị chặn.", issues);
        Object.assign(patch, {
          status: "published", publishedRevisionId: revId, scheduledAt: null,
          publishedAt: a.publishedAt ?? new Date(), contentUpdatedAt: new Date(), reviewerId: actor.id,
          searchText: buildSearchText(rev.title, rev.summary, a.targetKeyword, stripMarkdown(rev.body).slice(0, 4000)),
        });
        break;
      }
      case "unpublish":
        if (!a.publishedRevisionId) throw new WorkflowError(409, "not_published", "Bài chưa được công khai");
        patch.status = a.status === "published" ? "draft" : a.status; patch.publishedRevisionId = null; patch.searchText = ""; break;
      case "archive": patch.status = "archived"; patch.publishedRevisionId = null; patch.searchText = ""; break;
      case "restore": {
        // Khôi phục phiên bản -> tạo bản nháp mới để kiểm tra lại (không đụng bản công khai)
        if (!opts.revisionId) throw new WorkflowError(422, "missing_revision", "Cần chọn phiên bản để khôi phục");
        const [src] = await tx.select().from(schema.revisions).where(and(eq(schema.revisions.id, opts.revisionId), eq(schema.revisions.articleId, a.id)));
        if (!src) throw new WorkflowError(404, "not_found", "Không tìm thấy phiên bản");
        const [{ n }] = await tx.select({ n: max(schema.revisions.number) }).from(schema.revisions).where(eq(schema.revisions.articleId, a.id));
        const { id: _id, createdAt: _c, number: _n, ...rest } = src;
        const [copy] = await tx.insert(schema.revisions).values({ ...rest, number: (n ?? 0) + 1, origin: "restore", createdBy: actor.id }).returning();
        patch.draftRevisionId = copy.id;
        patch.status = "draft";
        patch.approvedRevisionId = null;
        break;
      }
    }
    // Ghi chú: "status" là trạng thái của BẢN NHÁP mới nhất. Bài có publishedRevisionId != null là đang công khai,
    // nên bài đang công khai vẫn có thể có bản nháp ở trạng thái draft/review/approved song song.
    const [updated] = await tx.update(schema.articles).set(patch).where(eq(schema.articles.id, a.id)).returning();
    return { before: a, after: updated };
  });

  await audit(actor.id, `article.${action}`, "article", articleId, {
    from: result.before.status, to: result.after.status, revisionId: opts.revisionId ?? result.after.draftRevisionId, reason: opts.reason,
  });
  if (["publish", "unpublish", "archive"].includes(action)) {
    revalidateArticle(result.after.kind, result.after.slug);
    // Báo công cụ tìm kiếm (IndexNow + sitemap Google). Chạy sau khi trả phản hồi; lỗi không ảnh hưởng xuất bản.
    const path = `/${result.after.kind === "news" ? "tin-tuc" : "kien-thuc"}/${result.after.slug}`;
    const reason = action === "publish" ? (result.before.publishedRevisionId ? "update" : "publish") : "unpublish";
    const job = async () => {
      await announceUrl(path, reason, articleId);
      // Vòng học: mỗi lần xuất bản mở một thí nghiệm, 28 ngày sau đo lại hiệu quả (chạy lặp an toàn theo revision)
      if (action === "publish") await import("./seo/learning").then((m) => m.startExperimentOnPublish(articleId)).catch(() => null);
    };
    try { after(job); } catch { void job(); }
  }
  return result.after;
}

export function revalidateArticle(kind: string, slug: string) {
  try {
    const base = kind === "news" ? "/tin-tuc" : "/kien-thuc";
    revalidatePath(`${base}/${slug}`);
    revalidatePath(base);
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
  } catch { /* gọi ngoài request (script) thì bỏ qua */ }
}

/**
 * Tác vụ xuất bản theo lịch: chạy lặp an toàn (idempotent) — chỉ xuất bản bài "scheduled" đã tới giờ,
 * dùng đúng bản đã duyệt. Bài đã xuất bản thì không bị đăng trùng (T06).
 */
export async function publishDue() {
  const db = await getDb();
  const due = await db.select({ id: schema.articles.id, reviewerId: schema.articles.reviewerId }).from(schema.articles)
    .where(and(eq(schema.articles.status, "scheduled"), lte(schema.articles.scheduledAt, new Date())));
  const out: { id: string; ok: boolean; error?: string }[] = [];
  for (const d of due) {
    try {
      // Xuất bản theo lịch đứng tên người duyệt đã lên lịch (không phải tài khoản AI)
      const [reviewer] = d.reviewerId ? await db.select().from(schema.users).where(eq(schema.users.id, d.reviewerId)) : [];
      if (!reviewer || reviewer.status !== "active") throw new Error("Người duyệt lên lịch không còn hoạt động");
      await transitionArticle({ id: reviewer.id, roles: reviewer.roles }, d.id, "publish");
      out.push({ id: d.id, ok: true });
    } catch (e) {
      out.push({ id: d.id, ok: false, error: (e as Error).message });
    }
  }
  return out;
}
