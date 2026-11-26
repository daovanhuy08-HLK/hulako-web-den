// Xoá CSDL PGlite local (chỉ dùng khi dev). Không bao giờ đụng tới DATABASE_URL.
import { rmSync } from "node:fs";
if (process.env.DATABASE_URL) { console.error("Từ chối: đang có DATABASE_URL"); process.exit(1); }
rmSync("./.local-db", { recursive: true, force: true });
console.log("✔ Đã xoá ./.local-db");
