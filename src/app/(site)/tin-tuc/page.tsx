// Tin tức HULAKO (ảnh 091): hoạt động công ty, hướng dẫn mới, thông báo — tách khỏi trung tâm kiến thức.
// Nhóm tin dùng cụm chủ đề có slug "tin-*" (quản trị ở A09 › Chủ đề).
import type { Metadata } from "next";
import { listPublishedArticles, listTopics } from "@/lib/queries";
import { ArticleCard, EmptyState, FilterChips, Pagination } from "@/components/ui";

export const revalidate = 300;
type SP = Promise<Record<string, string | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: "Tin tức HULAKO", description: "Hoạt động công ty, sản phẩm mới và thông báo cập nhật tài liệu từ HULAKO — Vua Đèn Lives.",
    alternates: { canonical: "/tin-tuc" }, robots: sp.page || sp.nhom ? { index: false, follow: true } : undefined,
  };
}

export default async function NewsListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const groups = (await listTopics()).filter((t) => t.slug.startsWith("tin-"));
  const nhom = groups.find((g) => g.slug === sp.nhom)?.slug;
  const data = await listPublishedArticles({ kind: "news", page, topicSlug: nhom, pageSize: 9 });
  const anySample = data.items.some((a) => a.isSample);
  return (
    <div className="container-page py-7 lg:py-10">
      <h1 className="h-page">Tin tức HULAKO</h1>
      <p className="mt-2 text-[19px] text-ink-muted">{anySample ? "Nội dung minh họa" : "Hoạt động công ty, sản phẩm mới và thông báo."}</p>
      {groups.length > 0 && (
        <div className="mt-6"><FilterChips hideLabel label="Nhóm tin" param="nhom" base="/tin-tuc" current={nhom} params={{ nhom }} options={groups.map((g) => ({ value: g.slug, label: g.name }))} /></div>
      )}
      {data.items.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((a) => <ArticleCard key={a.id} a={a} />)}</div>
        : <div className="mt-8"><EmptyState title="Chưa có tin mới" icon="file">HULAKO sẽ cập nhật hoạt động và thông báo tại đây.</EmptyState></div>}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} makeHref={(p) => `/tin-tuc?${new URLSearchParams(Object.entries({ nhom, page: String(p) }).filter(([, v]) => v) as [string, string][])}`} />
    </div>
  );
}
