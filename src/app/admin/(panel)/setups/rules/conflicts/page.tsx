// Màn 071 Kiểm tra quy tắc chọn đèn bị trùng: từng cặp quy tắc cùng ưu tiên + cùng độ cụ thể có thể cùng khớp một đầu vào.
// Đổi mức ưu tiên ngay tại đây (chỉ phiên bản nháp), rồi kiểm tra lại.
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { AREA_OPTIONS, INDUSTRY_OPTIONS, STYLE_OPTIONS, findConflicts } from "@/lib/recommend";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, EmptyState, IconBox, Notice, PageTitle } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { setRulePriority } from "../../../../actions/extra";

export const metadata = { title: "Kiểm tra quy tắc chọn đèn" };
const lbl = (o: readonly { value: string; label: string }[], v?: string[]) => (v?.length ? v.map((x) => o.find((y) => y.value === x)?.label ?? x).join(", ") : "Mọi lựa chọn");

export default async function Conflicts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("setup.edit");
  const sp = await searchParams;
  const db = await getDb();
  const sets = await db.select().from(schema.ruleSets).orderBy(desc(schema.ruleSets.version));
  const cur = sets.find((s) => String(s.version) === sp.v) ?? sets.find((s) => s.status === "draft") ?? sets[0];
  const rules = cur ? await db.select().from(schema.recommendationRules).where(eq(schema.recommendationRules.ruleSetVersion, cur.version)) : [];
  const pairs = findConflicts(rules);
  const editable = cur?.status === "draft";

  const Card = ({ r }: { r: (typeof rules)[number] }) => (
    <section className="card p-6">
      <div className="flex items-center gap-4 border-b border-[#EFECE8] pb-4"><IconBox icon="sliders" size="lg" /><h3 className="text-2xl font-bold">{r.name}</h3></div>
      <ul className="border-b border-[#EFECE8] py-2">
        <li className="flex items-center gap-4 py-2"><IconBox icon="home" size="sm" /> {lbl(AREA_OPTIONS, r.conditions.area)}</li>
        <li className="flex items-center gap-4 py-2"><IconBox icon="shirt" size="sm" /> {lbl(INDUSTRY_OPTIONS, r.conditions.industry)}</li>
        <li className="flex items-center gap-4 py-2"><IconBox icon="video" size="sm" /> {lbl(STYLE_OPTIONS, r.conditions.style)}</li>
      </ul>
      <ActionForm action={setRulePriority} buttons={editable ? <button className="btn-line btn-sm">Lưu mức ưu tiên</button> : null} key={`${r.id}-${r.priority}`}>
        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="version" value={cur!.version} />
        <div className="mt-4 grid items-center gap-3 sm:grid-cols-[160px_1fr]">
          <label htmlFor={`p-${r.id}`} className="font-semibold">Mức ưu tiên</label>
          <input id={`p-${r.id}`} name="priority" type="number" defaultValue={r.priority} className="input" readOnly={!editable} />
          <span className="font-semibold">Trạng thái</span><span><Badge status={cur!.status === "active" ? "active" : "draft"} label={cur!.status === "active" ? "Đang hiệu lực" : "Chưa kích hoạt"} /></span>
        </div>
      </ActionForm>
    </section>
  );

  return (
    <>
      <PageTitle title="Kiểm tra quy tắc chọn đèn" back={`/admin/setups/rules${cur ? `?v=${cur.version}` : ""}`} tag={cur ? <Badge status={cur.status} label={`v${cur.version}`} /> : undefined} />
      {!cur ? <div className="card"><EmptyState icon="sliders" title="Chưa có bảng quy tắc" /></div> : pairs.length === 0 ? (
        <>
          <Notice tone="ok" title="Không có quy tắc trùng">{rules.length ? `${rules.length} quy tắc của v${cur.version} không chồng lấn ở cùng mức ưu tiên.` : "Phiên bản chưa có quy tắc."}</Notice>
          <Link href={`/admin/setups/rules?v=${cur.version}`} className="btn-primary"><Icon name="arrowLeft" /> Về quy tắc</Link>
        </>
      ) : (
        <>
          <Notice tone="warn" title="Có quy tắc cùng mức ưu tiên">Điều chỉnh điều kiện hoặc mức ưu tiên trước khi kích hoạt. Còn {pairs.length} cặp trùng.</Notice>
          {!editable && <Notice tone="info">Phiên bản này không còn là nháp — tạo phiên bản mới để sửa.</Notice>}
          {pairs.map(([a, b]) => (
            <div key={`${a.id}-${b.id}`} className="mb-6 grid gap-5 lg:grid-cols-2"><Card r={a} /><Card r={b} /></div>
          ))}
          <div className="flex flex-wrap justify-end gap-3">
            <Link href={`/admin/setups/rules?v=${cur.version}`} className="btn-primary"><Icon name="pencil" /> Chỉnh sửa quy tắc</Link>
            <Link href={`/admin/setups/rules/conflicts?v=${cur.version}`} className="btn-line"><Icon name="refresh" /> Kiểm tra lại</Link>
          </div>
        </>
      )}
    </>
  );
}
