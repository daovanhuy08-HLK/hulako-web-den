// Màn 050 Chi tiết tác vụ AI (đặc biệt khi lỗi): mô tả lỗi dễ hiểu, kết nối lại nguồn / chạy lại, nguồn – chi phí – bản nháp, nhật ký xử lý.
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePage, requireUuid } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { JOB_TYPES } from "@/lib/ai/jobs";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton } from "@/components/admin/ActionForm";
import { SeoNav } from "@/components/admin/SeoNav";
import { Badge, IconBox, Notice, PageTitle, Panel } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { cancelAgentJob, retryAgentJob } from "../../../../actions/seo";

export const metadata = { title: "Chi tiết tác vụ AI" };

function explain(err: string | null): { title: string; text: string; source?: boolean } | null {
  if (!err) return null;
  if (/chưa cấu hình|not_configured/i.test(err)) return { title: "Nguồn dữ liệu chưa được cấu hình", text: "Cấu hình nguồn (Search Console / runner Claude CLI) rồi chạy lại tác vụ.", source: true };
  if (/từ chối quyền|403|auth lỗi|401/i.test(err)) return { title: "Kết nối nguồn đã hết hạn hoặc thiếu quyền", text: "Kết nối lại nguồn rồi chạy lại tác vụ.", source: true };
  if (/hạn mức|USD/i.test(err)) return { title: "Đã hết hạn mức chi phí AI tháng này", text: "Tăng hạn mức (AI_MONTHLY_BUDGET_USD) hoặc chờ sang tháng rồi chạy lại." };
  if (/sai cấu trúc/i.test(err)) return { title: "Kết quả AI sai cấu trúc — đã đưa vào hàng kiểm tra", text: "Xem lại dữ liệu đầu vào rồi chạy lại; không có nội dung nào được xuất bản." };
  return { title: "Tác vụ gặp lỗi", text: "Xem chi tiết lỗi bên dưới rồi chạy lại khi đã xử lý." };
}

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage("seo.view");
  const { id } = await params;
  requireUuid(id);
  const db = await getDb();
  const [j] = await db.select().from(schema.aiJobs).where(eq(schema.aiJobs.id, id));
  if (!j) notFound();
  const oppId = typeof j.scope.opportunityId === "string" ? j.scope.opportunityId : null;
  const [opp] = oppId ? await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, oppId)) : [];
  const articleId = (j.result?.articleId as string | undefined) ?? opp?.draftArticleId ?? null;
  const ex = j.status === "failed" || j.status === "skipped" ? explain(j.error) : null;
  const canRun = can(u.roles, "seo.run_ai");
  // created_by có thể là id người dùng (UUID) hoặc nhãn hệ thống ("cron", "runner"…) → hiện tên người cho dễ đọc
  const [creator] = /^[0-9a-f-]{36}$/i.test(j.createdBy ?? "")
    ? await db.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, j.createdBy))
    : [];
  const steps = [
    { ok: true, label: `Nhận yêu cầu · ${formatDateTimeVN(j.createdAt)} · bởi ${creator ? creator.name || creator.email : j.createdBy}` },
    ...(j.startedAt ? [{ ok: true, label: `Bắt đầu chạy · ${formatDateTimeVN(j.startedAt)} · lần thử ${j.attempts}` }] : []),
    ...(j.status === "done" ? [{ ok: true, label: `Hoàn thành · ${formatDateTimeVN(j.finishedAt)}` }] : []),
    ...(j.status === "failed" ? [{ ok: false, label: `Dừng do lỗi · ${formatDateTimeVN(j.finishedAt)}` }] : []),
    ...(j.status === "skipped" ? [{ ok: false, label: `Bỏ qua · ${j.error ?? (j.result?.skipped as string | undefined) ?? ""}` }] : []),
    ...(j.status === "cancelled" ? [{ ok: false, label: "Đã huỷ" }] : []),
    ...(["queued", "running", "waiting_runner", "runner_running"].includes(j.status) ? [{ ok: true, label: j.status === "queued" ? "Đang chờ tới lượt" : j.status === "waiting_runner" ? "Chờ runner trên máy nhận việc" : j.status === "runner_running" ? "Runner trên máy đang xử lý…" : "Đang chạy…" }] : []),
  ];

  return (
    <>
      <PageTitle title="Chi tiết tác vụ AI" back="/admin/seo?tab=jobs" />
      <SeoNav current="" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel className="!mb-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4"><IconBox icon="file" size="lg" /><div><p className="text-2xl font-bold">{JOB_TYPES[j.type as keyof typeof JOB_TYPES] ?? j.type}</p><p className="text-ink-muted">{opp ? `Chủ đề: ${opp.title}` : "Phạm vi: toàn bộ"}</p></div></div>
            <Badge status={j.status} />
          </div>
          {ex && (
            <div className="mt-5"><Notice tone="warn" title={ex.title}>{ex.text}</Notice></div>
          )}
          {j.error && <pre className="whitespace-pre-wrap rounded-xl bg-[#F7F5F2] p-3 text-xs text-ink-soft">{j.error}</pre>}
          <div className="mt-5 flex flex-wrap gap-3">
            {ex?.source && <Link href="/admin/seo/sources" className="btn-primary"><Icon name="link" /> Kết nối lại</Link>}
            {canRun && ["failed", "skipped", "cancelled"].includes(j.status) && <ActionButton action={retryAgentJob} label="Chạy lại tác vụ" icon="play" className="btn-outline" fields={{ id: j.id }} />}
            {canRun && j.status === "queued" && <ActionButton action={cancelAgentJob} label="Huỷ tác vụ" className="btn-line" fields={{ id: j.id }} />}
          </div>
          {!canRun && <p className="mt-2 text-xs text-ink-muted">Chạy lại cần quyền chạy AI (Biên tập viên SEO / Quản trị).</p>}
        </Panel>
        <Panel className="!mb-0">
          {[
            { icon: "database" as const, label: "Nguồn dữ liệu", v: ex?.source ? "Chờ kết nối" : j.type === "collect_gsc" || j.type === "harvest_keywords" ? "Search Console" : "Dữ liệu nội bộ" },
            { icon: "layers" as const, label: "Chi phí", v: j.costUsd ? `$${j.costUsd.toFixed(3)} · ${(j.inputTokens + j.outputTokens).toLocaleString("vi-VN")} token` : "—" },
            { icon: "sparkles" as const, label: "Model", v: j.model ? `${j.model}${j.promptVersion ? ` · v${j.promptVersion}` : ""}` : "—" },
          ].map((x) => (
            <div key={x.label} className="flex items-center gap-4 border-t border-[#EFECE8] py-4 first:border-0 first:pt-0"><IconBox icon={x.icon} /><span className="flex-1 whitespace-nowrap text-lg font-semibold">{x.label}</span><span className="max-w-[60%] rounded-full bg-[#EFEDEA] px-3 py-1 text-right text-sm">{x.v}</span></div>
          ))}
          <div className="flex items-center gap-4 border-t border-[#EFECE8] pt-4"><IconBox icon="file" /><span className="flex-1 text-lg font-semibold">Bản nháp</span>
            {articleId ? <Link href={`/admin/content/${articleId}`} className="btn-line btn-sm">Mở bản nháp</Link> : <span className="rounded-full bg-[#EFEDEA] px-3 py-1 text-sm">Chưa tạo</span>}</div>
          {j.needsReview && <p className="mt-3 rounded-xl bg-[#FDECEC] p-3 text-sm font-semibold text-[#7A1A1A]">Kết quả cần người kiểm tra (claim bị chặn hoặc sai cấu trúc).</p>}
        </Panel>
      </div>
      <Panel title="Nhật ký xử lý" className="mt-5">
        <ul>{steps.map((s, i) => (
          <li key={i} className="flex items-center gap-4 border-t border-[#EFECE8] py-3 first:border-0"><IconBox icon={s.ok ? "checkCircle" : "xCircle"} tone={s.ok ? "green" : "red"} size="sm" /><span className="text-lg">{s.label}</span></li>
        ))}</ul>
        {j.result && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Kết quả thô</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[#F7F5F2] p-3 text-xs">{JSON.stringify(j.result, null, 2)}</pre></details>}
      </Panel>
    </>
  );
}
