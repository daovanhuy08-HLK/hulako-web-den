// Cấu hình riêng của khu quản trị lưu trong bảng settings (khoá có tiền tố "admin."),
// tách khỏi src/lib/settings.ts để không đụng file dùng chung.
// - admin.notify   : bật/tắt loại thông báo nội bộ + người nhận (màn 068)
// - admin.schedule : lịch tự động AI SEO (màn 057)
import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

export type NotifyConfig = {
  events: { lead: boolean; application: boolean; review: boolean; aiFailed: boolean; seoReport?: boolean }; // seoReport: báo cáo AI SEO hằng ngày/tuần
  emails: string[]; // người nhận email (không phải bí mật)
  telegramChatId: string; // chat id Telegram nhận tin (không phải bí mật; token bot vẫn ở biến môi trường)
};

export type ScheduleItem = {
  key: string; name: string; type: string; source: string; frequency: "daily" | "weekly" | "monthly";
  weekday: number; monthDay: number; hour: string; enabled: boolean;
};
export type ScheduleConfig = { items: ScheduleItem[]; maxRunsPerDay: number | null; maxBudgetUsd: number | null };

const DEFAULTS = {
  "admin.notify": { events: { lead: true, application: true, review: true, aiFailed: true, seoReport: true }, emails: [], telegramChatId: "" } as NotifyConfig,
  "admin.schedule": {
    items: [
      { key: "collect", name: "Thu số liệu Search Console", type: "collect_gsc", source: "gsc", frequency: "daily", weekday: 1, monthDay: 1, hour: "03:00", enabled: false },
      { key: "score", name: "Gom cơ hội từ khoá", type: "score_opportunities", source: "gsc", frequency: "weekly", weekday: 1, monthDay: 1, hour: "04:00", enabled: false },
      { key: "suggest", name: "AI đề xuất từ khoá", type: "suggest_keywords", source: "manual", frequency: "weekly", weekday: 1, monthDay: 1, hour: "05:00", enabled: false },
      { key: "prompt", name: "AI đề xuất nâng cấp hướng dẫn viết", type: "improve_prompt", source: "gsc", frequency: "monthly", weekday: 1, monthDay: 1, hour: "06:00", enabled: false },
    ],
    maxRunsPerDay: null, maxBudgetUsd: null,
  } as ScheduleConfig,
};
type Key = keyof typeof DEFAULTS;

export async function getAdminSetting<K extends Key>(key: K): Promise<(typeof DEFAULTS)[K]> {
  try {
    const db = await getDb();
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
    const v = { ...DEFAULTS[key], ...((row?.value as object) ?? {}) } as (typeof DEFAULTS)[K];
    // gộp sâu "events" để loại thông báo mới thêm vẫn có giá trị mặc định khi cấu hình cũ đã lưu
    if (key === "admin.notify") (v as NotifyConfig).events = { ...DEFAULTS["admin.notify"].events, ...((row?.value as NotifyConfig | undefined)?.events ?? {}) };
    return v;
  } catch {
    return DEFAULTS[key];
  }
}

export async function setAdminSetting<K extends Key>(key: K, value: (typeof DEFAULTS)[K]) {
  const db = await getDb();
  await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

/** Trạng thái cấu hình kênh gửi (chỉ cho biết có/không, không bao giờ trả giá trị bí mật) */
export function channelStatus() {
  return {
    email: !!process.env.RESEND_API_KEY,
    emailEnvRecipients: !!process.env.NOTIFY_EMAIL_TO,
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    telegramEnvChat: !!process.env.TELEGRAM_ADMIN_CHAT_ID,
  };
}
