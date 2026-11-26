// Phục vụ ảnh lưu trong Postgres (khi không dùng Vercel Blob). Ảnh chưa duyệt chỉ người đăng nhập xem được.
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [m] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));
  if (!m?.data) return new Response("Not found", { status: 404 });
  const isPublic = m.status === "approved";
  if (!isPublic && !(await getSessionUser())) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.data), {
    headers: {
      "Content-Type": m.mime,
      "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
