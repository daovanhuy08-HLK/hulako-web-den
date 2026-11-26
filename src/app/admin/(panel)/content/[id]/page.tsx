// A03 Trình soạn bài (màn 009; trạng thái "yêu cầu sửa" = màn 067; xung đột khi lưu = màn 059 qua ActionForm).
// Nội dung bên trái, cột phải: trạng thái + quy trình duyệt, chủ đề, SEO, liên kết nội bộ, dữ kiện cần kiểm chứng.
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requirePage, requireUuidOrNew } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { checkClaims } from "@/lib/guardrails";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm, SubmitFor } from "@/components/admin/ActionForm";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { Badge, DemoCheckbox, Field, IconBox, Notice, PageTitle, Panel, SampleTag } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { deleteDraftArticle, saveArticle, transition } from "../../../actions/content";

export const metadata = { title: "Soạn bài viết" };

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage("content.edit");
  const { id } = await params;
  requireUuidOrNew(id);
  const db = await getDb();
  const isNew = id === "new";
  const [row] = isNew ? [] : await db.select().from(schema.articles).where(eq(schema.articles.id, id));
  if (!isNew && !row) notFound();
  const [rev] = row?.draftRevisionId ? await db.select().from(schema.revisions).where(eq(schema.revisions.id, row.draftRevisionId)) : [];
  const [topics, products, setups, opp, reviewer] = await Promise.all([
    db.select().from(schema.topics).orderBy(asc(schema.topics.sortOrder)),
    db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).orderBy(asc(schema.products.name)),
    db.select({ id: schema.setups.id, title: schema.setups.title }).from(schema.setups).orderBy(asc(schema.setups.title)),
    row ? db.select().from(schema.opportunities).where(eq(schema.opportunities.draftArticleId, row.id)) : Promise.resolve([]),
    row?.reviewerId ? db.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, row.reviewerId)) : Promise.resolve([]),
  ]);
  const issues = rev ? checkClaims({ "Tiêu đề": rev.title, "Mô tả ngắn": rev.summary, "Nội dung": rev.body, "SEO title": rev.seoTitle, "Meta description": rev.seoDescription, "Alt ảnh": rev.coverAlt }) : [];
  const isReviewer = can(u.roles, "content.review");
  const canSubmit = can(u.roles, "content.submit");
  const st = row?.status;
  const needsFix = !!(row?.reviewComment && st === "draft");
  const T = (action: string, label: string, cls = "btn-line btn-sm", confirm?: string, icon?: string) =>
    <ActionButton action={transition} label={label} className={cls} confirm={confirm} icon={icon} fields={{ id: row!.id, action, revisionId: row!.draftRevisionId ?? "" }} />;
  const comments = (row?.reviewComment ?? "").split(/\r?\n|;\s*/).map((s) => s.trim()).filter(Boolean);
  const brief = opp[0]?.brief as { outline?: string[]; intent?: string; primaryQuery?: string; secondaryQueries?: string[]; photosNeeded?: string[]; internalLinks?: string[] } | null | undefined;

  return (
    <>
      <PageTitle title={needsFix ? "Bài viết cần chỉnh sửa" : isNew ? "Soạn bài viết" : "Soạn bài viết"} back="/admin/content">
        {rev && <Link className="btn-line" target="_blank" href={`/admin/preview/${rev.id}`}><Icon name="eye" /> Xem trước</Link>}
        <SubmitFor form="article-form" label={isNew ? "Tạo bản nháp" : "Lưu nháp"} className="btn-line" icon="save" />
        {(isNew || st === "draft") && canSubmit && <SubmitFor form="article-form" name="then" value="submit" label={needsFix ? "Gửi duyệt lại" : "Gửi duyệt"} icon="send" />}
        {isReviewer && st === "review" && <Link href={`/admin/content/${row!.id}/review`} className="btn-primary"><Icon name="checkCircle" /> Duyệt bài</Link>}
      </PageTitle>

      {needsFix && rev && (
        <section className="card mb-5 flex flex-wrap items-center gap-4 p-5">
          <IconBox icon="file" size="lg" />
          <div><p className="text-xl font-bold">{rev.title}</p><div className="mt-2 flex flex-wrap gap-2">{row!.isSample && <SampleTag tone="muted">Nội dung minh họa</SampleTag>}<SampleTag>Yêu cầu sửa</SampleTag></div></div>
        </section>
      )}
      {row?.publishedRevisionId && row.draftRevisionId !== row.publishedRevisionId && (
        <Notice tone="info" icon="info">Bài đang công khai với phiên bản cũ. Bản nháp dưới đây chỉ thay thế bản công khai sau khi được duyệt và xuất bản.
          {" "}<Link className="font-semibold text-brand-dark underline" target="_blank" href={`/${row.kind === "news" ? "tin-tuc" : "kien-thuc"}/${row.slug}`}>Xem bản công khai ↗</Link></Notice>
      )}
      {issues.length > 0 && (
        <Notice tone="error" title="Claim bị chặn theo quy tắc biên tập HULAKO — sửa trước khi gửi duyệt">
          <ul className="mt-1 list-disc pl-5">{issues.map((i, n) => <li key={n}>{i.field}: “{i.match}” — {i.hint}</li>)}</ul>
        </Notice>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Cột phải — phần ngoài form: trạng thái & quy trình duyệt */}
        <aside className="xl:col-start-2 xl:row-start-1">
          <Panel title="Trạng thái" className="!mb-0">
            <div className="flex flex-wrap items-center gap-2">
              {row ? <Badge status={row.status} /> : <Badge status="draft" />}
              {row?.publishedRevisionId && <Badge status="published" label="Đang công khai" />}
              {row?.aiGenerated && <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[13px] font-semibold text-[#3730A3]">AI viết</span>}
            </div>
            {st === "scheduled" && <p className="mt-3 text-sm">Sẽ xuất bản lúc <b>{formatDateTimeVN(row!.scheduledAt)}</b> (giờ Việt Nam).</p>}
            {row && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#EFECE8] pt-4">
                {isReviewer && st === "review" && T("approve", "Duyệt", "btn-primary btn-sm", undefined, "check")}
                {isReviewer && ["review", "approved", "scheduled"].includes(st!) && (
                  <ActionForm action={transition} submitLabel="Yêu cầu sửa" className="w-full" buttons={<button className="btn-outline btn-sm">Yêu cầu sửa</button>}>
                    <input type="hidden" name="id" value={row.id} /><input type="hidden" name="action" value="request_changes" />
                    <textarea name="reason" rows={2} placeholder="Nhận xét cho biên tập viên (mỗi ý một dòng)" className="input text-sm" aria-label="Nhận xét" />
                  </ActionForm>
                )}
                {isReviewer && ["approved", "scheduled"].includes(st!) && T("publish", "Xuất bản ngay", "btn-primary btn-sm", "Xuất bản bản đã duyệt lên website?", "send")}
                {isReviewer && st === "approved" && <Link href={`/admin/content/calendar?article=${row.id}`} className="btn-line btn-sm"><Icon name="calendar" /> Lên lịch</Link>}
                {isReviewer && row.publishedRevisionId && T("unpublish", "Gỡ khỏi website", "btn-line btn-sm", "Gỡ bài khỏi website?")}
                {isReviewer && st !== "archived" && T("archive", "Lưu trữ", "btn-line btn-sm", "Lưu trữ bài này?")}
                {isReviewer && !row.publishedRevisionId && <ActionButton action={deleteDraftArticle} label="Xoá bản nháp" className="btn-ghost btn-sm text-red-700" confirm="Xoá vĩnh viễn bản nháp này?" fields={{ id: row.id }} />}
              </div>
            )}
            {!isReviewer && row && <p className="mt-3 text-xs text-ink-muted">Duyệt, lên lịch và xuất bản cần vai trò Người duyệt nội dung.</p>}
            {row && (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#EFECE8] pt-4 text-sm">
                <Link href={`/admin/content/${row.id}/history`} className="flex items-center gap-2 font-semibold text-brand-dark hover:underline"><Icon name="history" className="h-4 w-4" /> Lịch sử phiên bản</Link>
                <Link href={`/admin/content/${row.id}/seo`} className="flex items-center gap-2 font-semibold text-brand-dark hover:underline"><Icon name="globe" className="h-4 w-4" /> Thông tin SEO</Link>
              </div>
            )}
          </Panel>
          {needsFix && (
            <>
              <Panel title="Nhận xét người duyệt" className="mt-5 !mb-0">
                {comments.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 border-t border-[#EFECE8] py-3 first:border-0"><IconBox icon="message" size="sm" /><p className="pt-2">{c}</p></div>
                ))}
                {reviewer[0] && <p className="mt-2 text-xs text-ink-muted">Người duyệt: {reviewer[0].name || reviewer[0].email}</p>}
              </Panel>
              <Panel title="Hạng mục cần kiểm tra" className="mt-5 !mb-0">
                {["Ảnh sản phẩm", "Thông số", "Liên kết", "Nguồn thông tin"].map((x) => (
                  <label key={x} className="flex items-center gap-3 border-t border-[#EFECE8] py-3 first:border-0"><input type="checkbox" /> {x}</label>
                ))}
                <p className="mt-2 text-xs text-ink-muted">Danh sách tự kiểm, không lưu lại.</p>
              </Panel>
            </>
          )}
        </aside>

        <ActionForm action={saveArticle} id="article-form" toast buttons={null} className="contents">
          <input type="hidden" name="id" value={row?.id ?? ""} />
          <input type="hidden" name="version" value={row?.version ?? 0} />
          <div className="space-y-5 xl:col-start-1 xl:row-span-2 xl:row-start-1">
            <section className="card space-y-5 p-5 sm:p-6">
              <Field label="Tiêu đề bài viết" name="title" defaultValue={rev?.title} required />
              <Field label="Mô tả ngắn (hiện dưới tiêu đề)" name="summary" defaultValue={rev?.summary} rows={2} />
              <MarkdownField label="Nội dung bài viết" name="body" defaultValue={rev?.body} rows={26} required
                hint="Markdown: ## mục, ### bước, - danh sách, ![alt](url ảnh đã duyệt), [chữ](/duong-dan). Video: <video src='...'></video>" />
            </section>
            {brief && (
              <Panel title="Brief từ AI Agent" icon="sparkles" id="brief">
                {brief.outline && <ol className="space-y-2">{brief.outline.map((o, i) => <li key={i} className="flex gap-3"><span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>{o}</li>)}</ol>}
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  {brief.intent && <div><dt className="text-ink-muted">Ý định</dt><dd>{brief.intent}</dd></div>}
                  {brief.primaryQuery && <div><dt className="text-ink-muted">Truy vấn chính</dt><dd>{brief.primaryQuery}</dd></div>}
                  {!!brief.photosNeeded?.length && <div><dt className="text-ink-muted">Ảnh cần chụp</dt><dd>{brief.photosNeeded.join("; ")}</dd></div>}
                  {!!brief.internalLinks?.length && <div><dt className="text-ink-muted">Liên kết nội bộ đề xuất</dt><dd>{brief.internalLinks.join(", ")}</dd></div>}
                </dl>
                <p className="mt-3 text-xs text-ink-muted">Căn cứ: {opp[0]!.rationale}</p>
              </Panel>
            )}
          </div>

          <div className="space-y-5 xl:col-start-2 xl:row-start-2">
            <Panel title="Chủ đề & phân loại" className="!mb-0">
              <div className="space-y-4">
                <Field label="Chủ đề" name="topicId" required defaultValue={row?.topicId} options={[{ value: "", label: "— Chọn chủ đề —" }, ...topics.map((t) => ({ value: t.id, label: t.name }))]} />
                <Field label="Từ khoá mục tiêu" name="targetKeyword" defaultValue={row?.targetKeyword} />
                <Field label="Loại bài" name="kind" defaultValue={row?.kind ?? "guide"} options={[{ value: "guide", label: "Kiến thức (hướng dẫn lâu dài)" }, { value: "news", label: "Tin tức" }]} />
                <Field label="Đường dẫn (slug)" name="slug" defaultValue={row?.slug} hint="Để trống: tạo từ tiêu đề. Đổi slug bài đã đăng sẽ tự tạo chuyển hướng 301." />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={row?.featured} /> Nổi bật ở trang chủ</label>
                <DemoCheckbox defaultChecked={row?.isSample} />
              </div>
            </Panel>
            <Panel title="Tiêu đề SEO" className="!mb-0">
              <div className="space-y-4">
                <Field label="Tiêu đề SEO" name="seoTitle" defaultValue={rev?.seoTitle} hint="≤ 65 ký tự" />
                <Field label="Mô tả tìm kiếm" name="seoDescription" defaultValue={rev?.seoDescription} rows={4} hint="140–160 ký tự" />
                <Field label="Ảnh đại diện (URL)" name="coverUrl" defaultValue={rev?.coverUrl} hint="Lấy từ Thư viện ảnh (ảnh đã duyệt)" />
                <Field label="Alt ảnh đại diện" name="coverAlt" defaultValue={rev?.coverAlt} />
              </div>
            </Panel>
            <Panel title="Liên kết nội bộ" className="!mb-0">
              <fieldset><legend className="mb-1.5 text-sm font-semibold">Thiết bị liên quan</legend>
                <div className="adm-scroll max-h-44 space-y-1.5 overflow-auto text-sm">{products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"><Icon name="link" className="h-4 w-4 text-ink-muted" /><input type="checkbox" name="relatedProductIds" value={p.id} defaultChecked={rev?.relatedProductIds.includes(p.id)} />{p.name}</label>
                ))}{!products.length && <p className="text-ink-muted">Chưa có sản phẩm.</p>}</div></fieldset>
              <fieldset className="mt-4"><legend className="mb-1.5 text-sm font-semibold">Mẫu góc live liên quan</legend>
                <div className="adm-scroll max-h-44 space-y-1.5 overflow-auto text-sm">{setups.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"><Icon name="link" className="h-4 w-4 text-ink-muted" /><input type="checkbox" name="relatedSetupIds" value={s.id} defaultChecked={rev?.relatedSetupIds.includes(s.id)} />{s.title}</label>
                ))}{!setups.length && <p className="text-ink-muted">Chưa có mẫu góc live.</p>}</div></fieldset>
            </Panel>
            <Panel title="Dữ kiện cần kiểm chứng" className="!mb-0">
              <Field label="Mỗi dòng một mục" name="factChecks" defaultValue={rev?.factChecks.join("\n")} rows={4} hint="Người duyệt kiểm thao tác, model, thông số, chính sách rồi xoá dòng đã kiểm." />
              {rev?.sources.length ? <p className="mt-2 text-xs text-ink-muted">Nguồn: {rev.sources.join(" · ")}</p> : null}
            </Panel>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
