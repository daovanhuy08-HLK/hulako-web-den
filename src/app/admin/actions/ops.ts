"use server";
// Server Actions cho A06 Media, A07 Hỗ trợ, A08 Tuyển dụng
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { adminAction, ConflictError, lines, num, str, UserError } from "@/lib/admin";
import { saveMedia } from "@/lib/storage";
import { slugify } from "@/lib/text";
import { audit } from "@/lib/audit";
import { checkClaims } from "@/lib/guardrails";

// ---------- A06 Media ----------
export async function uploadMedia(fd: FormData) {
  return adminAction("media.edit", async (u) => {
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new UserError("Chọn ảnh để tải lên");
    const alt = str(fd, "alt");
    if (alt.length < 5) throw new UserError("Nhập alt mô tả nội dung ảnh (≥ 5 ký tự)");
    const m = await saveMedia(file, { alt, source: str(fd, "source"), usageRights: str(fd, "usageRights"), sku: str(fd, "sku") || undefined, tags: lines(fd, "tags"), uploadedBy: u.id });
    await audit(u.id, "media.upload", "media", m.id);
    return { ok: true, message: `Đã tải lên — chờ duyệt quyền sử dụng. URL: ${m.url}` };
  });
}

export async function updateMedia(fd: FormData) {
  return adminAction("media.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const op = str(fd, "op");
    if (op === "approve" || op === "archive") {
      const { can } = await import("@/lib/permissions");
      if (!can(u.roles, "media.approve")) throw new UserError("Cần quyền duyệt ảnh");
      const [m] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));
      if (op === "archive" && m) {
        // Hiển thị nơi đang tham chiếu trước khi lưu trữ
        const refs = await db.execute(sql`
          select 'variant' as t, sku as ref from variants where images::text like ${"%" + m.url + "%"}
          union all select 'revision', title from revisions where cover_url = ${m.url} or body like ${"%" + m.url + "%"}
          union all select 'setup', title from setups where cover_url = ${m.url} or diagram_url = ${m.url} limit 10`);
        const list = (Array.isArray(refs) ? refs : (refs as unknown as { rows: { t: string; ref: string }[] }).rows) as { t: string; ref: string }[];
        if (list.length && str(fd, "force") !== "1") throw new UserError(`Ảnh đang được dùng ở: ${list.map((r) => `${r.t} "${r.ref}"`).join(", ")}. Gỡ tham chiếu trước khi lưu trữ.`);
      }
      await db.update(schema.mediaAssets).set({ status: op === "approve" ? "approved" : "archived", approvedBy: u.id }).where(eq(schema.mediaAssets.id, id));
      await audit(u.id, `media.${op}`, "media", id);
      return { ok: true, message: op === "approve" ? "Đã duyệt ảnh" : "Đã lưu trữ ảnh" };
    }
    await db.update(schema.mediaAssets).set({ alt: str(fd, "alt"), sku: str(fd, "sku") || null, source: str(fd, "source"), usageRights: str(fd, "usageRights") }).where(eq(schema.mediaAssets.id, id));
    return { ok: true, message: "Đã lưu thông tin ảnh" };
  });
}

// ---------- A07 FAQ & hộp thư tư vấn ----------
export async function saveFaq(fd: FormData) {
  return adminAction("faq.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const values = {
      question: str(fd, "question"), answer: str(fd, "answer"), topic: str(fd, "topic") || "chung", deviceType: str(fd, "deviceType"),
      productId: str(fd, "productId") || null, articleSlug: str(fd, "articleSlug") || null, sortOrder: num(fd, "sortOrder"),
      status: str(fd, "status") === "hidden" ? "hidden" : "public",
    };
    if (values.question.length < 5 || values.answer.length < 5) throw new UserError("Nhập câu hỏi và câu trả lời");
    const issues = checkClaims({ question: values.question, answer: values.answer });
    if (issues.length && values.status === "public") throw new UserError(`Claim bị chặn: ${issues.map((i) => `“${i.match}” — ${i.hint}`).join("; ")}`);
    if (id) await db.update(schema.faqs).set(values).where(eq(schema.faqs.id, id));
    else await db.insert(schema.faqs).values(values);
    await audit(u.id, "faq.save", "faq", id || null);
    revalidatePath("/ho-tro"); revalidatePath("/");
    return { ok: true, message: "Đã lưu câu hỏi" };
  });
}

