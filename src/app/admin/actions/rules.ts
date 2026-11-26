"use server";
// A05 giai đoạn 2: quản lý bảng quy tắc chọn đèn có phiên bản. Chỉ kích hoạt khi không còn xung đột.
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { adminAction, num, str, UserError } from "@/lib/admin";
import { findConflicts, recommend, recommendInput } from "@/lib/recommend";
import { audit } from "@/lib/audit";

/** Tạo phiên bản nháp mới, sao chép quy tắc từ phiên bản đang hiệu lực (nếu có) */
export async function newRuleSet() {
  return adminAction("setup.edit", async (u) => {
    const db = await getDb();
    const [{ v }] = await db.select({ v: max(schema.ruleSets.version) }).from(schema.ruleSets);
    const version = (v ?? 0) + 1;
    const [active] = await db.select().from(schema.ruleSets).where(eq(schema.ruleSets.status, "active"));
    await db.transaction(async (tx) => {
      await tx.insert(schema.ruleSets).values({ version, status: "draft", note: active ? `Sao chép từ v${active.version}` : "Bản đầu tiên" });
      if (active) {
        const rules = await tx.select().from(schema.recommendationRules).where(eq(schema.recommendationRules.ruleSetVersion, active.version));
        if (rules.length) await tx.insert(schema.recommendationRules).values(rules.map(({ id: _id, ...r }) => ({ ...r, ruleSetVersion: version })));
      }
    });
    await audit(u.id, "rules.new_version", "rule_set", String(version));
    return { ok: true, message: `Đã tạo phiên bản nháp v${version}`, redirect: `/admin/setups/rules?v=${version}` };
  });
}

async function assertDraft(version: number) {
  const db = await getDb();
  const [s] = await db.select().from(schema.ruleSets).where(eq(schema.ruleSets.version, version));
  if (!s) throw new UserError("Không có phiên bản này");
  if (s.status !== "draft") throw new UserError("Chỉ sửa được phiên bản nháp. Hãy tạo phiên bản mới.");
}

export async function saveRule(fd: FormData) {
  return adminAction("setup.edit", async () => {
    const db = await getDb();
    const version = num(fd, "version");
    await assertDraft(version);
    const id = str(fd, "id");
    const values = {
      ruleSetVersion: version, name: str(fd, "name") || "Quy tắc", priority: num(fd, "priority"),
      conditions: { area: fd.getAll("area").map(String), industry: fd.getAll("industry").map(String), style: fd.getAll("style").map(String) },
      setupId: str(fd, "setupId") || null, variantIds: fd.getAll("variantIds").map(String).slice(0, 2),
      advice: str(fd, "advice"), articleSlug: str(fd, "articleSlug") || null, note: str(fd, "note"),
    };
    if (id) await db.update(schema.recommendationRules).set(values).where(and(eq(schema.recommendationRules.id, id), eq(schema.recommendationRules.ruleSetVersion, version)));
    else await db.insert(schema.recommendationRules).values(values);
    return { ok: true, message: "Đã lưu quy tắc" };
  });
}

export async function deleteRule(fd: FormData) {
  return adminAction("setup.edit", async () => {
    const db = await getDb();
    await assertDraft(num(fd, "version"));
    await db.delete(schema.recommendationRules).where(eq(schema.recommendationRules.id, str(fd, "id")));
    return { ok: true, message: "Đã xoá quy tắc" };
  });
}

export async function testRules(fd: FormData) {
  return adminAction("setup.edit", async () => {
    const input = recommendInput.parse({ area: str(fd, "area"), industry: str(fd, "industry"), style: str(fd, "style"), owned: [] });
    const r = await recommend(input, num(fd, "version"));
    return {
      ok: true,
      message: r.needsConsultation
        ? `→ Chuyển tư vấn (${r.reason})`
        : `→ Quy tắc ${r.ruleId?.slice(0, 8)} · mẫu: ${r.setup?.title ?? "—"} · thiết bị: ${r.products.map((p) => p.sku).join(", ")}`,
    };
  });
}

export async function activateRuleSet(fd: FormData) {
  return adminAction("rules.activate", async (u) => {
    const db = await getDb();
    const version = num(fd, "version");
    await assertDraft(version);
    const rules = await db.select().from(schema.recommendationRules).where(eq(schema.recommendationRules.ruleSetVersion, version));
    if (!rules.length) throw new UserError("Phiên bản chưa có quy tắc nào");
    const conflicts = findConflicts(rules);
    if (conflicts.length) {
      throw new UserError(`Còn ${conflicts.length} cặp quy tắc trùng ưu tiên và cùng độ cụ thể: ${conflicts.slice(0, 3).map(([a, b]) => `"${a.name}" ↔ "${b.name}"`).join("; ")}. Hãy đổi mức ưu tiên.`);
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.ruleSets).set({ status: "archived" }).where(eq(schema.ruleSets.status, "active"));
      await tx.update(schema.ruleSets).set({ status: "active", activatedAt: new Date(), activatedBy: u.id }).where(eq(schema.ruleSets.version, version));
    });
    await audit(u.id, "rules.activate", "rule_set", String(version));
    revalidatePath("/chon-den"); revalidatePath("/");
    return { ok: true, message: `Đã kích hoạt quy tắc v${version}` };
  });
}
