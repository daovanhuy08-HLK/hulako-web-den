"use server";
// Server Actions cho A03 Nội dung
import { and, eq, max, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { adminAction, ConflictError, lines, str, UserError } from "@/lib/admin";
import { transitionArticle, type Transition } from "@/lib/workflow";
import { checkClaims } from "@/lib/guardrails";
import { parseVNLocal, slugify } from "@/lib/text";
import { audit } from "@/lib/audit";

/** Lưu bản nháp. Sửa bài đang công khai → tạo revision nháp mới, bản công khai giữ nguyên. Đổi slug → tạo 301. */
export async function saveArticle(fd: FormData) {
  return adminAction("content.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const expected = Number(fd.get("version") ?? 0);
    const title = str(fd, "title");
    if (title.length < 5) throw new UserError("Tiêu đề quá ngắn");
    const kind = str(fd, "kind") === "news" ? "news" : "guide";
    const slug = slugify(str(fd, "slug") || title);
    const revFields = {
      title, summary: str(fd, "summary"), body: str(fd, "body"), seoTitle: str(fd, "seoTitle"), seoDescription: str(fd, "seoDescription"),
      coverUrl: str(fd, "coverUrl") || null, coverAlt: str(fd, "coverAlt"),
      relatedProductIds: fd.getAll("relatedProductIds").map(String), relatedSetupIds: fd.getAll("relatedSetupIds").map(String),
      factChecks: lines(fd, "factChecks"),
    };
    const meta = { kind, slug, topicId: str(fd, "topicId") || null, targetKeyword: str(fd, "targetKeyword"), featured: fd.get("featured") === "on", isSample: fd.get("isSample") === "on" };

    const [dup] = await db.select({ id: schema.articles.id }).from(schema.articles)
      .where(and(eq(schema.articles.kind, kind), eq(schema.articles.slug, slug), ...(id ? [ne(schema.articles.id, id)] : [])));
    if (dup) throw new UserError(`Slug "${slug}" đã được dùng cho bài khác`);

    if (!id) {
      const newId = await db.transaction(async (tx) => {
        const [a] = await tx.insert(schema.articles).values({ ...meta, status: "draft", authorId: u.id }).returning();
        const [r] = await tx.insert(schema.revisions).values({ ...revFields, articleId: a.id, number: 1, createdBy: u.id }).returning();
        await tx.update(schema.articles).set({ draftRevisionId: r.id }).where(eq(schema.articles.id, a.id));
        return a.id;
      });
      await audit(u.id, "article.create", "article", newId);
      if (str(fd, "then") === "submit") {
        await transitionArticle(u, newId, "submit");
        return { ok: true, message: "Đã tạo bản nháp và gửi duyệt", redirect: `/admin/content/${newId}` };
      }
      return { ok: true, message: "Đã tạo bản nháp", redirect: `/admin/content/${newId}` };
    }

    await db.transaction(async (tx) => {
      const [a] = await tx.select().from(schema.articles).where(eq(schema.articles.id, id)).for("update");
      if (!a) throw new UserError("Không tìm thấy bài");
      if (a.version !== expected) throw new ConflictError();
      const [{ n }] = await tx.select({ n: max(schema.revisions.number) }).from(schema.revisions).where(eq(schema.revisions.articleId, id));
      const [r] = await tx.insert(schema.revisions).values({ ...revFields, articleId: id, number: (n ?? 0) + 1, createdBy: u.id }).returning();
      // Bản nào đang chờ duyệt/đã duyệt mà bị sửa → quay về Nháp để duyệt lại
      await tx.update(schema.articles).set({
        ...meta, draftRevisionId: r.id, status: a.status === "archived" ? "archived" : "draft", approvedRevisionId: null, scheduledAt: null,
        version: a.version + 1, updatedAt: new Date(),
      }).where(eq(schema.articles.id, id));
      // Đổi slug bài đã công khai → lưu URL cũ vào bảng chuyển hướng 301, gộp chuỗi chuyển hướng
      if (a.publishedRevisionId && a.slug !== slug) {
        const base = a.kind === "news" ? "/tin-tuc" : "/kien-thuc";
        const from = `${base}/${a.slug}`, to = `${base}/${slug}`;
        await tx.update(schema.redirects).set({ toPath: to }).where(eq(schema.redirects.toPath, from));
        await tx.delete(schema.redirects).where(eq(schema.redirects.fromPath, to));
        await tx.insert(schema.redirects).values({ fromPath: from, toPath: to }).onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: to } });
      }
    });
    await audit(u.id, "article.save", "article", id, { slug });
    // Nút "Gửi duyệt" trên thanh tiêu đề: lưu bản đang nhập rồi gửi duyệt luôn (kiểm claim trong workflow)
    if (str(fd, "then") === "submit") {
      await transitionArticle(u, id, "submit");
      return { ok: true, message: "Đã lưu và gửi duyệt" };
    }
    const issues = checkClaims({ title, body: revFields.body, seoTitle: revFields.seoTitle, seoDescription: revFields.seoDescription, coverAlt: revFields.coverAlt, summary: revFields.summary });
    return { ok: true, message: issues.length ? `Đã lưu nháp — còn ${issues.length} claim bị chặn cần sửa trước khi gửi duyệt` : "Đã lưu bản nháp" };
  });
}

export async function transition(fd: FormData) {
  return adminAction("content.edit", async (u) => {
    const action = str(fd, "action") as Transition;
    const id = str(fd, "id");
    const at = str(fd, "scheduledAt");
    const after = await transitionArticle(u, id, action, {
      revisionId: str(fd, "revisionId") || undefined,
      scheduledAt: at ? parseVNLocal(at) : null,
      reason: str(fd, "reason") || undefined,
    });
    const labels: Record<string, string> = { review: "Đã gửi duyệt", draft: "Đã chuyển về Nháp", approved: "Đã duyệt", scheduled: "Đã lên lịch", published: "Đã xuất bản", archived: "Đã lưu trữ" };
    if (action === "publish" || action === "unpublish") {
      const { revalidateArticle } = await import("@/lib/workflow");
      revalidateArticle(after.kind, after.slug);
    }
    return { ok: true, message: labels[after.status] ?? "Đã cập nhật" };
  });
}

export async function deleteDraftArticle(fd: FormData) {
  return adminAction("content.review", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [a] = await db.select().from(schema.articles).where(eq(schema.articles.id, id));
    if (!a) throw new UserError("Không tìm thấy bài");
    if (a.publishedRevisionId) throw new UserError("Bài đã từng công khai — hãy dùng Lưu trữ thay vì xoá");
    await db.transaction(async (tx) => {
      await tx.update(schema.opportunities).set({ draftArticleId: null, status: "open" }).where(eq(schema.opportunities.draftArticleId, id));
      await tx.update(schema.articles).set({ draftRevisionId: null, approvedRevisionId: null }).where(eq(schema.articles.id, id));
      await tx.delete(schema.revisions).where(eq(schema.revisions.articleId, id));
      await tx.delete(schema.articles).where(eq(schema.articles.id, id));
    });
    await audit(u.id, "article.delete", "article", id);
    return { ok: true, message: "Đã xoá bản nháp", redirect: "/admin/content" };
  });
}
