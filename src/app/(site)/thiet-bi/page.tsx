// P03 Danh mục thiết bị (ảnh 002 điện thoại, 075 máy tính). Bộ lọc lưu trong URL (chia sẻ, quay lại được);
// URL lọc/tìm dùng noindex (mục 11). Tổ hợp rỗng có hướng dẫn xoá lọc hoặc nhờ tư vấn.
import type { Metadata } from "next";
import Link from "next/link";
import { listCategories, listProducts } from "@/lib/queries";
import { USE_CASES, pick } from "@/lib/catalog";
import { Breadcrumbs, EmptyState, Pagination, ProductCard, SearchBox } from "@/components/ui";
import { Icon } from "@/components/site/Icon";

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Object.keys(sp).length > 0;
  return {
    title: "Thiết bị livestream: softbox, đèn bảng, đèn vòng, chân đỡ",
    description: "Danh mục combo softbox, đèn bảng, đèn vòng, chân đỡ và phụ kiện HULAKO. Chọn theo nhu cầu, xem thành phần bộ và mua trên Shopee hoặc TikTok Shop.",
    alternates: { canonical: "/thiet-bi" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

function qs(params: Record<string, string | undefined>) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `/thiet-bi?${q}` : "/thiet-bi";
}

/** Dòng lọc dạng ô tick (ảnh 075) — thực chất là link để giữ bộ lọc trong URL, không cần JS */
function CheckLink({ href, on, label }: { href: string; on: boolean; label: string }) {
  return (
    <li>
      <Link href={href} aria-current={on ? "true" : undefined} className="group flex min-h-[40px] items-center gap-3 text-[17px] text-ink-soft hover:text-ink">
        <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-brand bg-brand text-white" : "border-[#CFCAC4] bg-white group-hover:border-brand"}`}>
          {on && <Icon name="check" size={16} stroke={3} />}
        </span>
        {label}
      </Link>
    </li>
  );
}

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const categories = await listCategories();
  const category = pick(sp.danh_muc, categories.map((c) => ({ value: c.slug })));
  const useCase = pick(sp.nhu_cau, USE_CASES);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await listProducts({ category, useCase, page, q, pageSize: 12 });
  const params = { danh_muc: category, nhu_cau: useCase, q };
  const hasFilter = !!(category || useCase || q);

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs items={[{ label: "Thiết bị" }]} className="hidden lg:block" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="h-page">Thiết bị livestream</h1>
        <div className="lg:w-[475px]"><SearchBox action="/thiet-bi" placeholder="Tìm thiết bị..." defaultValue={q} extra={{ danh_muc: category, nhu_cau: useCase }} /></div>
      </div>

      {/* Điện thoại: pill danh mục (ảnh 002) */}
      <ul className="-mx-1 mt-5 flex gap-2.5 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Danh mục">
        <li><Link href={qs({ ...params, danh_muc: undefined })} className={`chip ${!category ? "chip-active" : ""}`}>Tất cả</Link></li>
        {categories.map((c) => <li key={c.id}><Link href={qs({ ...params, danh_muc: c.slug })} className={`chip whitespace-nowrap ${category === c.slug ? "chip-active" : ""}`}>{c.name}</Link></li>)}
      </ul>

      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[328px_1fr]">
        {/* Máy tính: hộp lọc bên trái (ảnh 075) */}
        <aside className="hidden lg:block">
          <div className="card sticky top-36 p-6">
            <details open className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[20px] font-bold">Danh mục<Icon name="chevronDown" size={22} className="rotate-180 group-open:rotate-0" /></summary>
              <ul className="mt-4 space-y-1">
                {categories.map((c) => <CheckLink key={c.id} on={category === c.slug} label={c.name} href={qs({ ...params, danh_muc: category === c.slug ? undefined : c.slug })} />)}
              </ul>
            </details>
            <hr className="my-5 border-line" />
            <details open className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[20px] font-bold">Nhu cầu sử dụng<Icon name="chevronDown" size={22} className="rotate-180 group-open:rotate-0" /></summary>
              <ul className="mt-4 space-y-1">
                {USE_CASES.map((u) => <CheckLink key={u.value} on={useCase === u.value} label={u.label} href={qs({ ...params, nhu_cau: useCase === u.value ? undefined : u.value })} />)}
              </ul>
            </details>
            {hasFilter && <Link href="/thiet-bi" className="btn-line btn-sm mt-6 w-full">Xoá bộ lọc</Link>}
          </div>
        </aside>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3 text-[15px] text-ink-muted" aria-live="polite">
            <span>{data.total} thiết bị{q ? ` cho “${q}”` : ""}</span>
            {hasFilter && <Link href="/thiet-bi" className="font-semibold text-brand-dark underline lg:hidden">Xoá bộ lọc</Link>}
          </div>
          {data.items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">{data.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          ) : (
            <EmptyState title="Chưa có thiết bị phù hợp bộ lọc này">
              <p>Thử bỏ bớt điều kiện lọc hoặc để HULAKO gợi ý bộ đèn cho phòng của bạn.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/thiet-bi" className="btn-line">Xoá bộ lọc</Link>
                <Link href="/lien-he?chu-de=tu-van-chon-den" className="btn-primary">Nhờ tư vấn</Link>
              </div>
            </EmptyState>
          )}
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} makeHref={(p) => qs({ ...params, page: String(p) })} />
        </div>
      </div>
    </div>
  );
}
