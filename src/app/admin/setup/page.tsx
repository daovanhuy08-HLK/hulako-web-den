// Thiết lập mật khẩu admin lần đầu trên production.
// Chỉ hoạt động khi: có SETUP_TOKEN đúng trong URL + tài khoản admin đầu tiên CHƯA có mật khẩu.
// Đặt xong là trang tự vô hiệu (token không còn tác dụng).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { Logo } from "@/components/site/Logo";

export const metadata: Metadata = { title: "Thiết lập quản trị", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UNSET_PASSWORD = "unset";

function tokenOk(t: string | undefined): boolean {
  const s = process.env.SETUP_TOKEN;
  if (!s || !t || s.length < 24) return false;
  const a = Buffer.from(s), b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function pendingAdmin() {
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.passwordHash, UNSET_PASSWORD)).limit(1);
  return u ?? null;
}

async function setup(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!(await rateLimit("setup", ip, 10, 900))) redirect(`/admin/setup?token=${encodeURIComponent(token)}&e=rate`);
  if (!tokenOk(token)) redirect("/admin/setup?e=token");
  const pw = String(fd.get("password") ?? ""), pw2 = String(fd.get("password2") ?? "");
  if (pw.length < 10) redirect(`/admin/setup?token=${encodeURIComponent(token)}&e=short`);
  if (pw !== pw2) redirect(`/admin/setup?token=${encodeURIComponent(token)}&e=match`);
  const u = await pendingAdmin();
  if (!u) redirect("/admin/login");
  const db = await getDb();
  // Điều kiện passwordHash = "unset" trong WHERE: chỉ một request đặt được mật khẩu
  const [done] = await db.update(schema.users).set({ passwordHash: await hashPassword(pw) })
    .where(eq(schema.users.passwordHash, UNSET_PASSWORD)).returning({ id: schema.users.id });
  if (!done) redirect("/admin/login");
  await audit(done.id, "auth.setup_password", "user", done.id);
  await createSession(done.id);
  redirect("/admin");
}

const ERR: Record<string, string> = {
  token: "Liên kết thiết lập không hợp lệ.", short: "Mật khẩu tối thiểu 10 ký tự.", match: "Hai mật khẩu không khớp.", rate: "Thử quá nhiều lần, chờ 15 phút.",
};

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const u = await pendingAdmin();
  if (!u) redirect("/admin/login"); // đã thiết lập rồi → trang này không còn tác dụng
  const valid = tokenOk(sp.token);
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        <Logo />
        <h1 className="text-xl font-bold">Đặt mật khẩu quản trị</h1>
        {!valid ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Liên kết thiết lập không hợp lệ hoặc thiếu mã.</p>
        ) : (
          <form action={setup} className="space-y-4">
            <p className="text-sm text-neutral-600">Tài khoản: <b>{u.email}</b></p>
            {sp.e && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{ERR[sp.e] ?? "Có lỗi, thử lại."}</p>}
            <input type="hidden" name="token" value={sp.token} />
            <div><label htmlFor="pw" className="label">Mật khẩu mới (≥ 10 ký tự)</label><input id="pw" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" /></div>
            <div><label htmlFor="pw2" className="label">Nhập lại mật khẩu</label><input id="pw2" name="password2" type="password" autoComplete="new-password" minLength={10} required className="input" /></div>
            <button className="btn-primary w-full">Lưu & đăng nhập</button>
            <p className="text-xs text-neutral-500">Trang này chỉ dùng được một lần. Đặt xong, liên kết sẽ hết tác dụng.</p>
          </form>
        )}
      </div>
    </main>
  );
}
