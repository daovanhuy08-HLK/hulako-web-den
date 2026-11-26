"use server";
// A02 Trang & công ty, A10 Cài đặt (người dùng, vai trò)
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { adminAction, lines, str, UserError } from "@/lib/admin";
import { getSetting, setSetting } from "@/lib/settings";
import { hashPassword } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { checkClaims } from "@/lib/guardrails";

export async function saveCompany(fd: FormData) {
  return adminAction("pages.edit", async (u) => {
    const cur = await getSetting("company");
    const next = {
      ...cur, brand: str(fd, "brand"), slogan: str(fd, "slogan"), legalName: str(fd, "legalName"), taxCode: str(fd, "taxCode"),
      address: str(fd, "address"), email: str(fd, "email"), phone: str(fd, "phone") || undefined, founder: str(fd, "founder"),
      aboutIntro: str(fd, "aboutIntro"), aboutWhy: str(fd, "aboutWhy"), trademarkNote: str(fd, "trademarkNote"),
      mission: { text: str(fd, "mission"), approved: fd.get("missionApproved") === "on" },
      vision: { text: str(fd, "vision"), approved: fd.get("visionApproved") === "on" },
      values: { items: lines(fd, "values"), approved: fd.get("valuesApproved") === "on" },
    };
    const issues = checkClaims({ intro: next.aboutIntro, why: next.aboutWhy, trademark: next.trademarkNote, mission: next.mission.text, vision: next.vision.text });
    if (issues.length) throw new UserError(`Claim bị chặn: ${issues.map((i) => `“${i.match}” — ${i.hint}`).join("; ")}`);
    await setSetting("company", next);
    await audit(u.id, "settings.company", "settings", "company");
    revalidatePath("/", "layout");
    return { ok: true, message: "Đã lưu thông tin công ty (trang Về HULAKO, Liên hệ, chân trang cập nhật cùng lúc)" };
  });
}

export async function saveHome(fd: FormData) {
  return adminAction("pages.edit", async (u) => {
    const needs = lines(fd, "needs").map((l) => {
      const [label, href, image = "", alt = ""] = l.split("|").map((s) => s.trim());
      return { label, href, image, alt };
    }).filter((n) => n.label && n.href?.startsWith("/"));
    await setSetting("home", { heroTitle: str(fd, "heroTitle"), heroSubtitle: str(fd, "heroSubtitle"), heroImage: str(fd, "heroImage"), heroAlt: str(fd, "heroAlt"), needs });
    await audit(u.id, "settings.home", "settings", "home");
    revalidatePath("/");
    return { ok: true, message: "Đã lưu trang chủ" };
  });
}

export async function saveChannels(fd: FormData) {
  return adminAction("pages.edit", async (u) => {
    const v: Record<string, string> = {};
    for (const k of ["zalo", "messenger", "tiktok", "shopee", "tiktokShop"]) {
      const url = str(fd, k);
      if (url && !/^https:\/\//.test(url)) throw new UserError(`${k}: phải là link https`);
      if (url) v[k] = url;
    }
    await setSetting("channels", v);
    await audit(u.id, "settings.channels", "settings", "channels");
    revalidatePath("/", "layout");
    return { ok: true, message: "Đã lưu kênh liên hệ" };
  });
}

export async function saveConsent(fd: FormData) {
  return adminAction("settings.edit", async (u) => {
    await setSetting("consent", {
      version: str(fd, "version") || new Date().toISOString().slice(0, 10), lead: str(fd, "lead"), application: str(fd, "application"),
      retentionDaysLead: Math.max(30, Number(str(fd, "retentionDaysLead")) || 365), retentionDaysApplication: Math.max(30, Number(str(fd, "retentionDaysApplication")) || 180),
    });
    await audit(u.id, "settings.consent", "settings", "consent");
    return { ok: true, message: "Đã lưu thông báo thu thập dữ liệu (phiên bản mới áp dụng cho form gửi từ bây giờ)" };
  });
}

export async function saveUser(fd: FormData) {
  return adminAction("users.manage", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const email = str(fd, "email").toLowerCase();
    const roles = fd.getAll("roles").map(String).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
    const password = str(fd, "password");
    const status = str(fd, "status") === "disabled" ? "disabled" : "active";
    if (id === u.id && (!roles.includes("admin") || status === "disabled")) throw new UserError("Không thể tự gỡ quyền quản trị hoặc tự khoá tài khoản của mình");
    if (password && password.length < 10) throw new UserError("Mật khẩu tối thiểu 10 ký tự");
    if (id) {
      const [cur] = await db.select().from(schema.users).where(eq(schema.users.id, id));
      await db.update(schema.users).set({ name: str(fd, "name"), roles, status, ...(password ? { passwordHash: await hashPassword(password) } : {}) }).where(eq(schema.users.id, id));
      await audit(u.id, "user.roles", "user", id, { from: cur?.roles, to: roles, status });
    } else {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new UserError("Email không hợp lệ");
      if (!password) throw new UserError("Đặt mật khẩu ban đầu cho tài khoản mới");
      const [nu] = await db.insert(schema.users).values({ email, name: str(fd, "name"), roles, status, passwordHash: await hashPassword(password) }).onConflictDoNothing().returning();
      if (!nu) throw new UserError("Email đã tồn tại");
      await audit(u.id, "user.create", "user", nu.id, { roles });
    }
    return { ok: true, message: "Đã lưu tài khoản" };
  });
}

export async function saveLeadMagnet(fd: FormData) {
  return adminAction("pages.edit", async (u) => {
    const downloadUrl = str(fd, "downloadUrl");
    if (downloadUrl && !/^https:\/\//.test(downloadUrl)) throw new UserError("Link tải quà phải bắt đầu bằng https://");
    const next = {
      enabled: fd.get("enabled") === "on", title: str(fd, "title"), subtitle: str(fd, "subtitle"), bullets: lines(fd, "bullets").slice(0, 6),
      buttonLabel: str(fd, "buttonLabel") || "Nhận quà miễn phí", downloadUrl,
      businessOptions: lines(fd, "businessOptions").map((x) => x.slice(0, 60)).slice(0, 15),
      delaySeconds: Math.min(300, Math.max(5, Number(str(fd, "delaySeconds")) || 25)),
      scrollPercent: Math.min(100, Math.max(10, Number(str(fd, "scrollPercent")) || 50)),
    };
    if (next.title.length < 5) throw new UserError("Nhập tiêu đề quà tặng");
    const issues = checkClaims({ title: next.title, subtitle: next.subtitle, bullets: next.bullets.join("\n") });
    if (issues.length) throw new UserError(`Claim bị chặn: ${issues.map((i) => `“${i.match}” — ${i.hint}`).join("; ")}`);
    await setSetting("leadMagnet", next);
    await audit(u.id, "settings.lead_magnet", "settings", "leadMagnet", { enabled: next.enabled, hasDownload: !!downloadUrl });
    revalidatePath("/kien-thuc", "layout");
    revalidatePath("/tin-tuc", "layout");
    return { ok: true, message: "Đã lưu popup quà tặng" };
  });
}
