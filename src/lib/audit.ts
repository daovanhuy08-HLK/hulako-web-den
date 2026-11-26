import { getDb, schema } from "./db";

const SENSITIVE = /password|email|phone|cv|token|secret|message|name$/i;

/** Ghi nhật ký thao tác; tự loại trường nhạy cảm khỏi phần thay đổi */
export async function audit(
  userId: string | null, action: string, entityType: string, entityId: string | null, changes?: Record<string, unknown>,
) {
  const clean = changes ? Object.fromEntries(Object.entries(changes).filter(([k]) => !SENSITIVE.test(k))) : undefined;
  const db = await getDb();
  await db.insert(schema.auditLogs).values({ userId, action, entityType, entityId, changes: clean });
}
