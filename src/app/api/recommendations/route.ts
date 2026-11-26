// POST /api/recommendations — gợi ý theo bảng quy tắc. Chạy lại KHÔNG tạo yêu cầu tư vấn.
import { NextResponse } from "next/server";
import { apiError, clientIp, zodFieldErrors } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { recommend, recommendInput } from "@/lib/recommend";

export async function POST(req: Request) {
  if (!(await rateLimit("rec", clientIp(req), 60, 600))) return apiError(429, "rate_limited", "Bạn thử quá nhiều lần, vui lòng chờ chút");
  const parsed = recommendInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "validation_error", "Vui lòng chọn đủ thông tin", zodFieldErrors(parsed.error));
  return NextResponse.json(await recommend(parsed.data), { headers: { "Cache-Control": "no-store" } });
}
