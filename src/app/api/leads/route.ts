// POST /api/leads — tiếp nhận yêu cầu tư vấn (P10). Cùng khoá + cùng dữ liệu => cùng mã (T04).
import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { apiError, clientIp, sameOrigin, zodFieldErrors } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { genCode, sha256 } from "@/lib/text";
import { getSetting } from "@/lib/settings";
import { notifyLead } from "@/lib/notify";
import { leadSchema, magnetLeadSchema } from "@/lib/validators";
import { sniffImage } from "@/lib/storage";

const PHOTO_MAX = 5 * 1024 * 1024;

/** Nhận JSON, hoặc multipart (trường "payload" JSON + tệp "photo" — ảnh phòng tuỳ chọn, mục P10) */
async function readBody(req: Request): Promise<{ body: unknown; photo: File | null }> {
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    if (!fd) return { body: null, photo: null };
    const f = fd.get("photo");
    let body: unknown = null;
    try { body = JSON.parse(String(fd.get("payload") ?? "")); } catch { body = null; }
    return { body, photo: f instanceof File && f.size > 0 ? f : null };
  }
  return { body: await req.json().catch(() => null), photo: null };
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError(403, "bad_origin", "Yêu cầu không hợp lệ");
  if (!(await rateLimit("lead", clientIp(req), 8, 600))) return apiError(429, "rate_limited", "Bạn gửi quá nhanh, vui lòng thử lại sau ít phút");
  if (Number(req.headers.get("content-length") ?? 0) > PHOTO_MAX + 100_000) return apiError(413, "too_large", "Ảnh phòng tối đa 5 MB", { photo: "Ảnh phòng tối đa 5 MB" });
  const { body, photo } = await readBody(req);
  const parsed = await parseLead(body);
  if (!parsed.success) return apiError(422, "validation_error", "Thông tin chưa hợp lệ", parsed.fieldErrors);
  const d = parsed.data;
  if (d.website) return NextResponse.json({ code: genCode("TV") }, { status: 201 }); // bot điền ô ẩn: giả vờ thành công
  const payloadHash = sha256(JSON.stringify([d.name, d.email, d.phone, d.topic, d.message, d.businessField, d.shippingAddress]));
  const db = await getDb();

  const [existing] = await db.select().from(schema.leads).where(eq(schema.leads.idempotencyKey, d.idempotencyKey));
  if (existing) {
    if (existing.payloadHash !== payloadHash) return apiError(409, "idempotency_conflict", "Khoá gửi đã dùng cho nội dung khác");
    return NextResponse.json({ code: existing.code, ...(await magnetExtra(d.source)) }, { status: 201 });
  }
  let photoBuf: Buffer | null = null, photoMime: string | null = null;
  if (photo) {
    if (photo.size > PHOTO_MAX) return apiError(422, "validation_error", "Ảnh phòng quá lớn", { photo: "Ảnh phòng tối đa 5 MB" });
    photoBuf = Buffer.from(await photo.arrayBuffer());
    photoMime = sniffImage(photoBuf);
    if (!photoMime) return apiError(422, "validation_error", "Ảnh phòng không hợp lệ", { photo: "Chỉ nhận ảnh JPG, PNG hoặc WEBP" });
  }
  const consent = await getSetting("consent");
  const context: Record<string, unknown> = Object.fromEntries(
    Object.entries(d.context).slice(0, 20).map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 500) : v]),
  );
  // Ảnh phòng lưu trong kho tệp riêng tư (không vào thư viện công khai) — chỉ tư vấn viên/quản trị xem qua /api/admin/lead-photo
  delete context.roomPhotoId;
  if (photoBuf && photoMime) {
    const [f] = await db.insert(schema.privateFiles).values({ filename: `phong-${Date.now()}.${photoMime.split("/")[1]}`, mime: photoMime, size: photoBuf.length, data: photoBuf }).returning({ id: schema.privateFiles.id });
    context.roomPhotoId = f.id;
  }
  const [lead] = await db.insert(schema.leads).values({
    code: genCode("TV"), idempotencyKey: d.idempotencyKey, payloadHash, name: d.name, email: d.email || null, phone: d.phone || null,
    businessField: d.businessField || null, shippingAddress: d.shippingAddress || null,
    topic: d.topic, message: d.message, context, source: d.source, consent: true, consentVersion: consent.version,
    retainUntil: new Date(Date.now() + consent.retentionDaysLead * 86400_000),
    history: [{ at: new Date().toISOString(), status: "new", note: "Khách gửi yêu cầu" }],
  }).onConflictDoNothing({ target: schema.leads.idempotencyKey }).returning();
  if (!lead) {
    const [again] = await db.select().from(schema.leads).where(eq(schema.leads.idempotencyKey, d.idempotencyKey));
    return NextResponse.json({ code: again.code, ...(await magnetExtra(d.source)) }, { status: 201 });
  }
  // lead_submit chỉ ghi SAU khi lưu thành công (mục 11)
  await db.insert(schema.events).values({
    eventId: `lead:${lead.id}`, type: "lead_submit", pagePath: String(context.page ?? ""), pageType: d.source,
    entityId: context.entityId ? String(context.entityId) : null,
  }).onConflictDoNothing();
  // Thông báo nhân viên chạy sau khi đã trả phản hồi — email lỗi không ảnh hưởng hồ sơ đã lưu
  after(() => notifyLead(lead.id));
  return NextResponse.json({ code: lead.code, ...(await magnetExtra(d.source)) }, { status: 201 });
}

type LeadInput = ReturnType<typeof leadSchema.parse> & { businessField?: string; shippingAddress?: string };

/** Popup quà tặng dùng schema riêng (đủ 5 trường bắt buộc); các form khác dùng leadSchema */
async function parseLead(body: unknown): Promise<{ success: true; data: LeadInput } | { success: false; fieldErrors: Record<string, string> }> {
  if ((body as { source?: unknown } | null)?.source === "lead_magnet") {
    const r = magnetLeadSchema.safeParse(body);
    if (!r.success) return { success: false, fieldErrors: zodFieldErrors(r.error) };
    const m = await getSetting("leadMagnet");
    const d = r.data;
    return { success: true, data: {
      ...d, topic: m.title.slice(0, 60),
      message: `Đăng ký nhận quà: ${m.title}
Lĩnh vực kinh doanh: ${d.businessField}
Địa chỉ nhận hàng: ${d.shippingAddress}`,
    } };
  }
  const r = leadSchema.safeParse(body);
  return r.success ? { success: true, data: r.data } : { success: false, fieldErrors: zodFieldErrors(r.error) };
}

/** Lead magnet: link tải ebook chỉ trả về SAU khi đã lưu thông tin khách (không lộ sẵn trong trang) */
async function magnetExtra(source: string): Promise<{ downloadUrl?: string }> {
  if (source !== "lead_magnet") return {};
  const m = await getSetting("leadMagnet");
  return m.downloadUrl ? { downloadUrl: m.downloadUrl } : {};
}
