// A05 Danh sách mẫu góc livestream + lối vào quy tắc chọn đèn.
import Image from "next/image";
import Link from "next/link";
import { asc, eq, ilike, and, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { INDUSTRIES, SPACES, STYLES } from "@/lib/catalog";
import { Badge, PageTitle, SampleTag, SearchInput, Table, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";

export const metadata = { title: "Góc livestream" };
const lbl = (arr: { value: string; label: string }[], v: string) => arr.find((x) => x.value === v)?.label ?? (v || "—");

export default async function SetupsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("setup.edit");
  const sp = await searchParams;
  const db = await getDb();
  const where: SQL[] = [];
  if (sp.q) where.push(ilike(schema.setups.title, `%${sp.q}%`));
  if (sp.status) where.push(eq(schema.setups.status, sp.status));
  const rows = await db.select().from(schema.setups).where(where.length ? and(...where) : undefined).orderBy(asc(schema.setups.title));
  const qs = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <PageTitle title="Quản lý góc livestream">
        <Link href="/admin/setups/rules" className="btn-line"><Icon name="sliders" /> Quy tắc chọn đèn</Link>
        <Link href="/admin/setups/new" className="btn-primary"><Icon name="plus" /> Thêm mẫu</Link>
      </PageTitle>
      <form className="mb-5 max-w-xl">{sp.status && <input type="hidden" name="status" value={sp.status} />}<SearchInput defaultValue={sp.q} placeholder="Tìm mẫu góc live" /></form>
      <Tabs current={sp.status ?? "all"} tabs={[{ key: "all", label: "Tất cả", href: qs({ status: undefined }) }, { key: "draft", label: "Bản nháp", href: qs({ status: "draft" }) }, { key: "public", label: "Công khai", href: qs({ status: "public" }) }, { key: "archived", label: "Lưu trữ", href: qs({ status: "archived" }) }]} />
      <Table head={["Mẫu", "Không gian", "Ngành hàng", "Kiểu quay", "Thiết bị", "Trạng thái", ""]} empty={!rows.length} emptyText="Chưa có mẫu góc live.">
        {rows.map((s) => (
          <tr key={s.id}>
            <td><Link href={`/admin/setups/${s.id}`} className="flex items-center gap-3 hover:text-brand-dark">
              <span className="relative h-14 w-20 flex-none overflow-hidden rounded-lg bg-[#F1F0EE]">{s.coverUrl ? <Image src={s.coverUrl} alt={s.coverAlt} fill sizes="80px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center text-ink-muted/60"><Icon name="play" /></span>}</span>
              <span><b>{s.title}</b>{s.isSample && <span className="ml-2"><SampleTag>Mẫu minh họa</SampleTag></span>}</span></Link></td>
            <td>{lbl(SPACES, s.space)}</td><td>{lbl(INDUSTRIES, s.industry)}</td><td>{lbl(STYLES, s.style)}</td>
            <td>{s.variantIds.length}</td><td><Badge status={s.status} /></td>
            <td><Link href={`/admin/setups/${s.id}`} className="btn-line btn-sm">Chỉnh sửa</Link></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
