// A07 Hộp thư tư vấn (màn 018: danh sách – nội dung – xử lý) và Quản lý hỏi đáp (màn 037).
import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { DEVICE_TYPES, FAQ_TOPICS } from "@/lib/catalog";
import { formatDateTimeVN } from "@/lib/text";
import { ActionForm, SubmitFor } from "@/components/admin/ActionForm";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { Badge, EmptyState, Field, IconBox, PageTitle, Panel, SearchInput, Table, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { saveFaq, updateLead } from "../../actions/ops";

export const metadata = { title: "Tư vấn & Hỏi đáp" };
type SP = Record<string, string | undefined>;
type Db = Awaited<ReturnType<typeof getDb>>;
const SOURCE_LABEL: Record<string, string> = { contact: "Liên hệ", product: "Trang sản phẩm", article: "Bài viết", selector: "Chọn đèn theo phòng", support: "Hỗ trợ", lead_magnet: "Đăng ký quà tặng" };

export default async function SupportAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  const u = await requirePage(["lead.view", "faq.edit"]);
  const sp = await searchParams;
  const canLeads = can(u.roles, "lead.view");
  const tab = sp.tab === "faq" || !canLeads ? "faq" : "leads";
  const db = await getDb();
  return (
    <>
      <PageTitle title={tab === "faq" ? "Quản lý hỏi đáp" : "Yêu cầu tư vấn"}>
        {tab === "leads" && <a href="/admin/support/export?source=all" className="btn-line"><Icon name="download" /> Tải CSV</a>}
        {tab === "faq" && can(u.roles, "faq.edit") && (sp.faq
          ? <SubmitFor form="faq-form" label="Lưu câu hỏi" icon="save" />
          : <Link href="/admin/support?tab=faq&faq=new" className="btn-primary"><Icon name="plus" /> Thêm câu hỏi</Link>)}
      </PageTitle>
      <Tabs current={tab} tabs={[...(canLeads ? [{ key: "leads", label: "Hộp thư tư vấn", href: "/admin/support", icon: "message" as const }] : []), { key: "faq", label: "Câu hỏi thường gặp", href: "/admin/support?tab=faq", icon: "headset" as const }]} />
      {tab === "leads" ? <Leads sp={sp} userId={u.id} isAdmin={u.roles.includes("admin")} db={db} /> : can(u.roles, "faq.edit") ? <Faqs db={db} sp={sp} /> : <p>Bạn không có quyền sửa FAQ.</p>}
    </>
  );
}

const GROUPS: Record<string, string[]> = { new: ["new"], doing: ["assigned", "in_progress"], done: ["resolved", "closed"] };

