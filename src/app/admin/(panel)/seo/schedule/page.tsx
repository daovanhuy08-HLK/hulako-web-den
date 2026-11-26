// Màn 057 Lịch tự động AI SEO: danh sách lịch (lưu settings "admin.schedule"), sửa lịch, giới hạn tác vụ, chạy thử;
// kèm cấu hình AI Agent mà cron hằng tuần đang đọc (tạm dừng, số bản nháp/tuần, điểm tối thiểu...).
import Link from "next/link";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";
import { getAdminSetting } from "@/lib/admin-settings";
import { aiConfigured } from "@/lib/ai/claude";
import { gscConfigured } from "@/lib/seo/gsc";
import { JOB_TYPES } from "@/lib/ai/jobs";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { SeoNav } from "@/components/admin/SeoNav";
import { Badge, Field, Notice, PageTitle, Panel, Toggle } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { runAgentJob, saveAgentConfig } from "../../../actions/seo";
import { saveSchedule } from "../../../actions/extra";

export const metadata = { title: "Lịch tự động AI SEO" };
const FREQ: Record<string, string> = { daily: "Hằng ngày", weekly: "Hằng tuần", monthly: "Hằng tháng" };
const DOW = ["", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const SOURCES: Record<string, string> = { gsc: "Search Console", csv: "Từ khoá nhập CSV", manual: "Danh sách chủ đề / nhập tay", trend: "Nguồn xu hướng" };

export default async function Schedule({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage("seo.view");
  const sp = await searchParams;
  const [cfg, agent] = await Promise.all([getAdminSetting("admin.schedule"), getSetting("agent")]);
  const cur = sp.key === "new" ? undefined : cfg.items.find((i) => i.key === sp.key) ?? cfg.items[0];
  const canEdit = can(u.roles, "settings.edit");
  const sourceOk = (s: string) => (s === "gsc" ? gscConfigured() : s === "trend" ? false : true);

  return (
    <>
      <PageTitle title="Lịch tự động AI SEO">
        {canEdit && <Link href="?key=new" className="btn-line"><Icon name="plus" /> Thêm lịch</Link>}
      </PageTitle>
      <SeoNav current="/admin/seo/schedule" />
      {agent.paused && <Notice tone="warn" title="Toàn bộ lịch tự động đang TẠM DỪNG">Cron vẫn gọi nhưng bỏ qua; vẫn chạy tay được ở trang AI SEO.</Notice>}
      <Notice tone="info" icon="info">Giờ chạy thực tế hiện do cron máy chủ quyết định (hằng ngày 03:00, thứ Hai 04:00, xuất bản bài hẹn 08:00 — giờ VN). Lịch dưới đây lưu cấu hình mong muốn; để cron đọc theo lịch này cần nối thêm ở backend.</Notice>
      <div className="mb-5 flex flex-wrap gap-2">
        {cfg.items.map((i) => (
          <Link key={i.key} href={`?key=${i.key}`} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${i.key === cur?.key ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white"}`}>
            {i.name} <Badge status={i.enabled ? "active" : "draft"} label={i.enabled ? "Bật" : "Tắt"} />
          </Link>
        ))}
      </div>
      <ActionForm action={saveSchedule} buttons={null} key={cur?.key ?? "new"}>
        <input type="hidden" name="key" value={cur?.key ?? ""} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <Panel className="!mb-0">
            <div className="space-y-4">
              <Field inline label="Tên lịch" name="name" defaultValue={cur?.name ?? ""} placeholder="vd Gom cơ hội từ khoá" />
              <Field inline label="Loại tác vụ" name="type" defaultValue={cur?.type ?? "score_opportunities"} options={Object.entries(JOB_TYPES).filter(([k]) => k !== "write_draft").map(([value, label]) => ({ value, label }))} />
              <Field inline label="Nguồn dữ liệu" name="source" defaultValue={cur?.source ?? "gsc"} options={Object.entries(SOURCES).map(([value, label]) => ({ value, label: `${label}${sourceOk(value) ? "" : " (chưa cấu hình)"}` }))} />
              <Field inline label="Tần suất" name="frequency" defaultValue={cur?.frequency ?? "weekly"} options={Object.entries(FREQ).map(([value, label]) => ({ value, label }))} />
              <Field inline label="Ngày chạy (hằng tuần)" name="weekday" defaultValue={String(cur?.weekday ?? 1)} options={DOW.slice(1).map((l, i) => ({ value: String(i + 1), label: l }))} />
              <Field inline label="Ngày trong tháng" name="monthDay" type="number" defaultValue={cur?.monthDay ?? 1} hint="Dùng khi tần suất Hằng tháng (1–28)" />
              <Field inline label="Giờ chạy" name="hour" type="time" defaultValue={cur?.hour ?? "03:00"} />
              <Field inline label="Múi giờ" name="tz" defaultValue="Việt Nam (UTC+7)" readOnly />
              <div className="grid items-center gap-2 border-t border-[#EFECE8] pt-4 sm:grid-cols-[180px_1fr]"><span className="text-[15px] font-semibold">Kích hoạt lịch</span><Toggle name="enabled" defaultChecked={cur?.enabled} disabled={!canEdit} /></div>
              {cur && !cur.enabled && <p className="flex items-center gap-2 rounded-xl bg-brand-tint px-4 py-3 text-sm"><Icon name="info" className="h-5 w-5" /> Lịch đang tắt</p>}
            </div>
          </Panel>
          <Panel title="Giới hạn tác vụ" className="!mb-0 h-fit">
            <div className="space-y-4">
              <Field label="Số lượt tối đa mỗi ngày" name="maxRunsPerDay" type="number" defaultValue={cfg.maxRunsPerDay ?? ""} placeholder="Không giới hạn" />
              <Field label="Ngân sách tối đa (USD / tháng)" name="maxBudgetUsd" type="number" defaultValue={cfg.maxBudgetUsd ?? ""} placeholder={`Mặc định máy chủ: ${process.env.AI_MONTHLY_BUDGET_USD ?? 30}`} hint="Hạn mức cứng hiện vẫn là AI_MONTHLY_BUDGET_USD trên máy chủ." />
              <p className={`flex items-center gap-3 rounded-xl px-4 py-3 ${cur && sourceOk(cur.source) ? "bg-[#E7F6EC] text-[#14532D]" : "bg-brand-tint"}`}><Icon name="database" /> {cur && sourceOk(cur.source) ? "Nguồn đã cấu hình" : "Chưa cấu hình nguồn"}{!aiConfigured() && " · chưa cấu hình runner AI"}</p>
              <p className="text-sm">Tạm dừng toàn bộ: <b>{agent.paused ? "đang tạm dừng" : "không"}</b> (đổi ở khung bên dưới)</p>
              <div className="grid grid-cols-2 gap-3 border-t border-[#EFECE8] pt-4">
                <button type="submit" className="btn-primary" disabled={!canEdit}>Lưu cấu hình</button>
                {can(u.roles, "seo.run_ai") && cur ? <ActionButton action={runAgentJob} label="Chạy thử" icon="play" className="btn-outline w-full" fields={{ type: cur.type }} /> : <span />}
              </div>
              {!canEdit && <p className="text-xs text-ink-muted">Sửa lịch cần quyền Cài đặt (Quản trị hệ thống).</p>}
            </div>
          </Panel>
        </div>
      </ActionForm>
      <Panel title="Cấu hình AI Agent (cron hằng tuần đang dùng)" className="mt-5">
        {canEdit ? (
          <ActionForm action={saveAgentConfig} submitLabel="Lưu cấu hình Agent" submitIcon="save">
            <div className="space-y-4">
              <Toggle name="paused" defaultChecked={agent.paused} label={<><b>Tạm dừng</b> toàn bộ lịch tự động (vẫn chạy tay được)</>} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Số bản nháp AI tự viết mỗi tuần" name="autoDraftsPerWeek" type="number" defaultValue={agent.autoDraftsPerWeek} hint="Lấy từ cơ hội điểm cao nhất. 0 = chỉ đề xuất." />
                <Field label="Điểm tối thiểu để tự viết" name="minScoreForAutoDraft" type="number" defaultValue={agent.minScoreForAutoDraft} />
              </div>
              <Toggle name="suggestKeywordsWeekly" defaultChecked={agent.suggestKeywordsWeekly} label="AI đề xuất từ khoá mới mỗi tuần" />
              <Toggle name="improvePromptMonthly" defaultChecked={agent.improvePromptMonthly} label="AI đề xuất nâng cấp hướng dẫn viết mỗi tháng (cần người duyệt kích hoạt)" />
            </div>
          </ActionForm>
        ) : <p className="text-ink-muted">Tạm dừng: {agent.paused ? "có" : "không"} · {agent.autoDraftsPerWeek} bản nháp/tuần · điểm tối thiểu {agent.minScoreForAutoDraft}.</p>}
      </Panel>
    </>
  );
}
