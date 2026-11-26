// Xác thực quản trị: mật khẩu băm scrypt, phiên là JWT ký HS256 trong cookie httpOnly.
// Mỗi request vẫn đọc lại user từ DB -> khoá tài khoản/đổi quyền có hiệu lực ngay.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { can, type Perm } from "./permissions";
import type { Role } from "./db/schema";

export { hashPassword, verifyPassword } from "./auth-core";
export const SESSION_COOKIE = "hlk_admin";
const MAX_AGE = 60 * 60 * 12; // 12 giờ

export function sessionSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET phải dài ≥ 32 ký tự");
    return new TextEncoder().encode("dev-only-secret-change-me-0123456789abcdef");
  }
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(sessionSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type SessionUser = { id: string; email: string; name: string; roles: Role[] };

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!payload.sub) return null;
    const db = await getDb();
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub));
    if (!u || u.status !== "active") return null;
    return { id: u.id, email: u.email, name: u.name, roles: u.roles };
  } catch {
    return null;
  }
}

export class ForbiddenError extends Error {
  constructor(public perm: string) { super(`Bạn không có quyền thực hiện thao tác này (${perm}).`); }
}

/** Dùng trong trang/Server Action: chưa đăng nhập -> về /admin/login; thiếu quyền -> ForbiddenError */
export async function requireUser(perm?: Perm): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login");
  if (perm && !can(u.roles, perm)) throw new ForbiddenError(perm);
  return u;
}
