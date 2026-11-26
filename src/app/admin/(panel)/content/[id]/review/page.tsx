// Màn 029 Duyệt bản nháp (AI hoặc người viết): xem nội dung đã render + danh sách kiểm tra + nhận xét.
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePage, requireUuid } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { checkClaims } from "@/lib/guardrails";
import { ReviewBox } from "@/components/admin/ReviewBox";
import { Badge, Notice, PageTitle } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { transition } from "../../../../actions/content";

export const metadata = { title: "Duyệt bản nháp" };

export default async function ReviewArticle({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage("content.edit");
  const { id } = await params;
  requireUuid(id);
  const db = await getDb();
  const [a] = await db.select().from(schema.articles).where(eq(schema.articles.id, id));
  if (!a) notFound();
  const [r] = a.draftRevisionId ? await db.select().from(schema.revisions).where(eq(schema.revisions.id, a.draftRevisionId)) : [];
  if (!r) notFound();
  const [opp] = await db.select({ id: schema.opportunities.id }).from(schema.opportunities).where(eq(schema.opportunities.draftArticleId, a.id));
  const { html } = renderMarkdown(r.body);
  const issues = checkClaims({ "Tiêu đề": r.title, "Mô tả": r.summary, "Nội dung": r.body, "SEO title": r.seoTitle, "Meta": r.seoDescription });

  return (
    <>
      <PageTitle title={a.aiGenerated ? "Duyệt bản nháp AI" : "Duyệt bản nháp"} back={`/admin/content/${a.id}`}>
        {opp && <Link href={`/admin/content/${a.id}#brief`} className="flex items-center gap-2 font-semibold text-brand-dark underline"><Icon name="external" /> Xem brief</Link>}
        <Link href={`/admin/content/${a.id}`} className="btn-line"><Icon name="pencil" /> Mở trình soạn</Link>
      </PageTitle>
      {a.status !== "review" && <Notice tone="info" icon="info">Bài đang ở trạng thái <b><Badge status={a.status} /></b> — chỉ bài “Chờ duyệt” mới duyệt được.</Notice>}
      {issues.length > 0 && <Notice tone="error" title="Nội dung chứa claim bị chặn — không thể duyệt"><ul className="list-disc pl-5">{issues.map((i, n) => <li key={n}>{i.field}: “{i.match}” — {i.hint}</li>)}</ul></Notice>}
      {r.factChecks.length > 0 && <Notice tone="warn" title="Dữ kiện AI đánh dấu cần kiểm chứng"><ul className="list-disc pl-5">{r.factChecks.map((f, i) => <li key={i}>{f}</li>)}</ul></Notice>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
        <article className="card p-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 font-semibold text-brand-dark"><Icon name="clock" /> {({ review: "Chờ duyệt", approved: "Đã duyệt", scheduled: "Đã lên lịch", published: "Đã xuất bản", archived: "Lưu trữ" } as Record<string, string>)[a.status] ?? "Bản nháp"}</span>
          <hr className="my-5 border-line" />
          <h1 className="text-3xl font-extrabold">{r.title}</h1>
          {r.summary && <p className="mt-2 text-lg text-ink-soft">{r.summary}</p>}
          {r.coverUrl && (
            <div className="relative mt-5 aspect-[16/8] overflow-hidden rounded-card bg-[#F1F0EE]">
              <Image src={r.coverUrl} alt={r.coverAlt} fill sizes="800px" className="object-cover" unoptimized />
              {a.isSample && <span className="absolute bottom-3 right-3 rounded-lg bg-white/90 px-3 py-1 text-sm">Nội dung minh họa</span>}
            </div>
          )}
          <div className="prose-hlk mt-6" dangerouslySetInnerHTML={{ __html: html }} />
          <p className="mt-6 border-t border-line pt-4 text-xs text-ink-muted">SEO title: {r.seoTitle || "(trống)"} · Meta: {r.seoDescription || "(trống)"} · Phiên bản #{r.number}{r.sources.length ? ` · Nguồn: ${r.sources.join(", ")}` : ""}</p>
        </article>
        <aside className="card h-fit p-6">
          <ReviewBox action={transition} articleId={a.id} revisionId={r.id} canApprove={can(u.roles, "content.review") && a.status === "review"} />
        </aside>
      </div>
    </>
  );
}
