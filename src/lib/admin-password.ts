// Luồng đặt lại mật khẩu quản trị (màn 051, 064) — token JWT ký bằng SESSION_SECRET, hết hạn 30 phút,
// gắn "dấu vân tay" của mật khẩu hiện tại → dùng xong (đổi mật khẩu) là token tự hết tác dụng, không cần bảng mới.
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { sessionSecret } from "./auth";
import { sha256 } from "./text";
import { SITE_URL } from "./settings";

const TTL_MIN = 30;
const fingerprint = (passwordHash: string) => sha256(`pwreset:${passwordHash}`).slice(0, 24);

export const RESET_TTL_MIN = TTL_MIN;

export async function createResetToken(user: { id: string; passwordHash: string }): Promise<string> {
  return new SignJWT({ purpose: "pwreset", fp: fingerprint(user.passwordHash) })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime(`${TTL_MIN}m`)
    .sign(sessionSecret());
}

export function resetLink(token: string) {
  return `${SITE_URL}/admin/login?mode=reset&token=${encodeURIComponent(token)}`;
}

/** Trả user nếu token hợp lệ, chưa hết hạn, chưa dùng và tài khoản còn hoạt động */
export async function verifyResetToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.purpose !== "pwreset" || !payload.sub) return null;
    const db = await getDb();
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub));
    if (!u || u.status !== "active" || fingerprint(u.passwordHash) !== payload.fp) return null;
    return u;
  } catch {
    return null;
  }
}

export function resetEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Gửi email chứa link đặt lại qua Resend. Thiếu cấu hình → ném "not_configured". */
export async function sendResetEmail(to: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("not_configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTIFY_EMAIL_FROM ?? "HULAKO Website <onboarding@resend.dev>",
      to: [to],
      subject: "[HULAKO] Đặt lại mật khẩu quản trị",
      text: `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu trang quản trị HULAKO.\n\nMở liên kết sau trong ${TTL_MIN} phút để đặt mật khẩu mới:\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`resend_${res.status}`);
}
