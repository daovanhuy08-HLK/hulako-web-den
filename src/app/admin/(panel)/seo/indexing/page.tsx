// Index bài viết — theo dõi từng bài đã được Google index chưa, lần gửi IndexNow/sitemap gần nhất,
// gửi lại / kiểm tra từng bài, và link mở "Kiểm tra URL" của Search Console để bấm "Yêu cầu lập chỉ mục" (Google chỉ cho làm tay).
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { gscConfigured } from "@/lib/seo/gsc";
import { gscInspectLink, indexNowKey, MAX_SUBMITS, RESUBMIT_DAYS } from "@/lib/indexing";
import { SITE_URL } from "@/lib/settings";
import { formatDateTimeVN, formatDateVN } from "@/lib/text";
import { ActionButton } from "@/components/admin/ActionForm";
import { Notice, PageTitle, StatCard, Table } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { inspectIndex, resubmitIndex, runIndexNow } from "../../../actions/indexing";

export const metadata = { title: "Index bài viết" };
export const dynamic = "force-dynamic";

type Row = typeof schema.indexStatus.$inferSelect;

function googleState(r: Row): { label: string; cls: string } {
  if (r.indexedAt) return { label: "Đã index", cls: "bg-[#E7F6EC] text-[#1E7B3C]" };
  if (!r.inspectedAt) return { label: "Chưa kiểm tra", cls: "bg-[#EFEDEA] text-ink-soft" };
  if (r.verdict === "FAIL") return { label: "Lỗi", cls: "bg-[#FDECEC] text-[#B42318]" };
  return { label: "Chưa index", cls: "bg-[#FFF4D6] text-[#8A5A00]" };
}

