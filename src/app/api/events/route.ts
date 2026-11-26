// POST /api/events — ghi sự kiện đo lường. Loại trùng theo eventId. Không nhận nội dung form/CV.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { apiError, clientIp, sameOrigin, zodFieldErrors } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

const PUBLIC_EVENT_TYPES = ["marketplace_click", "consult_click", "selector_complete", "page_view"] as const;
const eventSchema = z.object({
  eventId: z.string().min(8).max(80),
  type: z.enum(PUBLIC_EVENT_TYPES),
  pagePath: z.string().max(300).default(""),
  pageType: z.string().max(40).default(""),
  entityId: z.string().max(80).optional(),
  variantId: z.string().max(80).optional(),
  channel: z.enum(["shopee", "tiktok"]).optional(),
  ctaType: z.string().max(40).optional(),
}).strict();

export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError(403, "bad_origin", "Yêu cầu không hợp lệ");
  if (!(await rateLimit("evt", clientIp(req), 300, 600))) return apiError(429, "rate_limited", "Quá nhiều sự kiện");
  let body: unknown = null;
  try { body = JSON.parse(await req.text()); } catch { /* sendBeacon có thể gửi rỗng */ }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return apiError(422, "validation_error", "Sự kiện không hợp lệ", zodFieldErrors(parsed.error));
  const e = parsed.data;
  const db = await getDb();
  await db.insert(schema.events).values({ ...e, pagePath: e.pagePath.split("?")[0] }).onConflictDoNothing({ target: schema.events.eventId });
  return new NextResponse(null, { status: 204 });
}
