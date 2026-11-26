// Kiểm quyền cho TRANG quản trị (server component): chưa đăng nhập → /admin/login,
// thiếu quyền → /admin/forbidden (màn 065) thay vì ném lỗi trắng trang.
// Server Action vẫn dùng adminAction()/requireUser() trong src/lib/admin.ts.
import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./auth";
import { can, type Perm } from "./permissions";

export function canAny(roles: SessionUser["roles"] | undefined, perms: Perm | Perm[]): boolean {
  return (Array.isArray(perms) ? perms : [perms]).some((p) => can(roles, p));
}

export async function requirePage(perms?: Perm | Perm[]): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login?expired=1");
  if (perms && !canAny(u.roles, perms)) {
    redirect(`/admin/forbidden?need=${encodeURIComponent(Array.isArray(perms) ? perms.join(",") : perms)}`);
  }
  return u;
}

// ID trên URL phải là UUID (hoặc "new" khi trang cho phép tạo mới). Gõ sai ID → 404
// thay vì để Postgres ném "invalid input syntax for type uuid" thành lỗi 500.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireUuid(...ids: string[]): void {
  for (const id of ids) if (!UUID_RE.test(id)) notFound();
}
export function requireUuidOrNew(id: string): void {
  if (id !== "new") requireUuid(id);
}
