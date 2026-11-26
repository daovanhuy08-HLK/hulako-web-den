// Màn 049 Xem trước bài viết: cần đăng nhập, noindex, không cache công khai (mục 06). Chuyển máy tính / điện thoại.
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePage, requireUuid } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateTimeVN } from "@/lib/text";
import { Badge, IconBox } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Xem trước", robots: { index: false, follow: false } };

export default async function Preview({ params, searchParams }: { params: Promise<{ revisionId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("content.edit");
  const { revisionId } = await params;
  requireUuid(revisionId);
  const device = (await searchParams).device === "mobile" ? "mobile" : "desktop";
  const db = await getDb();
  const [r] = await db.select().from(schema.revisions).where(eq(schema.revisions.id, revisionId));
  if (!r) notFound();
  const [a] = await db.select().from(schema.articles).where(eq(schema.articles.id, r.articleId));
  const { html } = renderMarkdown(r.body);
  const which = a?.draftRevisionId === r.id ? "Bản nháp hiện tại" : a?.publishedRevisionId === r.id ? "Bản đang công khai" : a?.approvedRevisionId === r.id ? "Bản đã duyệt" : `Phiên bản cũ #${r.number}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[34px] font-extrabold tracking-tight">Xem trước bài viết</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-line bg-white p-1">
            <Link href="?device=desktop" className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold ${device === "desktop" ? "bg-brand text-white" : ""}`}><Icon name="monitor" /> Máy tính</Link>
            <Link href="?device=mobile" className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold ${device === "mobile" ? "bg-brand text-white" : ""}`}><Icon name="phone" /> Điện thoại</Link>
          </div>
          {a && <Badge status={a.status} />}
          {a && <Link href={`/admin/content/${a.id}`} className="btn-outline"><Icon name="arrowLeft" /> Quay lại chỉnh sửa</Link>}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card bg-[#F4F1ED]/60 p-4 sm:p-8">
          <article className={`mx-auto rounded-card border border-line bg-white p-5 sm:p-8 ${device === "mobile" ? "max-w-[400px]" : "max-w-3xl"}`}>
            <p className="mb-4 rounded-lg bg-brand-soft p-2 text-center text-sm font-semibold text-brand-dark">BẢN XEM TRƯỚC — chưa chắc đã công khai</p>
            <h1 className={`${device === "mobile" ? "text-[28px]" : "text-4xl"} font-extrabold leading-tight`}>{r.title}</h1>
            {r.summary && <p className="mt-3 text-lg text-ink-soft">{r.summary}</p>}
            {r.coverUrl && <div className="relative mt-5 aspect-[16/10] overflow-hidden rounded-card bg-[#F1F0EE]"><Image src={r.coverUrl} alt={r.coverAlt} fill sizes="800px" className="object-cover" unoptimized /></div>}
            <div className="prose-hlk mt-6" dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        </div>
        <aside className="space-y-4">
          <div className="card flex items-center gap-4 p-4"><IconBox icon="file" /><div><p className="font-bold">Phiên bản đang xem</p><p className="text-ink-soft">{which}</p></div></div>
          <div className="card flex items-center gap-4 p-4"><IconBox icon={device === "mobile" ? "phone" : "monitor"} /><div><p className="font-bold">Thiết bị</p><p className="text-ink-soft">{device === "mobile" ? "Điện thoại" : "Máy tính"}</p></div></div>
          <div className="card space-y-1 p-4 text-sm"><p className="font-bold">SEO</p><p>Tiêu đề: {r.seoTitle || <i className="text-ink-muted">trống</i>}</p><p>Mô tả: {r.seoDescription || <i className="text-ink-muted">trống</i>}</p><p className="text-ink-muted">Tạo lúc {formatDateTimeVN(r.createdAt)}</p></div>
          <p className="flex items-center gap-2 rounded-xl bg-[#F4F1ED] p-3 text-sm text-ink-soft"><Icon name="info" className="h-5 w-5" /> Chỉ người có quyền được xem. Trang này không được lập chỉ mục.</p>
        </aside>
      </div>
    </>
  );
}
