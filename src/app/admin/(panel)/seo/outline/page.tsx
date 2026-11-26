// Màn 036 Tạo đề cương bằng AI: biên tập viên nhập chủ đề + từ khoá chính → lưu thành cơ hội ("Lưu brief")
// hoặc gửi AI lập brief + bản nháp ("Tạo đề cương" — tác vụ write_draft). Đề cương xem trước lấy từ brief của cơ hội.
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { aiConfigured } from "@/lib/ai/claude";
import { ActionForm } from "@/components/admin/ActionForm";
import { SeoNav } from "@/components/admin/SeoNav";
import { Badge, IconBox, Notice, PageTitle, SampleTag } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { createOutline } from "../../../actions/extra";

export const metadata = { title: "Tạo đề cương bằng AI" };
const INTENTS = [["sau", "Tìm hướng dẫn"], ["rong", "Tìm hiểu chung"], ["san-pham", "Chọn / mua sản phẩm"], ["xu-ly-loi", "Xử lý lỗi"], ["xu-huong", "Xu hướng"]];
type Brief = { outline?: string[]; intent?: string; primaryQuery?: string; secondaryQueries?: string[]; photosNeeded?: string[]; productSkus?: string[]; internalLinks?: string[] };

export default async function Outline({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage("seo.view");
  const sp = await searchParams;
  const db = await getDb();
  const [products, topics] = await Promise.all([
    db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).orderBy(asc(schema.products.name)),
    db.select().from(schema.topics).orderBy(asc(schema.topics.sortOrder)),
  ]);
  const [opp] = sp.opp ? await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, sp.opp)) : [];
  const [kw] = opp?.keywordIds[0] ? await db.select().from(schema.keywords).where(eq(schema.keywords.id, opp.keywordIds[0])) : [];
  const [job] = sp.job ? await db.select().from(schema.aiJobs).where(eq(schema.aiJobs.id, sp.job)) : [];
  const brief = (opp?.brief ?? null) as Brief | null;
  const ev = (opp?.evidence ?? {}) as { nguonThamKhao?: string[]; sanPham?: string[] };
  const canRun = can(u.roles, "seo.run_ai");
  const Row = ({ icon, label, children }: { icon: Parameters<typeof IconBox>[0]["icon"]; label: string; children: React.ReactNode }) => (
    <div className="grid items-start gap-3 md:grid-cols-[230px_1fr]"><span className="flex items-center gap-3 pt-1 font-semibold"><IconBox icon={icon} size="sm" />{label}</span><div>{children}</div></div>
  );

  return (
    <>
      <PageTitle title="Tạo đề cương bằng AI" subtitle={<SampleTag><Icon name="sparkles" className="mr-1.5 h-4 w-4" />AI chỉ tạo đề xuất & bản nháp — người duyệt quyết định đăng</SampleTag>} />
      <SeoNav current="/admin/seo/outline" />
      {!aiConfigured() && <Notice tone="warn" title="Chưa cấu hình runner AI">Vẫn lưu brief được; “Tạo đề cương” sẽ báo chưa cấu hình. <Link href="/admin/seo/sources?tab=ai" className="font-semibold underline">Xem cấu hình</Link></Notice>}
      {job && <Notice tone={job.status === "failed" ? "error" : job.status === "done" ? "ok" : "info"} title={`Tác vụ AI: ${job.status === "done" ? "hoàn thành" : job.status === "failed" ? "thất bại" : "đang xử lý"}`} action={<Link href={`/admin/seo/jobs/${job.id}`} className="btn-line btn-sm">Chi tiết</Link>}>{job.error ?? (job.status === "done" ? "Đề cương và bản nháp đã sẵn sàng." : "Tải lại trang sau ít phút.")}</Notice>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
        <ActionForm action={createOutline} buttons={null} className="card p-6" key={opp?.id ?? "new"}>
          <div className="space-y-5">
            <Row icon="file" label="Chủ đề"><input name="topic" defaultValue={opp?.title ?? ""} placeholder="vd Setup góc livestream phòng nhỏ" className="input" aria-label="Chủ đề" /></Row>
            <Row icon="tag" label="Từ khóa chính"><input name="keyword" defaultValue={kw?.query ?? sp.keyword ?? ""} placeholder="vd cách đặt đèn trong phòng nhỏ" className="input" aria-label="Từ khoá chính" /></Row>
            <Row icon="target" label="Ý định tìm kiếm"><select name="intent" defaultValue={kw?.intent ?? "sau"} className="input" aria-label="Ý định">{INTENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>
            <Row icon="folder" label="Cụm chủ đề"><select name="cluster" defaultValue={kw?.cluster ?? sp.cluster ?? ""} className="input" aria-label="Cụm chủ đề"><option value="">— Chọn cụm —</option>{topics.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}</select></Row>
            <Row icon="box" label="Sản phẩm liên quan">
              <div className="adm-scroll max-h-36 space-y-1.5 overflow-auto rounded-[10px] border border-line p-3 text-sm">{products.map((p) => <label key={p.id} className="flex items-center gap-2"><input type="checkbox" name="productIds" value={p.id} defaultChecked={ev.sanPham?.includes(p.id)} />{p.name}</label>)}{!products.length && <span className="text-ink-muted">Chưa có sản phẩm (nếu có)</span>}</div>
            </Row>
            <Row icon="book" label="Nguồn tham khảo"><textarea name="references" rows={4} defaultValue={ev.nguonThamKhao?.join("\n")} placeholder="Mỗi dòng một nguồn (nếu có) — tài liệu nội bộ, câu hỏi khách hay hỏi…" className="input" aria-label="Nguồn tham khảo" /></Row>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_2fr]">
            <button type="submit" name="then" value="save" className="btn-line"><Icon name="bookmark" /> Lưu brief</button>
            <button type="submit" name="then" value="run" className="btn-primary" disabled={!canRun}><Icon name="sparkles" /> Tạo đề cương</button>
          </div>
          {!canRun && <p className="mt-2 text-xs text-ink-muted">Chạy AI cần vai trò Biên tập viên SEO hoặc Quản trị.</p>}
        </ActionForm>
        <section className="card flex flex-col p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">Đề cương xem trước</h2>{opp && <Badge status={opp.status} />}</div>
          {brief?.outline?.length ? (
            <>
              <ol className="space-y-3">{brief.outline.map((o, i) => <li key={i} className="flex items-center gap-4 rounded-card border border-line px-4 py-3"><span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-soft font-bold text-brand">{i + 1}</span>{o}</li>)}</ol>
              <dl className="mt-4 space-y-1 text-sm text-ink-soft">
                {brief.secondaryQueries?.length ? <div><dt className="inline font-semibold">Truy vấn phụ: </dt><dd className="inline">{brief.secondaryQueries.join(", ")}</dd></div> : null}
                {brief.photosNeeded?.length ? <div><dt className="inline font-semibold">Ảnh cần chụp: </dt><dd className="inline">{brief.photosNeeded.join("; ")}</dd></div> : null}
              </dl>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-card border-2 border-dashed border-line p-8 text-center text-ink-muted">
              <Icon name="file" className="h-10 w-10" />
              <p className="mt-2 font-semibold text-ink">{opp ? "Chưa có đề cương" : "Nhập chủ đề và từ khoá chính"}</p>
              <p className="text-sm">{opp ? "Bấm “Tạo đề cương” để AI lập brief + bản nháp." : "Đề cương do AI lập sẽ hiện ở đây."}</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            {opp && <Link href={`/admin/seo/opportunities/${opp.id}`} className="btn-line">Mở cơ hội</Link>}
            {opp?.draftArticleId && <Link href={`/admin/content/${opp.draftArticleId}`} className="btn-primary"><Icon name="file" /> Chuyển sang bài nháp</Link>}
          </div>
        </section>
      </div>
    </>
  );
}
