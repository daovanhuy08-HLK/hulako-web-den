// Công cụ Chọn đèn theo phòng (P13, mục 05) — chạy theo bảng quy tắc đã duyệt, KHÔNG dùng AI
// để đảm bảo: cùng đầu vào + cùng phiên bản quy tắc → cùng kết quả.
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "./db";
import type { RuleConditions } from "./db/schema";

import { AREA_OPTIONS, INDUSTRY_OPTIONS, OWNED_OPTIONS, STYLE_OPTIONS } from "./selector-options";
export { AREA_OPTIONS, INDUSTRY_OPTIONS, OWNED_OPTIONS, STYLE_OPTIONS };

const vals = <T extends readonly { value: string }[]>(o: T) => o.map((x) => x.value) as [T[number]["value"], ...T[number]["value"][]];

export const recommendInput = z.object({
  area: z.enum(vals(AREA_OPTIONS)),
  industry: z.enum(vals(INDUSTRY_OPTIONS)),
  style: z.enum(vals(STYLE_OPTIONS)),
  owned: z.array(z.enum(vals(OWNED_OPTIONS))).max(4).default([]),
});
export type RecommendInput = z.infer<typeof recommendInput>;

type Rule = typeof schema.recommendationRules.$inferSelect;
const FIELDS = ["area", "industry", "style"] as const;

const specificity = (c: RuleConditions) => FIELDS.filter((f) => c[f]?.length).length;
const matches = (c: RuleConditions, input: RecommendInput) => FIELDS.every((f) => !c[f]?.length || c[f]!.includes(input[f]));

/** Hai quy tắc cùng ưu tiên + cùng độ cụ thể mà có thể cùng khớp một đầu vào → xung đột, phải sửa trước khi kích hoạt */
export function findConflicts(rules: Rule[]): [Rule, Rule][] {
  const out: [Rule, Rule][] = [];
  for (let i = 0; i < rules.length; i++) for (let j = i + 1; j < rules.length; j++) {
    const a = rules[i], b = rules[j];
    if (a.priority !== b.priority || specificity(a.conditions) !== specificity(b.conditions)) continue;
    const overlap = FIELDS.every((f) => {
      const x = a.conditions[f], y = b.conditions[f];
      return !x?.length || !y?.length || x.some((v) => y.includes(v));
    });
    if (overlap) out.push([a, b]);
  }
  return out;
}

export function pickRule(rules: Rule[], input: RecommendInput): Rule | null {
  const sorted = rules.filter((r) => matches(r.conditions, input))
    .sort((a, b) => b.priority - a.priority || specificity(b.conditions) - specificity(a.conditions) || a.id.localeCompare(b.id));
  return sorted[0] ?? null;
}

export async function recommend(input: RecommendInput, ruleSetVersion?: number) {
  const db = await getDb();
  const [set] = ruleSetVersion
    ? await db.select().from(schema.ruleSets).where(eq(schema.ruleSets.version, ruleSetVersion))
    : await db.select().from(schema.ruleSets).where(eq(schema.ruleSets.status, "active"));
  if (!set) return { ruleVersion: null, ruleId: null, setup: null, products: [], advice: "", articleSlug: null, needsConsultation: true, reason: "no_active_rules" as const };

  const rules = await db.select().from(schema.recommendationRules).where(eq(schema.recommendationRules.ruleSetVersion, set.version));
  const rule = pickRule(rules, input);
  if (!rule) return { ruleVersion: set.version, ruleId: null, setup: null, products: [], advice: "", articleSlug: null, needsConsultation: true, reason: "no_match" as const };

  const [setup] = rule.setupId
    ? await db.select().from(schema.setups).where(and(eq(schema.setups.id, rule.setupId), eq(schema.setups.status, "public")))
    : [];
  // Chỉ hiển thị thiết bị còn công khai (sản phẩm ẩn không xuất hiện — nghiệm thu P13)
  const vs = rule.variantIds.length
    ? await db.select({ v: schema.variants, p: schema.products }).from(schema.variants)
      .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
      .where(and(inArray(schema.variants.id, rule.variantIds), eq(schema.variants.status, "public"), eq(schema.products.status, "public")))
    : [];
  const products = rule.variantIds
    .map((id) => vs.find((x) => x.v.id === id))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .slice(0, 2)
    .map(({ v, p }) => ({ variantId: v.id, sku: v.sku, name: `${p.name} — ${v.name}`, slug: p.slug, image: v.images[0] ?? null }));

  const needsConsultation = products.length === 0;
  return {
    ruleVersion: set.version, ruleId: rule.id,
    setup: setup ? { slug: setup.slug, title: setup.title, summary: setup.summary, coverUrl: setup.coverUrl, coverAlt: setup.coverAlt, diagramUrl: setup.diagramUrl, lightPosition: setup.lightPosition, isSample: setup.isSample } : null,
    products, advice: rule.advice, articleSlug: rule.articleSlug, needsConsultation,
    reason: needsConsultation ? ("missing_products" as const) : ("ok" as const),
  };
}
