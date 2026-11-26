// CHỈ DÙNG KHI DEV: in token phiên cho tài khoản theo email (để kiểm thử giao diện quản trị mà không cần mật khẩu)
import "./load-env";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { getDb, schema } from "../src/lib/db";
if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") { console.error("Chỉ dùng với CSDL dev local"); process.exit(1); }
const email = process.argv[2] ?? "admin@hulako.local";
const db = await getDb();
const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
if (!u) { console.error("Không có user"); process.exit(1); }
const secret = new TextEncoder().encode(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 ? process.env.SESSION_SECRET : "dev-only-secret-change-me-0123456789abcdef");
console.log(await new SignJWT({ sub: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(secret));
process.exit(0);
