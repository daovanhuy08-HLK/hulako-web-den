// Chạy trên Vercel trước `next build`: migrate CSDL + khởi tạo lần đầu (nếu CSDL trống).
// Vì sao làm ở bước build: chuỗi kết nối Neon chỉ nằm trong Vercel, không cần ai copy ra máy.
import "./load-env";

process.env.DATABASE_URL ||= process.env.POSTGRES_URL;
if (!process.env.DATABASE_URL) {
  console.error("✘ Thiếu DATABASE_URL — hãy kết nối Neon (Storage) cho project trên Vercel rồi deploy lại.");
  process.exit(1);
}
const { getDb, schema } = await import("../src/lib/db");
const { migrate } = await import("drizzle-orm/postgres-js/migrator");
const db = await getDb();
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("✔ Migration xong");

const [anyUser] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
if (!anyUser) {
  const hasPw = (process.env.SEED_ADMIN_PASSWORD ?? "").length >= 10;
  if (!hasPw && (process.env.SETUP_TOKEN ?? "").length < 24) {
    console.error("✘ CSDL trống: cần SEED_ADMIN_PASSWORD (≥ 10 ký tự) hoặc SETUP_TOKEN để tạo tài khoản quản trị đầu tiên.");
    process.exit(1);
  }
  process.env.SEED_MODE = "production";
  await import("./seed");
} else {
  console.log("✔ Đã có dữ liệu — bỏ qua khởi tạo");
  // Điền kênh liên hệ + hotline chính thức (2026-11-21) CHỈ vào ô đang trống — giá trị quản trị đã nhập được giữ nguyên
  const { eq } = await import("drizzle-orm");
  const { DEFAULTS } = await import("../src/lib/settings");
  const fill = async (key: "channels" | "company", fields: string[]) => {
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
    if (!row) return; // chưa từng lưu → website tự dùng giá trị mặc định
    const cur = (row.value ?? {}) as Record<string, unknown>;
    const defs = DEFAULTS[key] as Record<string, unknown>;
    const added = fields.filter((f) => !String(cur[f] ?? "").trim() && defs[f]);
    if (!added.length) return;
    await db.update(schema.settings).set({ value: { ...cur, ...Object.fromEntries(added.map((f) => [f, defs[f]])) }, updatedAt: new Date() }).where(eq(schema.settings.key, key));
    console.log(`✔ Đã điền ${key}: ${added.join(", ")}`);
  };
  await fill("channels", ["shopee", "tiktok", "zalo", "messenger"]);
  await fill("company", ["phone"]);
}
