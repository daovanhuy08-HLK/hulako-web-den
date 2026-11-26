// Đăng nhập quản trị (màn 024), phiên hết hạn (060), khôi phục mật khẩu (051) và đặt mật khẩu mới (064).
// Dùng tham số ?mode=forgot|reset vì middleware chỉ cho phép /admin/login và /admin/setup khi chưa đăng nhập.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, schema } from "@/lib/db";
import { createSession, getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { createResetToken, resetEmailConfigured, resetLink, sendResetEmail, verifyResetToken, RESET_TTL_MIN } from "@/lib/admin-password";
import { LoginHeading, PasswordInput } from "@/components/admin/LoginBits";
import { Icon } from "@/components/admin/icons";
import "../admin.css";

export const metadata: Metadata = { title: "Đăng nhập quản trị", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!(await rateLimit("login", `${await ip()}:${email}`, 8, 900))) redirect("/admin/login?e=rate");
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  // So mật khẩu kể cả khi không có user để không lộ email nào tồn tại qua thời gian phản hồi
  const ok = await verifyPassword(password, u?.passwordHash ?? "scrypt$00$00");
  if (!u || !ok || u.status !== "active") redirect(`/admin/login?e=1${next !== "/admin" ? `&next=${encodeURIComponent(next)}` : ""}`);
  await createSession(u.id);
  await audit(u.id, "auth.login", "user", u.id);
  redirect(next.startsWith("/admin") ? next : "/admin");
}

/** 051: gửi link đặt lại qua email (nếu đã cấu hình). Luôn trả cùng một thông báo để không lộ email nào tồn tại. */
async function requestReset(fd: FormData) {
  "use server";
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!(await rateLimit("pwreset", `${await ip()}:${email}`, 5, 3600))) redirect("/admin/login?mode=forgot&e=rate");
  if (!resetEmailConfigured()) redirect("/admin/login?mode=forgot&noemail=1");
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (u && u.status === "active" && u.passwordHash !== "unset") {
    try {
      await sendResetEmail(u.email, resetLink(await createResetToken(u)));
      await audit(u.id, "auth.reset_request", "user", u.id);
    } catch { /* lỗi gửi không lộ ra ngoài */ }
  }
  redirect("/admin/login?mode=forgot&sent=1");
}

/** 064: đặt mật khẩu mới bằng token còn hạn; cập nhật có điều kiện mật khẩu cũ → token chỉ dùng được một lần */
async function doReset(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? "");
  const back = (e: string) => `/admin/login?mode=reset&token=${encodeURIComponent(token)}&e=${e}`;
  if (!(await rateLimit("pwreset-do", await ip(), 10, 900))) redirect(back("rate"));
  const pw = String(fd.get("password") ?? ""), pw2 = String(fd.get("password2") ?? "");
  if (pw.length < 10) redirect(back("short"));
  if (pw !== pw2) redirect(back("match"));
  const u = await verifyResetToken(token);
  if (!u) redirect("/admin/login?mode=reset&e=token");
  const db = await getDb();
  const [done] = await db.update(schema.users).set({ passwordHash: await hashPassword(pw) })
    .where(and(eq(schema.users.id, u.id), eq(schema.users.passwordHash, u.passwordHash))).returning({ id: schema.users.id });
  if (!done) redirect("/admin/login?mode=reset&e=token");
  await audit(u.id, "auth.reset_password", "user", u.id);
  redirect("/admin/login?reset=1");
}

