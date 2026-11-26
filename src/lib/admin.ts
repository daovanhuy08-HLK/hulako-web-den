// Tiện ích cho Server Actions quản trị: kết quả thống nhất, bắt lỗi quyền/xung đột, không lộ stack trace.
import "server-only";
import { ZodError } from "zod";
import { ForbiddenError, requireUser, type SessionUser } from "./auth";
import type { Perm } from "./permissions";
import { WorkflowError } from "./workflow";

export type ActionResult = { ok: boolean; message: string; fieldErrors?: Record<string, string>; conflict?: boolean; redirect?: string };

export class ConflictError extends Error {
  constructor() { super("Dữ liệu đã được người khác thay đổi từ lúc bạn mở. Hãy tải bản mới rồi sửa tiếp."); }
}
export class UserError extends Error {}

export async function adminAction(perm: Perm, fn: (u: SessionUser) => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    const u = await requireUser(perm);
    return (await fn(u)) ?? { ok: true, message: "Đã lưu" };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    if (e instanceof ConflictError) return { ok: false, message: e.message, conflict: true };
    if (e instanceof UserError) return { ok: false, message: e.message };
    if (e instanceof WorkflowError) {
      return { ok: false, message: e.message, conflict: e.status === 409, fieldErrors: e.issues ? Object.fromEntries(e.issues.map((i, n) => [`${n}`, `${i.field}: “${i.match}” — ${i.hint}`])) : undefined };
    }
    if (e instanceof ZodError) {
      return { ok: false, message: "Dữ liệu chưa hợp lệ", fieldErrors: Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message])) };
    }
    console.error("[admin action]", e);
    return { ok: false, message: "Lỗi máy chủ, vui lòng thử lại" };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const lines = (fd: FormData, k: string) => str(fd, k).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
export const num = (fd: FormData, k: string, d = 0) => (Number.isFinite(Number(fd.get(k))) && fd.get(k) !== "" ? Number(fd.get(k)) : d);
