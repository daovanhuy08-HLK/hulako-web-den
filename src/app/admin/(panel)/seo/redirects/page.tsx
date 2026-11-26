// Màn 040 Quản lý chuyển hướng URL (bảng redirects): thêm 301 có kiểm tra đích/vòng lặp/chuỗi, tìm kiếm, xoá.
import { desc, ilike, or } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton } from "@/components/admin/ActionForm";
import { RedirectForm } from "@/components/admin/RedirectForm";
import { SeoNav } from "@/components/admin/SeoNav";
import { PageTitle, Panel, SearchInput, Table } from "@/components/admin/ui";
import { deleteRedirect, saveRedirect } from "../../../actions/seo";
import { checkRedirect } from "../../../actions/extra";

export const metadata = { title: "Chuyển hướng URL" };

export default async function Redirects({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("seo.view");
  const q = (await searchParams).q ?? "";
  const db = await getDb();
  const rows = await db.select().from(schema.redirects).where(q ? or(ilike(schema.redirects.fromPath, `%${q}%`), ilike(schema.redirects.toPath, `%${q}%`)) : undefined)
    .orderBy(desc(schema.redirects.createdAt)).limit(300);
  return (
    <>
      <PageTitle title="Chuyển hướng URL" />
      <SeoNav current="/admin/seo/redirects" />
      <RedirectForm save={saveRedirect} check={checkRedirect} />
      <Panel title={`Danh sách chuyển hướng (${rows.length})`} className="mt-5" actions={<form className="w-full max-w-md"><SearchInput defaultValue={q} placeholder="Tìm đường dẫn" /></form>}>
        <Table head={["Đường dẫn cũ", "Đường dẫn mới", "Loại", "Tạo lúc", ""]} empty={!rows.length} emptyText="Chưa có chuyển hướng. Đổi slug bài/sản phẩm đã công khai sẽ tự tạo 301.">
          {rows.map((r) => (
            <tr key={r.id}><td className="break-all font-mono text-sm">{r.fromPath}</td><td className="break-all font-mono text-sm">{r.toPath}</td><td>301</td>
              <td className="whitespace-nowrap text-sm text-ink-muted">{formatDateTimeVN(r.createdAt)}</td>
              <td><ActionButton action={deleteRedirect} label="Xoá" className="btn-ghost btn-sm text-red-700" fields={{ id: r.id }} confirm="Xoá chuyển hướng này? URL cũ sẽ trả 404." /></td></tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
