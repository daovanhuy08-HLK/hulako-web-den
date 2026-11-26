// Màn 066 Chi tiết cơ hội từ khoá: từ khoá chính, nhóm / ý định / cụm / trang mục tiêu, nguồn & số liệu (thiếu → "Chưa có dữ liệu"),
// đề xuất Viết mới / Cập nhật / Gộp, lưu thay đổi, tạo brief (AI).
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray, isNotNull } from "drizzle-orm";
import { requirePage, requireUuid } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { SeoNav } from "@/components/admin/SeoNav";
import { Badge, IconBox, Num, PageTitle, Panel } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { runAgentJob } from "../../../../actions/seo";
import { updateOpportunity } from "../../../../actions/extra";

export const metadata = { title: "Chi tiết cơ hội từ khoá" };
const KINDS = [["", "— Chọn nhóm —"], ["sieu-rong", "Siêu rộng"], ["dai", "Từ khóa dài"], ["nganh", "Ngành"], ["san-pham", "Sản phẩm"], ["ngan", "Ngắn"], ["dia-ly", "Địa lý"], ["trend", "Xu hướng"]];
const INTENTS = [["", "—"], ["sau", "Tìm hướng dẫn"], ["rong", "Tìm hiểu chung"], ["san-pham", "Chọn / mua sản phẩm"], ["xu-ly-loi", "Xử lý lỗi"], ["xu-huong", "Xu hướng"]];
const SRC: Record<string, string> = { gsc: "Search Console", csv: "Nhập CSV", manual: "Nhập thủ công", consultant: "Đội tư vấn", ai_suggest: "AI đề xuất" };

export default async function OpportunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage("seo.view");
  const { id } = await params;
  requireUuid(id);
  const db = await getDb();
  const [o] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id));
  if (!o) notFound();
  const [kws, topics, arts] = await Promise.all([
    o.keywordIds.length ? db.select().from(schema.keywords).where(inArray(schema.keywords.id, o.keywordIds)) : Promise.resolve([]),
    db.select().from(schema.topics).orderBy(asc(schema.topics.sortOrder)),
    db.select({ id: schema.articles.id, title: schema.revisions.title }).from(schema.articles).innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId)).where(isNotNull(schema.articles.publishedRevisionId)),
  ]);
  const k = kws[0];
  const locked = !!o.draftArticleId;
  const canRun = can(u.roles, "seo.run_ai");
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="grid items-center gap-3 border-t border-[#EFECE8] py-3 first:border-0 md:grid-cols-[220px_1fr]"><span className="text-lg font-semibold">{label}</span>{children}</div>;

  return (
    <>
      <PageTitle title="Chi tiết cơ hội từ khóa" back="/admin/seo" subtitle={`Điểm ${Math.round(o.score)} · tạo ${formatDateTimeVN(o.createdAt)}`} tag={<Badge status={o.status} />} />
      <SeoNav current="" />
      <ActionForm action={updateOpportunity} buttons={null} toast id="opp-form">
        <input type="hidden" name="id" value={o.id} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel className="!mb-0">
            <div className="mb-3 flex items-center gap-4 border-b border-[#EFECE8] pb-5"><IconBox icon="search" size="lg" /><div><p className="font-semibold">Từ khóa chính</p><p className="text-2xl font-bold">{k?.query ?? o.title}</p>{k && k.variantsSeen.length > 1 && <p className="text-sm text-ink-muted">Biến thể: {k.variantsSeen.slice(1, 6).join(", ")}</p>}</div></div>
            <Row label="Nhóm"><select name="kind" defaultValue={k?.kind ?? ""} className="input" disabled={locked}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>
            <Row label="Ý định tìm kiếm"><select name="intent" defaultValue={k?.intent ?? ""} className="input" disabled={locked}>{INTENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>
            <Row label="Cụm chủ đề"><select name="cluster" defaultValue={k?.cluster ?? ""} className="input" disabled={locked}><option value="">— Chọn cụm —</option>{topics.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}</select></Row>
            <Row label="Trang mục tiêu"><select name="targetArticleId" defaultValue={o.targetArticleId ?? ""} className="input" disabled={locked}><option value="">Chọn trang mục tiêu</option>{arts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></Row>
            {o.rationale && <p className="mt-3 rounded-xl bg-[#F7F5F2] p-3 text-sm text-ink-soft"><b>Căn cứ:</b> {o.rationale}</p>}
            {o.competingUrls.length > 0 && <p className="mt-3 text-sm"><b>URL đang cạnh tranh cùng ý định:</b> {o.competingUrls.join(", ")}</p>}
          </Panel>
          <Panel title="Nguồn dữ liệu" className="!mb-0">
            <p className="input flex items-center bg-[#FBFAF8]">{SRC[k?.source ?? ""] ?? k?.source ?? "—"}</p>
            {[["Lượng tìm kiếm", k?.searchVolume], ["Xu hướng", k?.trendScore], ["Hiển thị (Search Console)", k?.impressions], ["Lượt nhấp", k?.clicks]].map(([l, v]) => (
              <div key={l as string} className="mt-4 border-t border-[#EFECE8] pt-4"><p className="mb-1.5 text-lg font-semibold">{l}</p><Num v={v as number | null | undefined} /></div>
            ))}
            <div className="mt-4 border-t border-[#EFECE8] pt-4"><p className="mb-1.5 text-lg font-semibold">Vị trí trung bình</p><Num v={k?.position} fmt={(n) => n.toFixed(1)} /></div>
          </Panel>
        </div>
        <Panel title="Đề xuất nội dung" className="mt-5">
          <div className="grid gap-4 md:grid-cols-3">
            {[["new", "Viết mới"], ["update", "Cập nhật bài"], ["merge", "Gộp bài"]].map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center gap-4 rounded-card border border-line px-5 py-4 text-lg has-[:checked]:border-brand has-[:checked]:bg-brand-tint">
                <input type="radio" name="type" value={v} defaultChecked={o.type === v || (v === "update" && o.type === "ctr_fix")} disabled={locked} />{l}
              </label>
            ))}
          </div>
          {o.type === "merge" && <p className="mt-3 text-sm text-ink-muted">Gộp bài: biên tập viên quyết định bài giữ lại, rồi tạo <Link href="/admin/seo/redirects" className="font-semibold text-brand-dark underline">chuyển hướng 301</Link> cho URL bị gộp.</p>}
        </Panel>
      </ActionForm>
      <div className="flex flex-wrap justify-end gap-3">
        {locked ? <Link href={`/admin/content/${o.draftArticleId}`} className="btn-primary"><Icon name="file" /> Mở bản nháp</Link> : (
          <>
            <button type="submit" form="opp-form" className="btn-outline min-w-[200px]">Lưu thay đổi</button>
            {canRun && o.type !== "merge" && <ActionButton action={runAgentJob} label="Tạo brief" icon="sparkles" className="btn-primary min-w-[200px]" fields={{ type: "write_draft", opportunityId: o.id }} confirm="Gửi AI lập brief + bản nháp cho cơ hội này?" />}
          </>
        )}
      </div>
    </>
  );
}
