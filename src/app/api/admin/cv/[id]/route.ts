// Tải CV: kiểm quyền tuyển dụng, rồi cấp liên kết tạm thời (token 5 phút) — mục 04 & 12.
// GET ?app=<applicationId>            -> (đã đăng nhập + quyền) chuyển hướng tới link tạm
// GET ?token=<jwt>                    -> trả tệp nếu token còn hạn
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { getDb, schema } from "@/lib/db";
import { getSessionUser, sessionSecret } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: fileId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const db = await getDb();

  if (!token) {
    const user = await getSessionUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
    if (!can(user.roles, "application.view")) return new Response("Forbidden", { status: 403 });
    const [app] = await db.select().from(schema.applications).where(eq(schema.applications.cvFileId, fileId));
    if (!app) return new Response("Not found", { status: 404 });
    const t = await new SignJWT({ fid: fileId, uid: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("5m").sign(sessionSecret());
    await audit(user.id, "cv.download", "application", app.id);
    return Response.redirect(new URL(`/api/admin/cv/${fileId}?token=${t}`, url).toString(), 302);
  }

  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.fid !== fileId) throw new Error("mismatch");
  } catch {
    return new Response("Liên kết đã hết hạn", { status: 403 });
  }
  const [f] = await db.select().from(schema.privateFiles).where(eq(schema.privateFiles.id, fileId));
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `attachment; filename="${f.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
