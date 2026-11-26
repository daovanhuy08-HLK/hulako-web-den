// Màn 048 Lịch sử phiên bản: danh sách phiên bản trái, so sánh phiên bản đã chọn với bản nháp hiện tại, khôi phục thành nháp.
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { requirePage, requireUuid } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { diffLines } from "@/lib/admin-diff";
import { ActionButton } from "@/components/admin/ActionForm";
import { IconBox, PageTitle, SampleTag } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { transition } from "../../../../actions/content";

export const metadata = { title: "Lịch sử phiên bản" };

export default async function History({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage("content.edit");
  const { id } = await params;
  requireUuid(id);
  const sp = await searchParams;
  const db = await getDb();
  const [a] = await db.select().from(schema.articles).where(eq(schema.articles.id, id));
  if (!a) notFound();
  const revs = await db.select().from(schema.revisions).where(eq(schema.revisions.articleId, a.id)).orderBy(desc(schema.revisions.number)).limit(50);
  const authors = revs.length ? await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users)
    .where(inArray(schema.users.id, [...new Set(revs.map((r) => r.createdBy).filter((x): x is string => !!x))].concat(["00000000-0000-0000-0000-000000000000"]))) : [];
  const who = (uid: string | null, origin: string) => origin === "ai" ? "AI Agent" : authors.find((x) => x.id === uid)?.name || authors.find((x) => x.id === uid)?.email || "Hệ thống";
  const current = revs.find((r) => r.id === a.draftRevisionId) ?? revs[0];
  const selected = revs.find((r) => r.id === sp.rev) ?? revs.find((r) => r.id !== current?.id) ?? current;
  const label = (r: (typeof revs)[number]) =>
    r.id === a.draftRevisionId ? "Bản đang chỉnh sửa" : r.id === a.publishedRevisionId ? "Bản đang công khai" : r.id === a.approvedRevisionId ? "Bản đã duyệt" : r.origin === "restore" ? "Bản khôi phục" : "Bản nháp trước";
  const icon = (r: (typeof revs)[number]) => (r.id === a.draftRevisionId ? "pencil" : r.id === a.publishedRevisionId || r.id === a.approvedRevisionId ? "checkCircle" : "file");
  const diff = selected && current ? diffLines(selected.body, current.body) : [];
  const meta = selected && current ? ([["Tiêu đề", selected.title, current.title], ["Tiêu đề SEO", selected.seoTitle, current.seoTitle], ["Mô tả tìm kiếm", selected.seoDescription, current.seoDescription]] as const).filter(([, x, y]) => x !== y) : [];

  return (
    <>
      <PageTitle title="Lịch sử phiên bản" back={`/admin/content/${a.id}`} />
      <section className="card mb-5 flex items-center gap-4 p-5">
        <IconBox icon="file" size="lg" />
        <div><p className="text-2xl font-bold">{current?.title ?? "(chưa có tiêu đề)"}</p>{a.isSample && <p className="mt-1"><SampleTag tone="muted">Dữ liệu minh họa</SampleTag></p>}</div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="card adm-scroll h-fit max-h-[70vh] space-y-3 overflow-auto p-4">
          {revs.map((r) => (
            <Link key={r.id} href={`?rev=${r.id}`} aria-current={r.id === selected?.id ? "true" : undefined}
              className={`flex items-start gap-3 rounded-card border p-4 ${r.id === selected?.id ? "border-brand bg-brand-tint" : "border-line hover:border-ink/30"}`}>
              <span className={r.id === selected?.id ? "text-brand" : "text-ink-muted"}><Icon name={icon(r)} className="h-6 w-6" /></span>
              <span className="min-w-0">
                <span className="block font-bold">{label(r)} · #{r.number}</span>
                <span className="block text-sm text-ink-muted">{who(r.createdBy, r.origin)} · {formatDateTimeVN(r.createdAt)}</span>
              </span>
            </Link>
          ))}
          {!revs.length && <p className="p-4 text-ink-muted">Chưa có phiên bản.</p>}
        </aside>
        <section className="card p-5 sm:p-6">
          <h2 className="text-2xl font-bold">So sánh nội dung</h2>
          {selected && current && selected.id === current.id ? <p className="mt-3 text-ink-muted">Bài mới có một phiên bản — chọn phiên bản khác bên trái để so sánh.</p> : null}
          {meta.length > 0 && (
            <div className="mt-4 overflow-x-auto"><table className="adm-table"><thead><tr><th>Trường</th><th>Phiên bản #{selected?.number}</th><th>Bản hiện tại</th></tr></thead>
              <tbody>{meta.map(([k, x, y]) => <tr key={k}><td className="font-semibold">{k}</td><td className="adm-diff-del">{x || "(trống)"}</td><td className="adm-diff-add">{y || "(trống)"}</td></tr>)}</tbody></table></div>
          )}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-card border border-line">
              <p className="bg-[#F4F1ED] px-4 py-3 font-semibold">Phiên bản đã chọn {selected && `#${selected.number}`}</p>
              <div className="adm-scroll max-h-[55vh] overflow-auto whitespace-pre-wrap p-4 text-[15px] leading-7">
                {diff.filter((d) => d.type !== "add").map((d, i) => <div key={i} className={d.type === "del" ? "adm-diff-del rounded px-1" : ""}>{d.text || " "}</div>)}
              </div>
            </div>
            <div className="overflow-hidden rounded-card border border-line">
              <p className="bg-[#F4F1ED] px-4 py-3 font-semibold">Bản hiện tại {current && `#${current.number}`}</p>
              <div className="adm-scroll max-h-[55vh] overflow-auto whitespace-pre-wrap p-4 text-[15px] leading-7">
                {diff.filter((d) => d.type !== "del").map((d, i) => <div key={i} className={d.type === "add" ? "adm-diff-add rounded px-1" : ""}>{d.text || " "}</div>)}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="flex items-center gap-2 text-sm text-ink-muted"><Icon name="info" className="h-4 w-4" /> Bản khôi phục cần được kiểm tra và duyệt lại.</p>
            <div className="flex flex-wrap gap-3">
              {selected && can(u.roles, "content.review") && selected.id !== a.draftRevisionId && (
                <ActionButton action={transition} label="Khôi phục thành bản nháp" icon="refresh" className="btn-primary" confirm={`Tạo bản nháp mới từ phiên bản #${selected.number}?`}
                  fields={{ id: a.id, action: "restore", revisionId: selected.id }} />
              )}
              {selected && <Link href={`/admin/preview/${selected.id}`} className="btn-line"><Icon name="eye" /> Xem trước</Link>}
              <Link href={`/admin/content/${a.id}`} className="btn-line"><Icon name="arrowLeft" /> Về bài viết</Link>
            </div>
          </div>
          {!can(u.roles, "content.review") && <p className="mt-2 text-xs text-ink-muted">Khôi phục phiên bản cần vai trò Người duyệt nội dung.</p>}
        </section>
      </div>
    </>
  );
}
