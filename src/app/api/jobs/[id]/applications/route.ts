// POST /api/jobs/{id}/applications — nộp CV (P12). Kiểm tin còn mở NGAY KHI GHI, kiểm loại tệp thật và kích thước.
import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { apiError, clientIp, sameOrigin, zodFieldErrors } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { genCode } from "@/lib/text";
import { getSetting } from "@/lib/settings";
import { CV_MAX_BYTES, sniffDocument } from "@/lib/storage";
import { applicationSchema } from "@/lib/validators";
import { isJobOpen } from "@/lib/queries";
import { notifyApplication } from "@/lib/notify";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sameOrigin(req)) return apiError(403, "bad_origin", "Yêu cầu không hợp lệ");
  if (!(await rateLimit("apply", clientIp(req), 5, 3600))) return apiError(429, "rate_limited", "Bạn đã gửi nhiều hồ sơ, vui lòng thử lại sau");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > CV_MAX_BYTES + 200_000) return apiError(413, "too_large", `CV tối đa ${CV_MAX_BYTES / 1024 / 1024} MB`);

  const form = await req.formData().catch(() => null);
  if (!form) return apiError(422, "validation_error", "Dữ liệu gửi lên không hợp lệ");
  const parsed = applicationSchema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return apiError(422, "validation_error", "Thông tin chưa hợp lệ", zodFieldErrors(parsed.error));
  const file = form.get("cv");
  if (!(file instanceof File) || file.size === 0) return apiError(422, "validation_error", "Vui lòng đính kèm CV", { cv: "Vui lòng đính kèm CV (PDF hoặc DOCX)" });
  if (file.size > CV_MAX_BYTES) return apiError(422, "validation_error", "CV quá lớn", { cv: `CV tối đa ${CV_MAX_BYTES / 1024 / 1024} MB` });
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffDocument(buf);
  if (!mime) return apiError(422, "validation_error", "Định dạng CV không hợp lệ", { cv: "Chỉ nhận tệp PDF hoặc DOCX" });

  const consent = await getSetting("consent");
  const db = await getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const [job] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, id)).for("share");
      if (!job) return { error: apiError(404, "not_found", "Không tìm thấy vị trí tuyển dụng") };
      if (!isJobOpen(job)) return { error: apiError(409, "job_closed", "Vị trí này đã đóng, không nhận hồ sơ mới") };
      const [f] = await tx.insert(schema.privateFiles).values({
        filename: file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120), mime, size: buf.length, data: buf,
      }).returning({ id: schema.privateFiles.id });
      const d = parsed.data;
      const [app] = await tx.insert(schema.applications).values({
        code: genCode("UV"), jobId: job.id, name: d.name, email: d.email || null, phone: d.phone || null, note: d.note,
        cvFileId: f.id, consent: true, consentVersion: consent.version,
        retainUntil: new Date(Date.now() + consent.retentionDaysApplication * 86400_000),
        history: [{ at: new Date().toISOString(), status: "new", note: "Ứng viên nộp hồ sơ" }],
      }).returning();
      await tx.insert(schema.events).values({ eventId: `apply:${app.id}`, type: "job_apply", pagePath: `/tuyen-dung/${job.slug}`, pageType: "job", entityId: job.id });
      return { app, job };
    });
    if ("error" in result) return result.error;
    after(() => notifyApplication(result.app.code, result.job.title));
    return NextResponse.json({ code: result.app.code }, { status: 201 });
  } catch (e) {
    return apiError(500, "server_error", `Không lưu được hồ sơ: ${(e as Error).message}`);
  }
}

export async function GET() {
  return apiError(405, "method_not_allowed", "Chỉ hỗ trợ POST");
}

// Bảo đảm route chạy Node (cần Buffer, transaction)
export const runtime = "nodejs";
