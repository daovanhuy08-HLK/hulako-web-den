// Xuất danh sách khách (mặc định: đăng ký quà tặng lead_magnet) ra CSV — chỉ người có quyền xem yêu cầu tư vấn
import { and, desc, eq, type SQL } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { audit } from "@/lib/audit";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const u = await getSessionUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  if (!can(u.roles, "lead.view")) return new Response("Forbidden", { status: 403 });
  const source = new URL(req.url).searchParams.get("source") ?? "lead_magnet";
  const db = await getDb();
  const where: SQL[] = [];
  if (source !== "all") where.push(eq(schema.leads.source, source));
  const rows = await db.select().from(schema.leads).where(where.length ? and(...where) : undefined).orderBy(desc(schema.leads.createdAt)).limit(20000);
  const head = ["Mã", "Thời gian", "Họ tên", "Email", "Điện thoại", "Lĩnh vực kinh doanh", "Địa chỉ nhận hàng", "Chủ đề", "Nguồn", "Bài viết", "Trạng thái", "Đồng ý (phiên bản)"];
  const lines = rows.map((l) => {
    const ctx = l.context as Record<string, unknown>;
    return [l.code, l.createdAt.toISOString(), l.name, l.email, l.phone, l.businessField, l.shippingAddress, l.topic, l.source, ctx["Bài viết"] ?? ctx.page ?? "", l.status, l.consentVersion].map(cell).join(",");
  });
  await audit(u.id, "leads.export", "lead", null, { source, rows: rows.length });
  // BOM để Excel đọc đúng tiếng Việt
  return new Response("﻿" + [head.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hulako-${source}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
