// Thông báo cho nhân viên — chạy TÁCH RIÊNG khỏi thao tác lưu (mục P10):
// lưu xong mới gửi; gửi lỗi thì hồ sơ vẫn nằm trong hộp thư quản trị, có retry giới hạn.
import { and, eq, lt, inArray } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getAdminSetting } from "./admin-settings";

/** Người nhận lấy từ màn 068 (Quản lý thông báo nội bộ); để trống thì dùng biến môi trường */
async function recipients() {
  const cfg = await getAdminSetting("admin.notify");
  return {
    cfg,
    emails: cfg.emails.length ? cfg.emails.join(",") : process.env.NOTIFY_EMAIL_TO,
    chat: cfg.telegramChatId || process.env.TELEGRAM_ADMIN_CHAT_ID,
  };
}

const MAX_ATTEMPTS = 5;

async function sendEmail(subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY, to = (await recipients()).emails;
  if (!key || !to) throw new Error("not_configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_EMAIL_FROM ?? "HULAKO Website <onboarding@resend.dev>", to: to.split(","), subject, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`resend_${res.status}`);
}

/** Gửi tin Telegram cho admin (bot riêng của chủ website). Thiếu cấu hình → "not_configured". */
async function sendTelegram(html: string, silent = false): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = (await recipients()).chat;
  if (!token || !chat) throw new Error("not_configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true }, disable_notification: silent }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`telegram_${res.status}`);
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Gửi thông báo cho 1 yêu cầu tư vấn / đăng ký quà tặng qua Telegram + email (kênh nào cấu hình thì dùng kênh đó). */
export async function notifyLead(leadId: string) {
  const db = await getDb();
  const [lead] = await db.select().from(schema.leads).where(and(eq(schema.leads.id, leadId), inArray(schema.leads.notifyStatus, ["pending", "failed"])));
  if (!lead || lead.notifyAttempts >= MAX_ATTEMPTS) return;
  if (!(await recipients()).cfg.events.lead) { // quản trị tắt thông báo yêu cầu tư vấn — hồ sơ vẫn nằm trong hộp thư
    await db.update(schema.leads).set({ notifyStatus: "skipped" }).where(eq(schema.leads.id, lead.id));
    return;
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const isMagnet = lead.source === "lead_magnet";
  const ctx = lead.context as Record<string, unknown>;
  const tg = [
    isMagnet ? "🎁 <b>Đăng ký nhận quà tặng mới</b>" : "📩 <b>Yêu cầu tư vấn mới</b>",
    `👤 ${esc(lead.name)}`,
    lead.email ? `✉️ ${esc(lead.email)}` : "",
    lead.phone ? `📞 ${esc(lead.phone)}` : "",
    lead.businessField ? `🏷️ Lĩnh vực: ${esc(lead.businessField)}` : "",
    lead.shippingAddress ? `📦 Địa chỉ: ${esc(lead.shippingAddress)}` : "",
    ctx["Bài viết"] ? `📄 Từ bài: ${esc(String(ctx["Bài viết"]))}` : `🔖 ${esc(lead.topic)} · nguồn ${esc(lead.source)}`,
    `Mã ${lead.code} — <a href="${site}/admin/support/leads/${lead.id}">mở trong quản trị</a>`,
  ].filter(Boolean).join("\n");
  const results = await Promise.allSettled([
    sendTelegram(tg),
    // Email không chứa dữ liệu khách (giảm lộ dữ liệu cá nhân), chỉ báo có yêu cầu mới
    sendEmail(`[HULAKO] ${isMagnet ? "Đăng ký quà tặng" : "Yêu cầu tư vấn"} mới ${lead.code}`, `Có ${isMagnet ? "đăng ký nhận quà tặng" : "yêu cầu tư vấn"} mới (${lead.topic}, nguồn: ${lead.source}). Xem tại ${site}/admin/support/leads/${lead.id}`),
  ]);
  const errors = results.map((r) => (r.status === "rejected" ? (r.reason as Error).message : null));
  const sent = errors.some((e) => e === null);
  const allNotConfigured = errors.every((e) => e === "not_configured");
  await db.update(schema.leads).set({
    notifyStatus: sent ? "sent" : allNotConfigured ? "skipped" : "failed",
    notifyAttempts: lead.notifyAttempts + 1,
    notifyError: sent ? null : errors.filter(Boolean).join("; ").slice(0, 300),
  }).where(eq(schema.leads.id, lead.id));
}

export async function retryFailedNotifications() {
  const db = await getDb();
  const rows = await db.select({ id: schema.leads.id }).from(schema.leads)
    .where(and(eq(schema.leads.notifyStatus, "failed"), lt(schema.leads.notifyAttempts, MAX_ATTEMPTS))).limit(20);
  for (const r of rows) await notifyLead(r.id);
  return rows.length;
}

export async function notifyApplication(code: string, jobTitle: string) {
  if (!(await recipients()).cfg.events.application) return;
  try {
    await sendEmail(`[HULAKO] Hồ sơ ứng tuyển mới ${code}`, `Có hồ sơ mới cho vị trí "${jobTitle}". Xem trong /admin/recruitment.`);
  } catch { /* hồ sơ đã lưu; email chỉ là kênh phụ */ }
}

/**
 * Thông báo cho chủ website qua Telegram theo loại (bật/tắt ở Quản trị › Cài đặt › Thông báo):
 * review = AI viết xong bản nháp chờ duyệt · aiFailed = tác vụ AI thất bại · seoReport = báo cáo AI SEO.
 * Không bao giờ ném lỗi (thông báo hỏng không được làm hỏng tác vụ chính).
 */
export async function notifyAdmin(event: "review" | "aiFailed" | "seoReport", html: string, opts: { silent?: boolean } = {}) {
  try {
    const { cfg } = await recipients();
    if (cfg.events[event] === false) return "off";
    await sendTelegram(html.slice(0, 4000), opts.silent);
    return "sent";
  } catch (e) {
    console.error("[notifyAdmin]", event, (e as Error).message);
    return (e as Error).message;
  }
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://hulako-web-den.vercel.app").replace(/\/$/, "");