async function Leads({ sp, userId, isAdmin, db }: { sp: SP; userId: string; isAdmin: boolean; db: Db }) {
  const group = sp.status && sp.status in GROUPS ? sp.status : sp.status ? "custom" : "new";
  const where: SQL[] = [];
  if (group !== "custom" && group in GROUPS) where.push(inArray(schema.leads.status, GROUPS[group]));
  if (sp.source) where.push(eq(schema.leads.source, sp.source));
  if (sp.q) where.push(or(ilike(schema.leads.code, `%${sp.q}%`), ilike(schema.leads.topic, `%${sp.q}%`), ilike(schema.leads.message, `%${sp.q}%`))!);
  // Tư vấn viên: chỉ thấy yêu cầu được giao cho mình + yêu cầu mới chưa ai nhận
  if (!isAdmin) where.push(or(eq(schema.leads.assigneeId, userId), and(isNull(schema.leads.assigneeId), eq(schema.leads.status, "new")))!);
  else if (sp.mine === "1") where.push(eq(schema.leads.assigneeId, userId));
  const [list, staff] = await Promise.all([
    db.select({ id: schema.leads.id, code: schema.leads.code, topic: schema.leads.topic, source: schema.leads.source, status: schema.leads.status, createdAt: schema.leads.createdAt })
      .from(schema.leads).where(where.length ? and(...where) : undefined).orderBy(desc(schema.leads.createdAt)).limit(100),
    db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users).where(sql`${schema.users.roles} ?| array['consultant','admin']`),
  ]);
  const selId = sp.id ?? list[0]?.id;
  const [sel] = selId ? await db.select().from(schema.leads).where(eq(schema.leads.id, selId)) : [];
  const visible = sel && (isAdmin || !sel.assigneeId || sel.assigneeId === userId);
  const qs = (o: SP) => `?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][])}`;
  const ctx = (sel?.context ?? {}) as Record<string, unknown>;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-card border border-line bg-white p-1.5">
          {[["new", "Mới"], ["doing", "Đang xử lý"], ["done", "Đã xử lý"]].map(([k, l]) => (
            <Link key={k} href={qs({ status: k, id: undefined })} className={`rounded-xl px-6 py-2.5 font-semibold ${group === k ? "bg-brand-soft text-brand" : "hover:bg-black/5"}`}>{l}</Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="status" value={group === "custom" ? sp.status : group} />
          <select name="source" defaultValue={sp.source ?? ""} className="input !min-h-[42px] !w-auto" aria-label="Nguồn"><option value="">Mọi nguồn</option>{Object.entries(SOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          {isAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /> Của tôi</label>}
          <button className="btn-line btn-sm">Lọc</button>
          <a href="/admin/support/export?source=lead_magnet" className="btn-ghost btn-sm">CSV đăng ký quà tặng</a>
        </form>
      </div>
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="card p-4">
          <form className="mb-3"><input type="hidden" name="status" value={group === "custom" ? sp.status : group} /><SearchInput defaultValue={sp.q} placeholder="Tìm yêu cầu (mã, chủ đề)" /></form>
          <ul className="adm-scroll max-h-[60vh] overflow-auto">
            {list.map((l) => (
              <li key={l.id}>
                <Link href={qs({ id: l.id })} className={`flex items-center gap-3 border-l-[3px] px-3 py-3 ${l.id === selId ? "border-brand bg-brand-tint" : "border-transparent hover:bg-black/[.03]"}`}>
                  <IconBox icon="message" size="sm" />
                  <span className="min-w-0 flex-1"><span className={`block truncate ${l.id === selId ? "font-bold" : "font-medium"}`}>{l.topic}</span><span className="block text-xs text-ink-muted">{l.code} · {formatDateTimeVN(l.createdAt)}</span></span>
                  <Icon name="chevronRight" className="h-4 w-4 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
          {!list.length && <EmptyState icon="message" title="Không có yêu cầu" text="Yêu cầu mới từ website sẽ hiện ở đây." />}
        </aside>
        {sel && visible ? (
          <>
            <section className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-2xl font-bold">{sel.topic}</h2><Badge status={sel.status} /></div>
              <div className="mt-3 flex flex-wrap gap-2 border-b border-[#EFECE8] pb-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#F4F1ED] px-3 py-1.5 text-sm"><Icon name="layers" className="h-4 w-4" /> Nguồn: {SOURCE_LABEL[sel.source] ?? sel.source}</span>
                {Object.entries(ctx).slice(0, 4).map(([k, v]) => <span key={k} className="inline-flex items-center gap-2 rounded-full bg-[#F4F1ED] px-3 py-1.5 text-sm">{k}: {String(v)}</span>)}
              </div>
              <div className="mt-4 rounded-card bg-[#F7F5F2] p-4">
                <p className="mb-2 flex items-center gap-2 font-semibold"><Icon name="message" className="h-5 w-5 text-brand" /> Nội dung yêu cầu</p>
                <p className="whitespace-pre-wrap text-[16px]">{sel.message}</p>
              </div>
              <p className="mt-4 text-sm text-ink-muted">Mã {sel.code} · gửi lúc {formatDateTimeVN(sel.createdAt)} · email báo nội bộ: {sel.notifyStatus}</p>
              <Link href={`/admin/support/leads/${sel.id}`} className="btn-line btn-sm mt-4"><Icon name="user" className="h-4 w-4" /> Mở hồ sơ đầy đủ (liên hệ, lịch sử)</Link>
            </section>
            <aside className="card p-5">
              <ActionForm action={updateLead} key={sel.id} buttons={<button className="btn-primary w-full"><Icon name="save" /> Lưu cập nhật</button>}>
                <input type="hidden" name="id" value={sel.id} />
                <p className="mb-2 flex items-center gap-2 text-lg font-semibold"><Icon name="user" /> Người phụ trách</p>
                <select name="assigneeId" defaultValue={sel.assigneeId ?? ""} className="input" aria-label="Người phụ trách"><option value="">Chọn người phụ trách</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}</select>
                <p className="mb-2 mt-5 flex items-center gap-2 text-lg font-semibold"><Icon name="tag" /> Trạng thái</p>
                <select name="status" defaultValue={sel.status} className="input" aria-label="Trạng thái">{[["new", "Mới"], ["assigned", "Đã phân công"], ["in_progress", "Đang xử lý"], ["resolved", "Đã xử lý"], ["closed", "Đóng"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <p className="mb-2 mt-5 flex items-center gap-2 text-lg font-semibold"><Icon name="file" /> Ghi chú nội bộ</p>
                <textarea name="note" rows={5} className="input" placeholder="Thêm ghi chú nội bộ…" aria-label="Ghi chú nội bộ" />
              </ActionForm>
            </aside>
          </>
        ) : <div className="card flex items-center justify-center p-10 text-ink-muted xl:col-span-2">Chọn một yêu cầu bên trái.</div>}
      </div>
    </>
  );
}

async function Faqs({ db, sp }: { db: Db; sp: SP }) {
  const [faqs, products, arts] = await Promise.all([
    db.select().from(schema.faqs).orderBy(asc(schema.faqs.sortOrder)),
    db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products),
    db.select({ slug: schema.articles.slug, title: schema.revisions.title }).from(schema.articles).innerJoin(schema.revisions, eq(schema.revisions.id, schema.articles.publishedRevisionId)).where(eq(schema.articles.kind, "guide")),
  ]);
  const f = sp.faq === "new" ? undefined : faqs.find((x) => x.id === sp.faq);
  const editing = sp.faq === "new" || !!f;
  const topic = (v: string) => FAQ_TOPICS.find((t) => t.value === v)?.label ?? v;
  return (
    <>
      <Tabs variant="pill" current={editing ? "edit" : "list"} tabs={[{ key: "list", label: "Danh sách câu hỏi", href: "/admin/support?tab=faq" }, { key: "edit", label: f ? "Chỉnh sửa FAQ" : "Thêm FAQ", href: "/admin/support?tab=faq&faq=new" }]} />
      {!editing ? (
        <Table head={["Câu hỏi", "Nhóm", "Thiết bị", "Hiển thị", ""]} empty={!faqs.length} emptyText="Chưa có câu hỏi.">
          {faqs.map((x) => (
            <tr key={x.id}><td className="font-semibold">{x.question}</td><td>{topic(x.topic)}</td><td>{DEVICE_TYPES.find((d) => d.value === x.deviceType)?.label ?? "—"}</td>
              <td><Badge status={x.status === "public" ? "public" : "hidden"} /></td><td><Link href={`/admin/support?tab=faq&faq=${x.id}`} className="btn-line btn-sm">Chỉnh sửa</Link></td></tr>
          ))}
        </Table>
      ) : (
        <ActionForm action={saveFaq} id="faq-form" toast buttons={null} key={f?.id ?? "new"}>
          <input type="hidden" name="id" value={f?.id ?? ""} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <Panel className="!mb-0">
              <div className="space-y-5">
                <Field label="Câu hỏi" name="question" defaultValue={f?.question} required />
                <MarkdownField label="Câu trả lời (ghi bước thực hiện)" name="answer" defaultValue={f?.answer} rows={8} required />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nhóm câu hỏi" name="topic" defaultValue={f?.topic} options={FAQ_TOPICS} required />
                  <Field label="Sản phẩm liên quan" name="productId" defaultValue={f?.productId} options={[{ value: "", label: "Chọn sản phẩm" }, ...products.map((p) => ({ value: p.id, label: p.name }))]} />
                  <Field label="Loại thiết bị" name="deviceType" defaultValue={f?.deviceType} options={[{ value: "", label: "—" }, ...DEVICE_TYPES]} />
                  <Field label="Thứ tự" name="sortOrder" type="number" defaultValue={f?.sortOrder ?? 0} />
                </div>
              </div>
            </Panel>
            <Panel className="!mb-0 h-fit">
              <div className="space-y-5">
                <Field label="Trạng thái" name="status" defaultValue={f?.status ?? "public"} options={[{ value: "public", label: "Công khai" }, { value: "hidden", label: "Ẩn (bản nháp)" }]} />
                <Field label="Bài hướng dẫn liên quan" name="articleSlug" defaultValue={f?.articleSlug} options={[{ value: "", label: "Chọn bài hướng dẫn" }, ...arts.map((a) => ({ value: a.slug, label: a.title }))]} />
                <button type="submit" className="btn-primary w-full"><Icon name="save" /> Lưu câu hỏi</button>
                <p className="text-xs text-ink-muted">Câu trả lời công khai được kiểm claim theo quy tắc biên tập HULAKO.</p>
              </div>
            </Panel>
          </div>
        </ActionForm>
      )}
    </>
  );
}
