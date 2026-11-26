// Màn 046 Chủ đề và cụm nội dung (bảng topics): danh sách trái, sửa tên/đường dẫn/mô tả giữa, thống kê + bài liên quan.
import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { SeoNav } from "@/components/admin/SeoNav";
import { Badge, Field, LinkRow, PageTitle, Panel } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { deleteTopic, saveTopic } from "../../../actions/extra";

export const metadata = { title: "Chủ đề và cụm nội dung" };

export default async function Topics({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage(["seo.view", "content.edit"]);
  const sp = await searchParams;
  const db = await getDb();
  const topics = await db.select({ t: schema.topics, n: sql<number>`(select count(*)::int from articles a where a.topic_id = "topics"."id")` }).from(schema.topics).orderBy(asc(schema.topics.sortOrder), asc(schema.topics.name));
  const cur = sp.id === "new" ? undefined : topics.find((x) => x.t.id === sp.id)?.t ?? (sp.id ? undefined : topics[0]?.t);
  const [arts, kws] = cur ? await Promise.all([
    db.select({ id: schema.articles.id, status: schema.articles.status, title: schema.revisions.title }).from(schema.articles)
      .leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId)).where(eq(schema.articles.topicId, cur.id)).orderBy(desc(schema.articles.updatedAt)).limit(20),
    db.select({ query: schema.keywords.query, impressions: schema.keywords.impressions }).from(schema.keywords).where(eq(schema.keywords.cluster, cur.slug)).orderBy(desc(sql`coalesce(${schema.keywords.impressions}, ${schema.keywords.searchVolume}, 0)`)).limit(8),
  ]) : [[], []];
  const canEdit = can(u.roles, "content.edit");

  return (
    <>
      <PageTitle title="Chủ đề và cụm nội dung">
        {canEdit && <Link href="/admin/seo/topics?id=new" className="btn-primary"><Icon name="plus" /> Thêm chủ đề</Link>}
      </PageTitle>
      <SeoNav current="/admin/seo/topics" />
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside className="card h-fit p-3">
          {topics.map(({ t, n }) => (
            <Link key={t.id} href={`?id=${t.id}`} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 ${t.id === cur?.id ? "bg-brand-soft font-semibold text-brand-dark" : "hover:bg-black/[.03]"}`}>
              <Icon name="folder" className={t.id === cur?.id ? "h-5 w-5 text-brand" : "h-5 w-5 text-ink-muted"} /><span className="flex-1">{t.name}</span><span className="text-xs text-ink-muted">{n}</span><Icon name="chevronRight" className="h-4 w-4" />
            </Link>
          ))}
          {!topics.length && <p className="p-3 text-sm text-ink-muted">Chưa có chủ đề. Cụm đầu tiên gợi ý: setup phòng nhỏ, ánh sáng bán quần áo, chọn và lắp softbox.</p>}
        </aside>
        {canEdit && (cur || sp.id === "new") ? (
          <ActionForm action={saveTopic} buttons={null} toast key={cur?.id ?? "new"} className="contents">
            <input type="hidden" name="id" value={cur?.id ?? ""} />
            <Panel className="!mb-0">
              <div className="space-y-4">
                <Field label="Tên chủ đề" name="name" defaultValue={cur?.name} required />
                <div><label htmlFor="t-slug" className="mb-1.5 block text-[15px] font-semibold">Đường dẫn</label>
                  <div className="flex items-center rounded-[10px] border border-line bg-white pl-3.5 focus-within:border-brand"><span className="whitespace-nowrap text-ink-muted">/kien-thuc/chu-de/</span><input id="t-slug" name="slug" defaultValue={cur?.slug} className="min-h-[46px] w-full rounded-r-[10px] border-0 bg-transparent px-1 focus:outline-none" /></div></div>
                <Field label="Mô tả chủ đề (hiện ở trang chủ đề)" name="intro" defaultValue={cur?.intro} rows={4} />
                <Field label="Thứ tự" name="sortOrder" type="number" defaultValue={cur?.sortOrder ?? 0} />
                <div><p className="mb-2 text-[15px] font-semibold">Bài trong chủ đề</p>
                  <div className="rounded-card border border-line px-4">{arts.length ? arts.map((a) => <LinkRow key={a.id} href={`/admin/content/${a.id}`} icon="file" sub={<Badge status={a.status} />}>{a.title ?? "(chưa có tiêu đề)"}</LinkRow>) : <p className="py-4 text-sm text-ink-muted">Chưa có bài.</p>}</div></div>
              </div>
            </Panel>
            <Panel className="!mb-0 h-fit">
              <p className="mb-2 font-semibold">Trạng thái</p>
              <Badge status={cur ? "public" : "draft"} label={cur ? (arts.some((a) => a.status === "published") ? "Có bài công khai" : "Chưa có bài công khai") : "Chủ đề mới"} />
              <p className="mb-2 mt-5 font-semibold">Từ khóa mục tiêu (cụm “{cur?.slug ?? "…"}”)</p>
              {kws.length ? <ul className="space-y-1 text-sm">{kws.map((k) => <li key={k.query} className="flex justify-between gap-2"><span>{k.query}</span><span className="text-ink-muted">{k.impressions ?? "—"}</span></li>)}</ul> : <p className="text-sm text-ink-muted">Chưa có từ khoá gắn cụm này.</p>}
              <button type="submit" className="btn-primary mt-6 w-full"><Icon name="save" /> Lưu chủ đề</button>
              {cur && can(u.roles, "content.review") && <div className="mt-3"><ActionButton action={deleteTopic} label="Xoá chủ đề" className="btn-ghost btn-sm w-full text-red-700" confirm="Xoá chủ đề này? (chỉ xoá được khi không còn bài)" fields={{ id: cur.id }} /></div>}
            </Panel>
          </ActionForm>
        ) : <div className="card flex items-center justify-center p-10 text-ink-muted xl:col-span-2">{canEdit ? "Chọn chủ đề bên trái." : "Sửa chủ đề cần quyền sửa nội dung."}</div>}
      </div>
    </>
  );
}
