// A08 Soạn tin tuyển dụng (màn 038: /admin/recruitment/[jobId]) hoặc xem hồ sơ (/admin/recruitment/[appId]?app=1).
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePage, requireUuidOrNew } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm, SubmitFor } from "@/components/admin/ActionForm";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { Badge, DemoCheckbox, Field, PageTitle, Panel, SampleTag } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { eraseApplication, saveJob, updateApplication } from "../../../actions/ops";

export const metadata = { title: "Tuyển dụng" };
const DEPTS = [{ value: "", label: "— Chọn bộ phận —" }, { value: "noi-dung", label: "Nội dung" }, { value: "van-hanh", label: "Vận hành" }, { value: "kinh-doanh", label: "Kinh doanh" }, { value: "tu-van", label: "Tư vấn" }, { value: "ky-thuat", label: "Kỹ thuật" }];
const TYPES = ["Toàn thời gian", "Bán thời gian", "Thực tập", "Cộng tác viên"];

export default async function RecruitmentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  requireUuidOrNew(id);
  const sp = await searchParams;
  const db = await getDb();

  if (sp.app) {
    // Người chỉ có quyền sửa bài KHÔNG đọc được hồ sơ (T05)
    await requirePage("application.view");
    const [row] = await db.select({ a: schema.applications, job: schema.jobs.title }).from(schema.applications)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId)).where(eq(schema.applications.id, id));
    if (!row) notFound();
    const a = row.a;
    return (
      <>
        <PageTitle title={`Hồ sơ ${a.code}`} back="/admin/recruitment?tab=applications" tag={<Badge status={a.status} />} />
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Ứng viên" icon="user">
            <dl className="space-y-3 text-[15px]">
              <div><dt className="text-ink-muted">Vị trí</dt><dd className="font-semibold">{row.job}</dd></div>
              <div><dt className="text-ink-muted">Họ tên</dt><dd>{a.name}</dd></div>
              <div><dt className="text-ink-muted">Liên hệ</dt><dd>{a.phone ?? "—"} · {a.email ?? "—"}</dd></div>
              <div><dt className="text-ink-muted">Giới thiệu</dt><dd className="whitespace-pre-wrap">{a.note || "—"}</dd></div>
              <div><dt className="text-ink-muted">Lưu tới</dt><dd>{formatDateTimeVN(a.retainUntil)} · thông báo phiên bản {a.consentVersion}</dd></div>
            </dl>
            <a href={`/api/admin/cv/${a.cvFileId}`} className="btn-primary mt-5"><Icon name="download" /> Tải CV (link tạm 5 phút)</a>
          </Panel>
          <div>
            <Panel title="Xử lý" icon="briefcase">
              <ActionForm action={updateApplication} submitLabel="Lưu cập nhật">
                <input type="hidden" name="id" value={a.id} />
                <Field label="Trạng thái" name="status" defaultValue={a.status} options={[["new", "Mới"], ["screening", "Sàng lọc"], ["interview", "Phỏng vấn"], ["result", "Kết quả"]].map(([value, label]) => ({ value, label }))} />
                <div className="mt-4"><Field label="Ghi chú nội bộ" name="note" rows={3} /></div>
              </ActionForm>
              <ul className="mt-4 space-y-1.5 text-sm">{[...a.notes, ...a.history].sort((x, y) => x.at.localeCompare(y.at)).map((h, i) => <li key={i} className="rounded-lg bg-[#F7F5F2] px-3 py-2">{formatDateTimeVN(h.at)} · {h.status ?? ""} {h.note ?? ""}</li>)}</ul>
            </Panel>
            <ActionButton action={eraseApplication} label="Xoá hồ sơ & CV" icon="trash" className="btn-ghost text-red-700" confirm="Xoá vĩnh viễn hồ sơ và tệp CV?" fields={{ id: a.id }} />
          </div>
        </div>
      </>
    );
  }

  await requirePage("job.edit");
  const isNew = id === "new";
  const [j] = isNew ? [] : await db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
  if (!isNew && !j) notFound();
  return (
    <>
      <PageTitle title="Soạn tin tuyển dụng" back="/admin/recruitment" tag={j?.isSample ? <SampleTag>Vị trí mẫu</SampleTag> : undefined}>
        {j && j.status !== "draft" && <Link href={`/tuyen-dung/${j.slug}`} target="_blank" className="btn-line"><Icon name="eye" /> Xem trước</Link>}
        <SubmitFor form="job-form" label="Lưu tin" className="btn-line" icon="save" />
        {(!j || j.status === "draft") && <SubmitFor form="job-form" name="status" value="open" label="Đăng tin" icon="send" confirm="Đăng tin này lên trang Tuyển dụng?" />}
      </PageTitle>
      <ActionForm action={saveJob} id="job-form" toast buttons={null}>
        <input type="hidden" name="id" value={j?.id ?? ""} /><input type="hidden" name="version" value={j?.version ?? 0} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel className="!mb-0">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Tên vị trí" name="title" defaultValue={j?.title} required />
                <div><label htmlFor="fld-location" className="mb-1.5 block text-[15px] font-semibold">Địa điểm <span className="text-brand">*</span></label>
                  <input id="fld-location" name="location" list="loc-list" defaultValue={j?.location} className="input" /><datalist id="loc-list"><option value="Hà Nội" /><option value="TP. Hồ Chí Minh" /><option value="Làm từ xa" /></datalist></div>
                <Field label="Hình thức" name="employmentType" defaultValue={j?.employmentType ?? TYPES[0]} options={TYPES.map((t) => ({ value: t, label: t }))} required />
              </div>
              <MarkdownField label="Mô tả công việc" name="description" defaultValue={j?.description} rows={7} required placeholder="Nhập mô tả công việc…" />
              <MarkdownField label="Yêu cầu" name="requirements" defaultValue={j?.requirements} rows={6} required placeholder="Nhập yêu cầu ứng viên…" />
              <MarkdownField label="Quyền lợi (đã duyệt)" name="benefits" defaultValue={j?.benefits} rows={6} required placeholder="Nhập quyền lợi dành cho ứng viên…" />
            </div>
          </Panel>
          <Panel className="!mb-0 h-fit">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[15px] font-semibold">Trạng thái hiện tại</p>
                <Badge status={j?.status ?? "draft"} />
              </div>
              {/* Nút "Đăng tin" trên thanh tiêu đề gửi status=open; ở đây chọn tay (đóng tin, về nháp) */}
              <Field label="Đổi trạng thái" name="status" defaultValue={j?.status ?? "draft"} options={[{ value: "draft", label: "Bản nháp" }, { value: "open", label: "Đang mở" }, { value: "closed", label: "Đã đóng" }]} />
              <Field label="Hạn nhận hồ sơ" name="deadline" type="date" defaultValue={j?.deadline} />
              <Field label="Bộ phận" name="department" defaultValue={j?.department} options={DEPTS} />
              <Field label="Đường dẫn (slug)" name="slug" defaultValue={j?.slug} hint="Để trống: tạo từ tên vị trí" />
              <DemoCheckbox defaultChecked={j?.isSample} />
              {j?.publishedAt && <p className="text-xs text-ink-muted">Đăng lần đầu {formatDateTimeVN(j.publishedAt)}</p>}
            </div>
          </Panel>
        </div>
      </ActionForm>
    </>
  );
}
