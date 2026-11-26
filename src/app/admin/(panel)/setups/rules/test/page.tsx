// Màn 058 Chạy thử quy tắc chọn đèn (theo phiên bản đang xem; mặc định phiên bản đang hiệu lực).
import Link from "next/link";
import { desc } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { AREA_OPTIONS, INDUSTRY_OPTIONS, OWNED_OPTIONS, STYLE_OPTIONS } from "@/lib/recommend";
import { RuleTester } from "@/components/admin/RuleTester";
import { Badge, PageTitle } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { runRuleTest } from "../../../../actions/extra";

export const metadata = { title: "Chạy thử quy tắc chọn đèn" };

export default async function RuleTest({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("setup.edit");
  const sp = await searchParams;
  const db = await getDb();
  const sets = await db.select().from(schema.ruleSets).orderBy(desc(schema.ruleSets.version));
  const cur = sets.find((s) => String(s.version) === sp.v) ?? sets.find((s) => s.status === "active") ?? sets[0];
  return (
    <>
      <PageTitle title="Chạy thử quy tắc chọn đèn" tag={cur ? <span className="flex items-center gap-2">v{cur.version} <Badge status={cur.status} /></span> : undefined}>
        <Link href={`/admin/setups/rules${cur ? `?v=${cur.version}` : ""}`} className="flex items-center gap-2 font-semibold text-brand-dark hover:underline"><Icon name="external" /> Về quy tắc</Link>
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">{sets.map((s) => <Link key={s.version} href={`?v=${s.version}`} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${s.version === cur?.version ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white"}`}>v{s.version}</Link>)}</div>
      <RuleTester action={runRuleTest} version={cur?.version ?? null} areas={AREA_OPTIONS} industries={INDUSTRY_OPTIONS} styles={STYLE_OPTIONS} owned={OWNED_OPTIONS} />
      <p className="mt-4 text-sm text-ink-muted">Cùng đầu vào + cùng phiên bản quy tắc luôn cho cùng kết quả (không dùng AI). Thiết bị chưa công khai không được gợi ý → chuyển tư vấn.</p>
    </>
  );
}
