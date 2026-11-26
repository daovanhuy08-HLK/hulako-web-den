// Kết nối CSDL: production dùng Postgres (Neon) qua postgres.js;
// dev local không có DATABASE_URL thì dùng PGlite (Postgres chạy ngay trong Node, lưu ở ./.local-db).
// Vì sao: cùng một phương ngữ Postgres ở cả hai nơi -> migration và truy vấn giống hệt nhau.
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: DB; __dbReady?: Promise<DB> };

async function create(): Promise<DB> {
  // Neon qua Vercel Marketplace có thể đặt tên POSTGRES_URL tuỳ cấu hình
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    // prepare:false để tương thích PgBouncer/pooler của Neon
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
    return drizzlePg(client, { schema });
  }
  if (process.env.VERCEL) throw new Error("Thiếu DATABASE_URL trên Vercel");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(process.env.LOCAL_DB_DIR ?? "./.local-db");
  return drizzle(client, { schema }) as unknown as DB;
}

export async function getDb(): Promise<DB> {
  if (g.__db) return g.__db;
  g.__dbReady ??= create().then((d) => (g.__db = d));
  return g.__dbReady;
}

export { schema };