export default async function IndexingPage({ searchParams }: { searchParams: Promise<{ xem?: string }> }) {
  const u = await requireUser("seo.view");
  const { xem } = await searchParams;
  const db = await getDb();
  const [rows, key] = await Promise.all([
    db.select({ s: schema.indexStatus, title: schema.revisions.title, publishedAt: schema.articles.publishedAt })
      .from(schema.indexStatus)
      .leftJoin(schema.articles, eq(schema.articles.id, schema.indexStatus.articleId))
      .leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId))
      .where(eq(schema.indexStatus.removed, false))
      .orderBy(desc(schema.articles.publishedAt)),
    indexNowKey().catch(() => ""),
  ]);
  const gsc = gscConfigured();
  const run = can(u.roles, "seo.run_ai");
  const indexed = rows.filter((r) => r.s.indexedAt).length;
  const unchecked = rows.filter((r) => !r.s.indexedAt && !r.s.inspectedAt).length;
  const pending = rows.length - indexed - unchecked;
  const shown = xem === "chua" ? rows.filter((r) => !r.s.indexedAt) : rows;

  return (
    <div>
      <PageTitle title="Index bài viết" back="/admin/seo" subtitle="Bài đăng xong được báo ngay cho công cụ tìm kiếm; bài chưa được index sẽ được gửi lại và kiểm tra hằng ngày.">
        {run && <ActionButton action={runIndexNow} label="Gửi & kiểm tra ngay" className="btn-primary" icon="refresh" />}
      </PageTitle>

      <Notice tone="info" title="Cách hệ thống hỗ trợ index (chỉ dùng kênh chính thức)">
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li><b>Khi đăng / cập nhật bài:</b> báo <b>IndexNow</b> (Bing, Cốc Cốc, Yandex… nhận ngay) và <b>gửi lại sitemap</b> cho Google qua Search Console.</li>
          <li><b>Hằng ngày:</b> bài chưa index được gửi lại (cách {RESUBMIT_DAYS} ngày, tối đa {MAX_SUBMITS} lần) và kiểm tra trạng thái bằng công cụ Kiểm tra URL của Google.</li>
          <li><b>Muốn Google vào nhanh hơn:</b> bấm <b>“Yêu cầu Google”</b> ở từng bài → Search Console mở đúng URL → bấm <b>Yêu cầu lập chỉ mục</b>. Google chỉ cho bấm tay nút này (khoảng 10 bài/ngày).</li>
          <li>Không dùng “Google Indexing API” cho bài viết: Google chỉ cho phép API đó với tin tuyển dụng/sự kiện trực tiếp. Không có cách nào cam kết index ngay hay lên top.</li>
        </ul>
      </Notice>

      {!gsc && (
        <Notice tone="warn" title="Chưa kết nối Search Console" action={<Link href="/admin/seo/sources" className="btn-line btn-sm">Nguồn dữ liệu</Link>}>
          Vẫn báo IndexNow được, nhưng chưa gửi sitemap tự động và chưa biết bài nào đã được Google index. Đặt 3 biến <code>GSC_SITE_URL</code>, <code>GSC_CLIENT_EMAIL</code>, <code>GSC_PRIVATE_KEY</code> trên Vercel rồi Redeploy.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="file" label="Bài đang công khai" value={rows.length} />
        <StatCard icon="checkCircle" label="Google đã index" value={gsc ? indexed : "—"} hint={gsc ? undefined : "Cần kết nối Search Console"} />
        <StatCard icon="clock" label="Chưa index" value={gsc ? pending : "—"} href="/admin/seo/indexing?xem=chua" />
        <StatCard icon="globe" label="Khoá IndexNow" value={key ? "Đang bật" : "Chưa có"} hint={key ? <a href={`${SITE_URL}/indexnow.txt`} target="_blank" rel="noreferrer" className="underline">Xem tệp khoá</a> : undefined} />
      </div>

      <div className="mb-3 mt-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Từng bài viết</h2>
        <Link href="/admin/seo/indexing" className={`chip ${xem !== "chua" ? "chip-active" : ""}`}>Tất cả</Link>
        <Link href="/admin/seo/indexing?xem=chua" className={`chip ${xem === "chua" ? "chip-active" : ""}`}>Chưa index</Link>
      </div>
      <Table head={["Bài viết", "Gửi gần nhất", "Google", "Thao tác"]} empty={!shown.length} emptyText={rows.length ? "Tất cả bài đã được index." : "Chưa có bài nào đăng công khai. Bài sẽ hiện ở đây ngay khi xuất bản."}>
        {shown.map(({ s, title, publishedAt }) => {
          const g = googleState(s);
          return (
            <tr key={s.path}>
              <td className="max-w-[360px]">
                <p className="font-semibold">{title ?? s.path}</p>
                <a href={`${SITE_URL}${s.path}`} target="_blank" rel="noreferrer" className="text-xs text-ink-muted hover:underline">{s.path}</a>
                {publishedAt && <p className="text-xs text-ink-muted">Đăng {formatDateVN(publishedAt)}</p>}
              </td>
              <td className="text-sm">
                {s.lastSubmittedAt ? <>{formatDateTimeVN(s.lastSubmittedAt)}<span className="text-ink-muted"> · lần {s.submitCount}</span></> : <span className="text-ink-muted">Chưa gửi</span>}
                {s.submitNote && <p className="mt-1 max-w-[280px] text-xs text-ink-muted">{s.submitNote}</p>}
              </td>
              <td className="text-sm">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${g.cls}`}>{g.label}</span>
                {s.coverage && <p className="mt-1 max-w-[240px] text-xs text-ink-muted">{s.coverage}</p>}
                {s.lastCrawlAt && <p className="text-xs text-ink-muted">Google ghé {formatDateVN(s.lastCrawlAt)}</p>}
                {s.inspectedAt && <p className="text-xs text-ink-muted">Kiểm tra {formatDateTimeVN(s.inspectedAt)}</p>}
              </td>
              <td>
                <div className="flex flex-wrap gap-2">
                  {run && <ActionButton action={resubmitIndex} fields={{ path: s.path }} label="Gửi lại" className="btn-line btn-sm" icon="send" />}
                  {run && gsc && <ActionButton action={inspectIndex} fields={{ path: s.path }} label="Kiểm tra" className="btn-line btn-sm" icon="search" />}
                  {!s.indexedAt && (
                    <a href={gscInspectLink(s.path)} target="_blank" rel="noreferrer" className="btn-line btn-sm inline-flex items-center gap-1.5">
                      <Icon name="external" className="h-4 w-4" />Yêu cầu Google
                    </a>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
