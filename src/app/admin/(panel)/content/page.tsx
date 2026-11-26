// A03 Danh sách bài (màn 028): tìm, lọc chủ đề/trạng thái/loại/AI, thẻ trạng thái, phân trang, sắp xếp.
import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { Badge, PageTitle, SampleTag, SearchInput, Table, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { ARTICLE_STATUS } from "@/lib/db/schema";

export const metadata = { title: "Nội dung" };
type SP = Promise<Record<string, string | undefined>>;
const PAGE = 20;
const STATUS_LABEL: Record<string, string> = { draft: "Bản nháp", review: "Chờ duyệt", approved: "Đã duyệt", scheduled: "Đã lên lịch", published: "Đã xuất bản", archived: "Lưu trữ" };

export default async function ContentList({ searchParams }: { searchParams: SP }) {
  await requirePage("content.edit");
  const sp = await searchParams;
  const db = await getDb();
  const base: SQL[] = [];
  if (sp.kind === "news" || sp.kind === "guide") base.push(eq(schema.articles.kind, sp.kind));
  if (sp.ai === "1") base.push(eq(schema.articles.aiGenerated, true));
  if (sp.topic) base.push(eq(schema.articles.topicId, sp.topic));
  if (sp.q) base.push(or(ilike(schema.revisions.title, `%${sp.q}%`), ilike(schema.articles.slug, `%${sp.q}%`), ilike(schema.articles.targetKeyword, `%${sp.q}%`))!);
  const where = [...base];
  if (sp.status && (ARTICLE_STATUS as readonly string[]).includes(sp.status)) where.push(eq(schema.articles.status, sp.status as never));
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = sp.sort === "title" ? asc(schema.revisions.title) : sp.sort === "old" ? asc(schema.articles.updatedAt) : desc(schema.articles.updatedAt);
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }], counts, topics] = await Promise.all([
    db.select({ a: schema.articles, title: schema.revisions.title, topic: schema.topics.name })
      .from(schema.articles)
      .leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId))
      .leftJoin(schema.topics, eq(schema.topics.id, schema.articles.topicId))
      .where(cond).orderBy(sort).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.articles)
      .leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId)).where(cond),
    db.select({ s: schema.articles.status, n: sql<number>`count(*)::int` }).from(schema.articles)
      .leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId)).where(base.length ? and(...base) : undefined).groupBy(schema.articles.status),
    db.select().from(schema.topics).orderBy(asc(schema.topics.sortOrder)),
  ]);
  const qs = (o: Record<string, string | undefined>) => `/admin/content?${new URLSearchParams(Object.entries({ ...sp, page: undefined, ...o } as Record<string, string | undefined>).filter((e): e is [string, string] => !!e[1]))}`;
  const all = counts.reduce((s, c) => s + Number(c.n), 0);
  const pages = Math.max(1, Math.ceil(Number(total) / PAGE));

  return (
    <>
      <PageTitle title="Quản lý bài viết">
        <Link href="/admin/content/calendar" className="btn-line"><Icon name="calendar" /> Lịch xuất bản</Link>
        <Link href="/admin/content/new" className="btn-primary"><Icon name="plus" /> Tạo bài viết</Link>
      </PageTitle>
      <form className="mb-5 grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_auto]">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <SearchInput defaultValue={sp.q} placeholder="Tìm kiếm bài viết, slug, từ khoá…" />
        <select name="topic" defaultValue={sp.topic ?? ""} className="input" aria-label="Chủ đề">
          <option value="">Chọn chủ đề</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="kind" defaultValue={sp.kind ?? ""} className="input" aria-label="Loại bài"><option value="">Mọi loại bài</option><option value="guide">Kiến thức</option><option value="news">Tin tức</option></select>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 whitespace-nowrap text-sm"><input type="checkbox" name="ai" value="1" defaultChecked={sp.ai === "1"} /> Chỉ bài AI</label>
          <button className="btn-line">Lọc</button>
        </div>
      </form>
      <Tabs variant="underline" current={sp.status ?? "all"}
        tabs={[{ key: "all", label: "Tất cả", href: qs({ status: undefined }), count: all }, ...ARTICLE_STATUS.map((s) => ({ key: s, label: STATUS_LABEL[s], href: qs({ status: s }), count: Number(counts.find((c) => c.s === s)?.n ?? 0) }))]}
        extra={<Link href={qs({ sort: sp.sort === "title" ? undefined : "title" })} className="whitespace-nowrap text-sm text-ink-muted hover:text-brand-dark">Sắp xếp: {sp.sort === "title" ? "theo tiêu đề" : "mới cập nhật"}</Link>} />
      <Table head={["Tiêu đề", "Chủ đề", "Trạng thái", "Cập nhật", "Thao tác"]} empty={!rows.length} emptyText="Không có bài nào khớp bộ lọc.">
        {rows.map(({ a, title, topic }) => (
          <tr key={a.id}>
            <td>
              <Link href={`/admin/content/${a.id}`} className="flex items-center gap-4 hover:text-brand-dark">
                <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon name="file" className="h-6 w-6" /></span>
                <span>
                  <span className="block text-[16px] font-bold">{title ?? "(chưa có tiêu đề)"}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {a.isSample && <SampleTag>Bài mẫu</SampleTag>}
                    {a.aiGenerated && <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-semibold text-[#3730A3]">AI viết</span>}
                    {a.kind === "news" && <span className="rounded-full bg-[#EFEDEA] px-2.5 py-0.5 text-xs font-semibold text-ink-soft">Tin tức</span>}
                    {a.publishedRevisionId && a.status !== "published" && <span className="rounded-full bg-[#E7F6EC] px-2.5 py-0.5 text-xs font-semibold text-[#1E7B3C]">Đang công khai bản cũ</span>}
                    {a.reviewComment && a.status === "draft" && <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark">Yêu cầu sửa</span>}
                  </span>
                </span>
              </Link>
            </td>
            <td className="text-ink-soft">{topic ?? "—"}</td>
            <td><Badge status={a.status} /></td>
            <td className="whitespace-nowrap text-sm text-ink-muted">{formatDateTimeVN(a.updatedAt)}</td>
            <td><Link href={a.status === "review" ? `/admin/content/${a.id}/review` : `/admin/content/${a.id}`} className="btn-line btn-sm min-w-[110px]">{a.status === "review" ? "Mở bài" : "Chỉnh sửa"}</Link></td>
          </tr>
        ))}
      </Table>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn-line btn-sm">← Trước</Link>}
        <span className="text-ink-muted">Trang {page}/{pages} · {total} bài</span>
        {page < pages && <Link href={qs({ page: String(page + 1) })} className="btn-line btn-sm">Sau →</Link>}
      </div>
    </>
  );
}
