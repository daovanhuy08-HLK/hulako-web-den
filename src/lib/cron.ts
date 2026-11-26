// Bảo vệ route cron: Vercel Cron gửi "Authorization: Bearer <CRON_SECRET>".
import { getDb, schema } from "./db";
import { and, lt, isNotNull, inArray } from "drizzle-orm";

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // dev: cho phép gọi tay
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Xoá dữ liệu cá nhân quá hạn lưu (kèm tệp CV liên quan) — mục 08 & 12 */
export async function purgeExpiredPersonalData() {
  const db = await getDb();
  const now = new Date();
  const leads = await db.delete(schema.leads).where(and(isNotNull(schema.leads.retainUntil), lt(schema.leads.retainUntil, now))).returning({ id: schema.leads.id });
  const apps = await db.select({ id: schema.applications.id, cv: schema.applications.cvFileId }).from(schema.applications)
    .where(and(isNotNull(schema.applications.retainUntil), lt(schema.applications.retainUntil, now)));
  if (apps.length) {
    await db.transaction(async (tx) => {
      await tx.delete(schema.applications).where(inArray(schema.applications.id, apps.map((a) => a.id)));
      await tx.delete(schema.privateFiles).where(inArray(schema.privateFiles.id, apps.map((a) => a.cv)));
    });
  }
  // Sự kiện không chứa dữ liệu cá nhân nhưng vẫn dọn sau 400 ngày cho gọn
  await db.delete(schema.events).where(lt(schema.events.createdAt, new Date(Date.now() - 400 * 86400_000)));
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, new Date(Date.now() - 86400_000)));
  return { leads: leads.length, applications: apps.length };
}
