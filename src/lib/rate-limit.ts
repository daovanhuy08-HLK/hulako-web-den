// Giới hạn tần suất theo cửa sổ cố định, lưu trong Postgres (không cần Redis).
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { rowsOf } from "./db/rows";
import { sha256 } from "./text";

export async function rateLimit(bucket: string, ip: string, limit: number, windowSec: number): Promise<boolean> {
  const db = await getDb();
  const key = `${bucket}:${sha256(ip).slice(0, 24)}`; // không lưu IP thô
  const res = await db.execute(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning count`);
  return Number(rowsOf<{ count: number }>(res)[0]?.count ?? 0) <= limit;
}
