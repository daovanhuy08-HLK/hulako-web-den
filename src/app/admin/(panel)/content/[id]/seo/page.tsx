// Màn 047 Thông tin SEO của bài viết: lưu thành một phiên bản nháp mới qua saveArticle (giữ nguyên nội dung hiện tại).
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePage, requireUuid } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { SITE_URL } from "@/lib/settings";
import { ActionForm } from "@/components/admin/ActionForm";
import { SeoEditor } from "@/components/admin/SeoEditor";
import { IconBox, PageTitle, Badge } from "@/components/admin/ui";
import { saveArticle } from "../../../../actions/content";

export const metadata = { title: "Thông tin SEO" };

export default async function ArticleSeo({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("content.edit");
  const { id } = await params;
  requireUuid(id);
  const db = await getDb();
  const [a] = await db.select().from(schema.articles).where(eq(schema.articles.id, id));
  if (!a) notFound();
  const [r] = a.draftRevisionId ? await db.select().from(schema.revisions).where(eq(schema.revisions.id, a.draftRevisionId)) : [];
  if (!r) notFound();
  const base = a.kind === "news" ? "/tin-tuc" : "/kien-thuc";
  const H = ({ n, v }: { n: string; v: string | null | undefined }) => <input type="hidden" name={n} value={v ?? ""} />;

  return (
    <>
      <PageTitle title="Thông tin SEO của bài viết" back={`/admin/content/${a.id}`} />
      <section className="card mb-5 flex flex-wrap items-center gap-4 p-5">
        <IconBox icon="file" size="lg" /><p className="flex-1 text-2xl font-bold">{r.title}</p><Badge status={a.status} />
      </section>
      <ActionForm action={saveArticle} submitLabel="Lưu nháp" submitIcon="save">
        {/* Giữ nguyên các trường nội dung của bản nháp hiện tại */}
        <H n="id" v={a.id} /><H n="version" v={String(a.version)} /><H n="kind" v={a.kind} /><H n="title" v={r.title} /><H n="summary" v={r.summary} />
        <H n="body" v={r.body} /><H n="topicId" v={a.topicId} /><H n="targetKeyword" v={a.targetKeyword} /><H n="factChecks" v={r.factChecks.join("\n")} />
        {a.featured && <H n="featured" v="on" />}{a.isSample && <H n="isSample" v="on" />}
        {r.relatedProductIds.map((p) => <input key={p} type="hidden" name="relatedProductIds" value={p} />)}
        {r.relatedSetupIds.map((s) => <input key={s} type="hidden" name="relatedSetupIds" value={s} />)}
        <SeoEditor seoTitle={r.seoTitle} seoDescription={r.seoDescription} slug={a.slug} base={base} site={SITE_URL}
          canonical={`${SITE_URL}${base}/${a.slug}`} coverUrl={r.coverUrl ?? ""} coverAlt={r.coverAlt}
          indexNote={a.publishedRevisionId ? "Đang được lập chỉ mục (bài đã xuất bản)" : "Theo trạng thái xuất bản — chưa lập chỉ mục khi chưa công khai"} />
        <p className="mt-3 text-sm text-ink-muted">Lưu sẽ tạo bản nháp mới; bài đang chờ duyệt/đã duyệt sẽ quay về Nháp để duyệt lại.</p>
      </ActionForm>
    </>
  );
}
