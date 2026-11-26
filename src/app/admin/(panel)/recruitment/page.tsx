// A08 Tuyển dụng (màn 019): Tin tuyển dụng / Hồ sơ ứng tuyển; lọc vị trí & trạng thái; chi tiết hồ sơ bên phải (CV qua link tạm theo quyền).
import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN, formatDateVN } from "@/lib/text";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, EmptyState, IconBox, PageTitle, SampleTag, Table, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { updateApplication } from "../../actions/ops";

export const metadata = { title: "Tuyển dụng" };
const APP_ST: [string, string][] = [["new", "Mới"], ["screening", "Sàng lọc"], ["interview", "Phỏng vấn"], ["result", "Kết quả"]];
const DEPT: Record<string, string> = { "noi-dung": "Nội dung", "van-hanh": "Vận hành", "kinh-doanh": "Kinh doanh", "tu-van": "Tư vấn", "ky-thuat": "Kỹ thuật" };

export default async function RecruitmentAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage(["job.edit", "application.view"]);
  const sp = await searchParams;
  const canApps = can(u.roles, "application.view");
  const tab = sp.tab === "applications" && canApps ? "applications" : can(u.roles, "job.edit") ? "jobs" : "applications";
  const db = await getDb();
  const jobs = await db.select().from(schema.jobs).orderBy(desc(schema.jobs.publishedAt));
  const where: SQL[] = [];
  if (sp.job) where.push(eq(schema.applications.jobId, sp.job));
  if (sp.status) where.push(eq(schema.applications.status, sp.status));
  const apps = tab === "applications" && canApps
    ? await db.select({ a: schema.applications, job: schema.jobs.title }).from(schema.applications).innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .where(where.length ? and(...where) : undefined).orderBy(desc(schema.applications.createdAt)).limit(200)
    : [];
  const sel = apps.find((x) => x.a.id === sp.app) ?? null;
  const [selRow] = !sel && sp.app && canApps ? await db.select({ a: schema.applications, job: schema.jobs.title }).from(schema.applications).innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId)).where(eq(schema.applications.id, sp.app)) : [];
  const cur = sel ?? selRow ?? null;
  const qs = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageTitle title={tab === "jobs" ? "Tuyển dụng" : "Quản lý ứng viên"}>
        {can(u.roles, "job.edit") && <Link href="/admin/recruitment/new" className="btn-primary"><Icon name="plus" /> Tạo tin tuyển dụng</Link>}
      </PageTitle>
      <Tabs current={tab} tabs={[
        ...(can(u.roles, "job.edit") ? [{ key: "jobs", label: "Tin tuyển dụng", href: "/admin/recruitment", icon: "file" as const }] : []),
        ...(canApps ? [{ key: "applications", label: "Hồ sơ ứng tuyển", href: "/admin/recruitment?tab=applications", icon: "user" as const }] : []),
      ]} />
      {tab === "jobs" ? (
        <Table head={["Vị trí", "Bộ phận", "Địa điểm", "Hạn nhận hồ sơ", "Trạng thái", ""]} empty={!jobs.length} emptyText="Chưa có tin tuyển dụng.">
          {jobs.map((j) => (
            <tr key={j.id}>
              <td><Link href={`/admin/recruitment/${j.id}`} className="flex items-center gap-3 hover:text-brand-dark"><IconBox icon="briefcase" size="sm" /><span><b>{j.title}</b>{j.isSample && <span className="ml-2"><SampleTag>Vị trí mẫu</SampleTag></span>}</span></Link></td>
              <td>{DEPT[j.department] ?? (j.department || "—")}</td><td>{j.location || "—"}</td><td>{j.deadline ? formatDateVN(j.deadline) : "—"}</td>
              <td><Badge status={j.status} /></td>
              <td className="whitespace-nowrap"><Link href={`/admin/recruitment/${j.id}`} className="btn-line btn-sm mr-2">Chỉnh sửa</Link>{canApps && <Link href={`/admin/recruitment?tab=applications&job=${j.id}`} className="btn-ghost btn-sm">Hồ sơ</Link>}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <form className="card mb-5 grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="tab" value="applications" />
              <div><label htmlFor="f-job" className="mb-1.5 block font-semibold">Vị trí</label><select id="f-job" name="job" defaultValue={sp.job ?? ""} className="input"><option value="">Tất cả vị trí</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select></div>
              <div><label htmlFor="f-st" className="mb-1.5 block font-semibold">Trạng thái</label><select id="f-st" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">Tất cả trạng thái</option>{APP_ST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <button className="btn-line self-end">Lọc</button>
            </form>
            <Table head={["Hồ sơ", "Vị trí", "Trạng thái", "Nộp lúc", ""]} empty={!apps.length} emptyText="Chưa có hồ sơ khớp bộ lọc.">
              {apps.map(({ a, job }) => (
                <tr key={a.id} className={a.id === cur?.a.id ? "is-active" : ""}>
                  <td><Link href={qs({ app: a.id })} className="flex items-center gap-3"><IconBox icon="file" size="sm" /><span><b>{a.name}</b><span className="block font-mono text-xs text-ink-muted">{a.code}</span></span></Link></td>
                  <td>{job}</td><td><Badge status={a.status} /></td>
                  <td className="whitespace-nowrap text-sm text-ink-muted">{formatDateTimeVN(a.createdAt)}</td>
                  <td><Link href={qs({ app: a.id })} aria-label="Xem hồ sơ"><Icon name="chevronRight" /></Link></td>
                </tr>
              ))}
            </Table>
          </div>
          <aside className="card h-fit p-6">
            {cur ? (
              <>
                <h2 className="border-b border-[#EFECE8] pb-4 text-2xl font-bold">Chi tiết hồ sơ</h2>
                <dl className="mt-4 space-y-2 text-[15px]">
                  <div className="flex justify-between gap-3"><dt className="text-ink-muted">Ứng viên</dt><dd className="font-semibold">{cur.a.name}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-muted">Vị trí</dt><dd>{cur.job}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-muted">Liên hệ</dt><dd className="text-right">{cur.a.phone ?? "—"}<br />{cur.a.email ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-muted">Lưu tới</dt><dd>{formatDateTimeVN(cur.a.retainUntil)}</dd></div>
                </dl>
                {cur.a.note && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F7F5F2] p-3 text-sm">{cur.a.note}</p>}
                <p className="mb-2 mt-5 font-semibold">CV đính kèm</p>
                <div className="flex items-center gap-3 rounded-card border border-line p-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-xs font-bold text-brand">CV</span>
                  <span className="flex-1 text-sm">Tệp CV của {cur.a.code}</span>
                  <a href={`/api/admin/cv/${cur.a.cvFileId}`} className="rounded-xl bg-brand-soft px-4 py-2 font-semibold text-brand-dark hover:bg-brand/20">Xem CV</a>
                </div>
                <p className="mt-1 text-xs text-ink-muted">Link tạm 5 phút, chỉ tài khoản có quyền tuyển dụng.</p>
                <ActionForm action={updateApplication} key={cur.a.id} buttons={<button className="btn-primary w-full">Lưu cập nhật</button>}>
                  <input type="hidden" name="id" value={cur.a.id} />
                  <label htmlFor="app-note" className="mb-1.5 mt-5 block font-semibold">Ghi chú nội bộ</label>
                  <textarea id="app-note" name="note" rows={4} className="input" placeholder="Nhập ghi chú nội bộ…" />
                  <label htmlFor="app-st" className="mb-1.5 mt-4 block font-semibold">Trạng thái</label>
                  <select id="app-st" name="status" defaultValue={cur.a.status} className="input">{APP_ST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </ActionForm>
                {[...cur.a.notes, ...cur.a.history].length > 0 && (
                  <ul className="mt-5 space-y-1.5 border-t border-[#EFECE8] pt-4 text-sm">{[...cur.a.notes, ...cur.a.history].sort((x, y) => y.at.localeCompare(x.at)).map((h, i) => <li key={i} className="rounded-lg bg-[#F7F5F2] px-3 py-2"><span className="text-ink-muted">{formatDateTimeVN(h.at)}</span> · {h.status ? `→ ${APP_ST.find(([v]) => v === h.status)?.[1] ?? h.status}` : ""} {h.note ?? ""}</li>)}</ul>
                )}
                <Link href={`/admin/recruitment/${cur.a.id}?app=1`} className="mt-4 inline-block text-sm font-semibold text-brand-dark underline">Mở trang hồ sơ (xoá hồ sơ & CV)</Link>
              </>
            ) : <EmptyState icon="user" title="Chọn một hồ sơ" text="Bấm vào hồ sơ để xem CV, ghi chú và đổi trạng thái." />}
          </aside>
        </div>
      )}
    </>
  );
}