const ERR: Record<string, string> = {
  "1": "Email hoặc mật khẩu không đúng.", rate: "Thử quá nhiều lần, vui lòng chờ rồi thử lại.", token: "Liên kết đặt lại không hợp lệ, đã dùng hoặc đã hết hạn. Hãy yêu cầu link mới.",
  short: "Mật khẩu tối thiểu 10 ký tự.", match: "Hai mật khẩu không khớp.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const mode = sp.mode === "forgot" ? "forgot" : sp.mode === "reset" ? "reset" : "login";
  if (mode === "login" && (await getSessionUser())) redirect("/admin");
  const resetUser = mode === "reset" ? await verifyResetToken(sp.token) : null;
  const Err = () => (sp.e ? <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FDECEC] p-3 text-sm font-medium text-[#7A1A1A]"><Icon name="alert" className="h-5 w-5 flex-none" />{ERR[sp.e] ?? "Có lỗi, thử lại."}</p> : null);

  return (
    <main className="adm-root grid min-h-screen lg:grid-cols-[minmax(0,0.42fr)_1fr]">
      <div className="relative hidden lg:block">
        <Image src="/images/hero-softbox.jpg" alt="Góc livestream với softbox và chân đỡ điện thoại" fill sizes="45vw" className="object-cover" priority />
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="card w-full max-w-[680px] space-y-6 p-6 shadow-card sm:p-12">
          <p className="text-center text-[44px] font-black leading-none tracking-tight text-brand">HULAKO</p>

          {mode === "login" && (
            <form action={login} className="space-y-5">
              <LoginHeading forceExpired={sp.expired === "1"} hasNext={!!sp.next} />
              {sp.reset && <p role="status" className="rounded-xl bg-[#E7F6EC] p-3 text-sm font-medium text-[#14532D]">Đã đặt mật khẩu mới. Đăng nhập bằng mật khẩu mới.</p>}
              <Err />
              <input type="hidden" name="next" value={sp.next ?? "/admin"} />
              <div><label htmlFor="email" className="mb-1.5 block text-lg font-semibold">Email</label>
                <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name="mail" /></span>
                  <input id="email" name="email" type="email" autoComplete="username" required className="input !min-h-[56px] pl-11" /></div></div>
              <div><label htmlFor="password" className="mb-1.5 block text-lg font-semibold">Mật khẩu</label><PasswordInput id="password" name="password" autoComplete="current-password" withIcon /></div>
              <button className="btn-primary !min-h-[56px] w-full text-lg">{sp.expired ? "Đăng nhập lại" : "Đăng nhập"}</button>
              <p className="text-center"><Link href="/admin/login?mode=forgot" className="text-lg font-semibold text-brand underline underline-offset-4">Quên mật khẩu</Link></p>
            </form>
          )}

          {mode === "forgot" && (
            <form action={requestReset} className="space-y-5">
              <div className="text-center"><h1 className="text-3xl font-extrabold">Khôi phục mật khẩu</h1><p className="mt-2 text-lg text-ink-soft">Nhập email quản trị để nhận hướng dẫn đặt lại mật khẩu.</p></div>
              {sp.sent && <p role="status" className="rounded-xl bg-[#E7F6EC] p-3 text-sm font-medium text-[#14532D]">Nếu email thuộc một tài khoản quản trị đang hoạt động, hướng dẫn đặt lại (hiệu lực {RESET_TTL_MIN} phút) đã được gửi. Kiểm tra hộp thư, kể cả mục Spam.</p>}
              {(sp.noemail || !resetEmailConfigured()) && <p role="status" className="rounded-xl bg-brand-tint p-3 text-sm font-medium">Hệ thống chưa cấu hình gửi email. Liên hệ <b>Quản trị hệ thống</b> để được tạo link đặt lại mật khẩu (Cài đặt → Tài khoản và quyền).</p>}
              <Err />
              <div><label htmlFor="f-email" className="mb-1.5 block text-lg font-semibold">Email</label><input id="f-email" name="email" type="email" autoComplete="username" required className="input !min-h-[56px]" /></div>
              <button className="btn-primary !min-h-[56px] w-full text-lg" disabled={!resetEmailConfigured()}>Gửi hướng dẫn</button>
              <Link href="/admin/login" className="btn-line !min-h-[56px] w-full text-lg">Về đăng nhập</Link>
            </form>
          )}

          {mode === "reset" && (
            resetUser ? (
              <form action={doReset} className="space-y-5">
                <div className="text-center"><h1 className="text-3xl font-extrabold">Đặt mật khẩu mới</h1><p className="mt-2 text-lg text-ink-soft">Nhập hai mật khẩu giống nhau để tiếp tục.</p><p className="mt-1 text-sm text-ink-muted">Tài khoản: {resetUser.email}</p></div>
                <Err />
                <input type="hidden" name="token" value={sp.token} />
                <div><label htmlFor="pw" className="mb-1.5 block text-lg font-semibold">Mật khẩu mới</label><PasswordInput id="pw" name="password" autoComplete="new-password" /><p className="mt-1 text-xs text-ink-muted">Tối thiểu 10 ký tự.</p></div>
                <div><label htmlFor="pw2" className="mb-1.5 block text-lg font-semibold">Nhập lại mật khẩu</label><PasswordInput id="pw2" name="password2" autoComplete="new-password" /></div>
                <button className="btn-primary !min-h-[56px] w-full text-lg">Lưu mật khẩu mới</button>
                <Link href="/admin/login" className="btn-line !min-h-[56px] w-full text-lg">Về đăng nhập</Link>
              </form>
            ) : (
              <div className="space-y-5 text-center">
                <h1 className="text-3xl font-extrabold">Liên kết không còn hiệu lực</h1>
                <p className="text-ink-soft">{ERR.token}</p>
                <Link href="/admin/login?mode=forgot" className="btn-primary !min-h-[56px] w-full text-lg">Yêu cầu link mới</Link>
                <Link href="/admin/login" className="btn-line !min-h-[56px] w-full text-lg">Về đăng nhập</Link>
              </div>
            )
          )}

          <div className="border-t border-line pt-5 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-lg text-ink-soft hover:text-brand-dark"><Icon name="external" /> Về website</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
