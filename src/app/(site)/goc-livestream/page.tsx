// P05 Danh sách góc livestream (ảnh 004, 077) — lọc theo không gian, ngành hàng, kiểu quay; lọc lưu trong URL (noindex).
import type { Metadata } from "next";
import Link from "next/link";
import { listSetups } from "@/lib/queries";
import { INDUSTRIES, SPACES, STYLES, pick } from "@/lib/catalog";
import { EmptyState, Pagination, SetupCard } from "@/components/ui";
import { SelectFilters } from "@/components/SelectFilters";

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: "Góc livestream tại nhà: phòng nhỏ, góc bàn, live quần áo, mỹ phẩm",
    description: "Các mẫu bố trí góc live kèm sơ đồ đặt đèn, góc máy và thiết bị đã dùng. Chọn mẫu hợp phòng và món hàng của bạn.",
    alternates: { canonical: "/goc-livestream" },
    robots: Object.keys(sp).length ? { index: false, follow: true } : undefined,
  };
}

export default async function SetupsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const space = pick(sp.space, SPACES), industry = pick(sp.industry, INDUSTRIES), style = pick(sp.style, STYLES);
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await listSetups({ space, industry, style, page, pageSize: 9 });
  const params = { space, industry, style };
  const hasFilter = !!(space || industry || style);
  return (
    <div className="container-page py-7 lg:py-10">
      <h1 className="h-page">Góc livestream</h1>
      <span className="accent-bar mt-3 lg:hidden" />
      <div className="mt-6 lg:mt-8">
        <SelectFilters base="/goc-livestream" filters={[
          { name: "space", label: "Không gian", icon: "home", value: space, options: SPACES },
          { name: "industry", label: "Ngành hàng", icon: "tag", value: industry, options: INDUSTRIES },
          { name: "style", label: "Kiểu quay", icon: "video", value: style, options: STYLES },
        ]} />
      </div>
      <p className="sr-only" aria-live="polite">{data.total} góc livestream</p>
      {data.items.length ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">{data.items.map((s) => <SetupCard key={s.id} s={s} />)}</div>
      ) : (
        <div className="mt-8">
          <EmptyState title="Chưa có góc live khớp lựa chọn này" icon="home">
            <p>Thử bỏ bớt điều kiện lọc hoặc gửi ảnh phòng để HULAKO gợi ý bố trí.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {hasFilter && <Link href="/goc-livestream" className="btn-line">Xoá bộ lọc</Link>}
              <Link href="/lien-he?chu-de=tu-van-chon-den" className="btn-primary">Tư vấn góc live</Link>
            </div>
          </EmptyState>
        </div>
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total}
        makeHref={(p) => `/goc-livestream?${new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][])}`} />
    </div>
  );
}
