// A05 Quy tắc chọn đèn (màn 027): phiên bản, sửa quy tắc, kiểm tra xung đột (071), chạy thử (058), kích hoạt (chặn khi xung đột).
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { AREA_OPTIONS, INDUSTRY_OPTIONS, STYLE_OPTIONS, findConflicts } from "@/lib/recommend";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { Badge, Field, IconBox, Notice, PageTitle, Panel, SampleTag } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { activateRuleSet, deleteRule, newRuleSet, saveRule } from "../../../actions/rules";

export const metadata = { title: "Quy tắc chọn đèn" };
const lbl = (o: readonly { value: string; label: string }[], v?: string[]) => (v?.length ? v.map((x) => o.find((y) => y.value === x)?.label ?? x).join(", ") : "Mọi");

function Checks({ name, opts, values }: { name: string; opts: readonly { value: string; label: string }[]; values?: string[] }) {
  return <div className="flex flex-wrap gap-2">{opts.map((o) => <label key={o.value} className="flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm"><input type="checkbox" name={name} value={o.value} defaultChecked={values?.includes(o.value)} />{o.label}</label>)}</div>;
}

export default async function RulesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage("setup.edit");
  const sp = await searchParams;
  const db = await getDb();
  const sets = await db.select().from(schema.ruleSets).orderBy(desc(schema.ruleSets.version));
  const cur = sets.find((s) => String(s.version) === sp.v) ?? sets.find((s) => s.status === "draft") ?? sets[0];
  const [rules, setups, variants] = await Promise.all([
    cur ? db.select().from(schema.recommendationRules).where(eq(schema.recommendationRules.ruleSetVersion, cur.version)).orderBy(desc(schema.recommendationRules.priority)) : Promise.resolve([]),
    db.select({ id: schema.setups.id, title: schema.setups.title }).from(schema.setups).orderBy(asc(schema.setups.title)),
    db.select({ id: schema.variants.id, sku: schema.variants.sku, product: schema.products.name, status: schema.variants.status }).from(schema.variants).innerJoin(schema.products, eq(schema.products.id, schema.variants.productId)),
  ]);
  const editable = cur?.status === "draft";
  const conflicts = findConflicts(rules);
  const open = sp.rule;

  const RuleForm = ({ r }: { r?: typeof rules[number] }) => (
    <ActionForm action={saveRule} submitLabel={r ? "Lưu nháp quy tắc" : "Thêm quy tắc"} submitIcon="save" resetOnSuccess={!r}>
      <input type="hidden" name="version" value={cur!.version} /><input type="hidden" name="id" value={r?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-[1fr_200px]"><Field label="Tên quy tắc" name="name" defaultValue={r?.name} placeholder="vd Phòng nhỏ · Live quần áo" /><Field label="Mức ưu tiên" name="priority" type="number" defaultValue={r?.priority ?? 0} hint="Số lớn được xét trước" /></div>
      <h3 className="mb-3 mt-5 border-t border-[#EFECE8] pt-4 text-lg font-bold">Điều kiện áp dụng <span className="text-sm font-normal text-ink-muted">(bỏ trống = mọi)</span></h3>
      <div className="space-y-3">
        <div><p className="mb-1.5 font-semibold">Không gian</p><Checks name="area" opts={AREA_OPTIONS} values={r?.conditions.area} /></div>
        <div><p className="mb-1.5 font-semibold">Ngành hàng</p><Checks name="industry" opts={INDUSTRY_OPTIONS} values={r?.conditions.industry} /></div>
        <div><p className="mb-1.5 font-semibold">Kiểu quay</p><Checks name="style" opts={STYLE_OPTIONS} values={r?.conditions.style} /></div>
      </div>
      <h3 className="mb-3 mt-5 border-t border-[#EFECE8] pt-4 text-lg font-bold">Kết quả gợi ý</h3>
      <div className="space-y-4">
        <div className="grid items-center gap-3 md:grid-cols-[260px_1fr]">
          <span className="flex items-center gap-3 font-semibold"><IconBox icon="play" size="sm" /> Mẫu góc livestream</span>
          <select name="setupId" defaultValue={r?.setupId ?? ""} className="input" aria-label="Mẫu góc livestream"><option value="">Chọn mẫu góc livestream</option>{setups.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
        </div>
        <div className="grid gap-3 md:grid-cols-[260px_1fr]">
          <span className="flex items-center gap-3 font-semibold"><IconBox icon="layers" size="sm" /> Thiết bị liên quan <span className="text-xs font-normal text-ink-muted">(tối đa 2)</span></span>
          <div className="adm-scroll max-h-40 space-y-1.5 overflow-auto rounded-[10px] border border-line p-3 text-sm">{variants.map((v) => (
            <label key={v.id} className="flex items-center gap-2"><input type="checkbox" name="variantIds" value={v.id} defaultChecked={r?.variantIds.includes(v.id)} />{v.product} <span className="font-mono text-xs text-ink-muted">({v.sku})</span>{v.status !== "public" && <em className="text-xs text-[#8A5A00]">· {v.status}</em>}</label>
          ))}{!variants.length && <span className="text-ink-muted">Chưa có thiết bị.</span>}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-2"><Field label="Lời khuyên hiển thị" name="advice" defaultValue={r?.advice} rows={2} /><Field label="Slug bài hướng dẫn" name="articleSlug" defaultValue={r?.articleSlug} /></div>
        <Field label="Ghi chú nội bộ" name="note" defaultValue={r?.note} rows={2} />
      </div>
    </ActionForm>
  );

  return (
    <>
      <PageTitle title="Quy tắc chọn đèn" back="/admin/setups" tag={<SampleTag><Icon name="tag" className="mr-1.5 h-4 w-4" />Bảng quy tắc đã thử & duyệt</SampleTag>}>
        {cur && <Link href={`/admin/setups/rules/test?v=${cur.version}`} className="btn-line"><Icon name="play" /> Chạy thử</Link>}
        <ActionButton action={newRuleSet} label="+ Phiên bản mới" className="btn-primary" />
      </PageTitle>
      <div className="mb-5 flex flex-wrap gap-2">{sets.map((s) => (
        <Link key={s.version} href={`/admin/setups/rules?v=${s.version}`} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-semibold ${s.version === cur?.version ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white"}`}>v{s.version} <Badge status={s.status} /></Link>
      ))}</div>
      {!cur ? (
        <div className="card p-10 text-center"><p className="text-lg font-bold">Chưa có bảng quy tắc</p><p className="mt-1 text-ink-muted">Bấm “Phiên bản mới” để bắt đầu. Công cụ chọn đèn ngoài website chỉ chạy khi có phiên bản đã kích hoạt.</p></div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {conflicts.length > 0 && (
              <Notice tone="warn" title="Có quy tắc cùng mức ưu tiên" action={<Link href={`/admin/setups/rules/conflicts?v=${cur.version}`} className="btn-primary btn-sm">Xem & sửa</Link>}>
                {conflicts.length} cặp quy tắc có thể cùng khớp một đầu vào. Điều chỉnh điều kiện hoặc mức ưu tiên trước khi kích hoạt.
              </Notice>
            )}
            {rules.map((r) => (
              <Panel key={r.id} title={<span>{r.name} <span className="ml-1 text-base font-normal text-ink-muted">· ưu tiên {r.priority}</span></span>}
                actions={<span className="flex items-center gap-3">
                  {editable && <Link href={open === r.id ? `?v=${cur.version}` : `?v=${cur.version}&rule=${r.id}`} className="btn-line btn-sm">{open === r.id ? "Thu gọn" : "Sửa"}</Link>}
                  {editable && <ActionButton action={deleteRule} label="Xoá" className="btn-ghost btn-sm text-red-700" confirm="Xoá quy tắc?" fields={{ id: r.id, version: String(cur.version) }} />}
                </span>}>
                {editable && open === r.id ? <RuleForm r={r} /> : (
                  <dl className="grid gap-3 text-[15px] sm:grid-cols-3">
                    <div><dt className="text-ink-muted">Không gian</dt><dd className="font-medium">{lbl(AREA_OPTIONS, r.conditions.area)}</dd></div>
                    <div><dt className="text-ink-muted">Ngành hàng</dt><dd className="font-medium">{lbl(INDUSTRY_OPTIONS, r.conditions.industry)}</dd></div>
                    <div><dt className="text-ink-muted">Kiểu quay</dt><dd className="font-medium">{lbl(STYLE_OPTIONS, r.conditions.style)}</dd></div>
                    <div><dt className="text-ink-muted">Mẫu góc live</dt><dd>{setups.find((s) => s.id === r.setupId)?.title ?? "—"}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-ink-muted">Thiết bị gợi ý</dt><dd>{r.variantIds.map((v) => variants.find((x) => x.id === v)?.sku ?? "?").join(", ") || "—"}</dd></div>
                  </dl>
                )}
              </Panel>
            ))}
            {editable ? <Panel title="+ Thêm quy tắc"><RuleForm /></Panel> : <p className="text-sm text-ink-muted">Phiên bản đã kích hoạt/lưu trữ không sửa được. Tạo phiên bản mới để thay đổi.</p>}
          </div>
          <aside>
            <Panel title="Phiên bản">
              <div className="flex items-center gap-3"><IconBox icon="file" /><Badge status={cur.status} /><span className="text-ink-muted">v{cur.version}</span></div>
              <p className="mt-3 text-sm text-ink-muted">{cur.note}{cur.activatedAt ? ` · kích hoạt ${formatDateTimeVN(cur.activatedAt)}` : ""}</p>
              {editable && (can(u.roles, "rules.activate")
                ? <div className="mt-4"><ActionButton action={activateRuleSet} label={`Kích hoạt v${cur.version}`} icon="check" className="btn-primary w-full" confirm="Kích hoạt phiên bản này cho công cụ chọn đèn trên website?" fields={{ version: String(cur.version) }} /></div>
                : <p className="mt-3 text-xs text-ink-muted">Kích hoạt cần quyền Quản trị hệ thống.</p>)}
            </Panel>
            <Panel title="Kiểm tra xung đột">
              <div className="flex items-center gap-3"><IconBox icon="shield" tone={conflicts.length ? "brand" : "green"} /><Badge status={conflicts.length ? "pending_check" : "approved"} label={conflicts.length ? `${conflicts.length} cặp trùng` : rules.length ? "Không xung đột" : "Chưa có quy tắc"} /></div>
              <Link href={`/admin/setups/rules/conflicts?v=${cur.version}`} className="btn-primary mt-4 w-full"><Icon name="play" /> Kiểm tra quy tắc</Link>
              <Link href={`/admin/setups/rules/test?v=${cur.version}`} className="btn-line mt-2 w-full">Chạy thử đầu vào</Link>
            </Panel>
          </aside>
        </div>
      )}
    </>
  );
}
