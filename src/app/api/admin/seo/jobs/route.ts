// POST /api/admin/seo/jobs — tạo tác vụ SEO/AI, trả 202 + jobId (mục 09). Theo dõi ở /admin/seo.
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { apiError, sameOrigin, zodFieldErrors } from "@/lib/api";
import { enqueue, runJob, JOB_TYPES, type JobType } from "@/lib/ai/jobs";

export const maxDuration = 300;

const body = z.object({
  type: z.enum(Object.keys(JOB_TYPES) as [JobType, ...JobType[]]),
  scope: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError(403, "bad_origin", "Yêu cầu không hợp lệ");
  const user = await getSessionUser();
  if (!user) return apiError(401, "unauthenticated", "Cần đăng nhập");
  if (!can(user.roles, "seo.run_ai")) return apiError(403, "forbidden", "Thiếu quyền chạy tác vụ AI");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "validation_error", "Dữ liệu không hợp lệ", zodFieldErrors(parsed.error));
  const { type, scope } = parsed.data;
  const key = parsed.data.idempotencyKey ?? (type === "write_draft" ? String(scope.opportunityId) : randomUUID());
  const { job, created } = await enqueue(type, scope, key, user.id);
  if (created) after(() => runJob(job.id));
  return NextResponse.json({ jobId: job.id, status: job.status, created }, { status: 202 });
}