export async function updateLead(fd: FormData) {
  return adminAction("lead.view", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [l] = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
    if (!l) throw new UserError("Không tìm thấy yêu cầu");
    // Tư vấn viên chỉ xử lý yêu cầu được phân công cho mình (quản trị xử lý mọi yêu cầu)
    if (!u.roles.includes("admin") && l.assigneeId && l.assigneeId !== u.id) throw new UserError("Yêu cầu này đang được phân công cho người khác");
    const status = str(fd, "status");
    const assigneeId = str(fd, "assigneeId") || null;
    const note = str(fd, "note");
    const now = new Date().toISOString();
    const history = [...l.history];
    if (status && status !== l.status) history.push({ at: now, by: u.id, status });
    if (assigneeId !== l.assigneeId) history.push({ at: now, by: u.id, note: `Phân công: ${assigneeId ?? "bỏ phân công"}` });
    await db.update(schema.leads).set({
      status: status || l.status, assigneeId, history,
      notes: note ? [...l.notes, { at: now, by: u.name || u.email, note }] : l.notes,
    }).where(eq(schema.leads.id, id));
    return { ok: true, message: "Đã cập nhật yêu cầu" };
  });
}

/** Xoá dữ liệu cá nhân theo yêu cầu của khách (quyền truy cập/xoá) */
export async function eraseLead(fd: FormData) {
  return adminAction("lead.view", async (u) => {
    if (!u.roles.includes("admin")) throw new UserError("Chỉ Quản trị hệ thống được xoá dữ liệu cá nhân");
    const db = await getDb();
    const id = str(fd, "id");
    await db.delete(schema.leads).where(eq(schema.leads.id, id));
    await audit(u.id, "lead.erase", "lead", id);
    return { ok: true, message: "Đã xoá yêu cầu và dữ liệu cá nhân", redirect: "/admin/support" };
  });
}

// ---------- A08 Tuyển dụng ----------
export async function saveJob(fd: FormData) {
  return adminAction("job.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const title = str(fd, "title");
    if (title.length < 3) throw new UserError("Nhập tên vị trí");
    const status = ["draft", "open", "closed"].includes(str(fd, "status")) ? str(fd, "status") : "draft";
    const values = {
      title, slug: slugify(str(fd, "slug") || title), location: str(fd, "location"), employmentType: str(fd, "employmentType") || "Toàn thời gian",
      deadline: str(fd, "deadline") || null, description: str(fd, "description"), requirements: str(fd, "requirements"), benefits: str(fd, "benefits"), status,
      department: str(fd, "department"), isSample: fd.get("isSample") === "on",
    };
    if (id) {
      const [cur] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
      if (!cur) throw new UserError("Không tìm thấy tin");
      if (cur.version !== num(fd, "version")) throw new ConflictError();
      await db.update(schema.jobs).set({ ...values, version: cur.version + 1, publishedAt: status === "open" ? cur.publishedAt ?? new Date() : cur.publishedAt }).where(eq(schema.jobs.id, id));
    } else {
      await db.insert(schema.jobs).values({ ...values, publishedAt: status === "open" ? new Date() : null });
    }
    await audit(u.id, "job.save", "job", id || null, { status });
    revalidatePath("/tuyen-dung"); revalidatePath(`/tuyen-dung/${values.slug}`);
    return { ok: true, message: "Đã lưu tin tuyển dụng", redirect: "/admin/recruitment" };
  });
}

export async function updateApplication(fd: FormData) {
  return adminAction("application.view", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [a] = await db.select().from(schema.applications).where(eq(schema.applications.id, id));
    if (!a) throw new UserError("Không tìm thấy hồ sơ");
    const status = str(fd, "status"), note = str(fd, "note"), now = new Date().toISOString();
    await db.update(schema.applications).set({
      status: status || a.status,
      history: status && status !== a.status ? [...a.history, { at: now, by: u.id, status }] : a.history,
      notes: note ? [...a.notes, { at: now, by: u.name || u.email, note }] : a.notes,
    }).where(eq(schema.applications.id, id));
    return { ok: true, message: "Đã cập nhật hồ sơ" };
  });
}

export async function eraseApplication(fd: FormData) {
  return adminAction("application.view", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const [a] = await db.select().from(schema.applications).where(eq(schema.applications.id, id));
    if (!a) throw new UserError("Không tìm thấy hồ sơ");
    await db.transaction(async (tx) => {
      await tx.delete(schema.applications).where(and(eq(schema.applications.id, id)));
      await tx.delete(schema.privateFiles).where(eq(schema.privateFiles.id, a.cvFileId)); // xoá cả tệp CV
    });
    await audit(u.id, "application.erase", "application", id);
    return { ok: true, message: "Đã xoá hồ sơ và CV", redirect: "/admin/recruitment?tab=applications" };
  });
}
