// POST /api/admin/content/{id}/transitions — đổi trạng thái bài (mục 09). Kiểm vai trò + trạng thái, ghi audit.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { apiError, sameOrigin, zodFieldErrors } from "@/lib/api";
import { transitionArticle, WorkflowError } from "@/lib/workflow";
import { parseVNLocal } from "@/lib/text";

const body = z.object({
  action: z.enum(["submit", "request_changes", "approve", "schedule", "publish", "unpublish", "archive", "restore"]),
  revisionId: z.string().uuid().optional(),
  scheduledAt: z.string().optional(), // "YYYY-MM-DDTHH:mm" giờ Việt Nam hoặc ISO
  reason: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sameOrigin(req)) return apiError(403, "bad_origin", "Yêu cầu không hợp lệ");
  const user = await getSessionUser();
  if (!user) return apiError(401, "unauthenticated", "Cần đăng nhập");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "validation_error", "Dữ liệu không hợp lệ", zodFieldErrors(parsed.error));
  const d = parsed.data;
  const scheduledAt = d.scheduledAt ? parseVNLocal(d.scheduledAt) ?? new Date(d.scheduledAt) : null;
  try {
    const a = await transitionArticle(user, id, d.action, { revisionId: d.revisionId, scheduledAt, reason: d.reason });
    return NextResponse.json({ id: a.id, status: a.status, version: a.version, scheduledAt: a.scheduledAt });
  } catch (e) {
    if (e instanceof WorkflowError) {
      const fe = e.issues ? Object.fromEntries(e.issues.map((i, n) => [`${i.field}#${n}`, `${i.hint} (“${i.match}”)`])) : undefined;
      return apiError(e.status, e.code, e.message, fe);
    }
    return apiError(500, "server_error", "Lỗi máy chủ");
  }
}
