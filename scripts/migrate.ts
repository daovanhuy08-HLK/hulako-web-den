// Áp migration trong ./drizzle cho Postgres (DATABASE_URL) hoặc PGlite local.
import "./load-env";
import { getDb } from "../src/lib/db";

const db = await getDb();
if (process.env.DATABASE_URL) {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(db, { migrationsFolder: "./drizzle" });
} else {
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db as never, { migrationsFolder: "./drizzle" });
}
console.log("✔ Migration xong");
process.exit(0);
