// Ảnh phòng khách gửi kèm yêu cầu tư vấn — chỉ người có quyền xem tư vấn (tư vấn viên, quản trị). Không cache công khai.
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user.roles, "lead.view")) return new Response("Forbidden", { status: 403 });
  const db = await getDb();
  // Chỉ phục vụ tệp đang được một yêu cầu tư vấn tham chiếu (không cho đọc CV qua đường này)
  const [lead] = await db.select({ id: schema.leads.id }).from(schema.leads).where(sql`${schema.leads.context}->>'roomPhotoId' = ${id}`);
  if (!lead) return new Response("Not found", { status: 404 });
  const [f] = await db.select().from(schema.privateFiles).where(eq(schema.privateFiles.id, id));
  if (!f) return new Response("Not found", { status: 404 });
  await audit(user.id, "lead.photo_view", "lead", lead.id);
  return new Response(new Uint8Array(f.data), { headers: { "Content-Type": f.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
