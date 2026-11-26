// Màn 068 Thông báo nội bộ: bật/tắt loại thông báo, người nhận email, chat Telegram (lưu settings "admin.notify"),
// trạng thái kênh (chỉ đã/chưa cấu hình — không lộ khoá), gửi thử.
import { requirePage } from "@/lib/admin-page";
import { channelStatus, getAdminSetting } from "@/lib/admin-settings";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { IconBox, Notice, PageTitle, Panel, Toggle } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { saveNotify, sendSeoReportNow, testNotify } from "../../../actions/extra";

export const metadata = { title: "Thông báo nội bộ" };

export default async function Notifications() {
  await requirePage("settings.edit");
  const [cfg, st] = await Promise.all([getAdminSetting("admin.notify"), Promise.resolve(channelStatus())]);
  const Status = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${ok ? "bg-[#E7F6EC] text-[#1E7B3C]" : "bg-[#EFEDEA] text-ink-soft"}`}><span className={`h-2 w-2 rounded-full ${ok ? "bg-[#1E7B3C]" : "bg-ink-muted"}`} />{label}</span>
  );
  return (
    <>
      <PageTitle title="Thông báo nội bộ" />
      <SettingsTabs current="notifications" />
      <ActionForm action={saveNotify} buttons={null} toast id="notify-form">
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Nội dung thông báo" className="!mb-0">
            {[
              { name: "ev_lead", icon: "message" as const, label: "Yêu cầu tư vấn mới", on: cfg.events.lead },
              { name: "ev_application", icon: "briefcase" as const, label: "Hồ sơ ứng tuyển mới", on: cfg.events.application },
              { name: "ev_review", icon: "file" as const, label: "Bài chờ duyệt", on: cfg.events.review },
              { name: "ev_aiFailed", icon: "sparkles" as const, label: "Tác vụ AI thất bại", on: cfg.events.aiFailed },
              { name: "ev_seoReport", icon: "trending" as const, label: "Báo cáo AI SEO (hằng ngày + hằng tuần)", on: cfg.events.seoReport !== false },
            ].map((e) => (
              <div key={e.name} className="flex items-center gap-4 border-t border-[#EFECE8] py-4 first:border-0">
                <IconBox icon={e.icon} /><span className="flex-1 text-lg">{e.label}</span><Toggle name={e.name} defaultChecked={e.on} />
              </div>
            ))}
          </Panel>
          <Panel title="Kênh nhận thông báo" className="!mb-0">
            <label htmlFor="n-emails" className="mb-1.5 block text-lg font-semibold">Email</label>
            <input id="n-emails" name="emails" defaultValue={cfg.emails.join(", ")} className="input" placeholder="vd quanly@congty.vn, tuvan@congty.vn" />
            <div className="mt-2"><Status ok={st.email} label={st.email ? "Dịch vụ email đã cấu hình" : "Chưa cấu hình (RESEND_API_KEY)"} /></div>
            <label htmlFor="n-tg" className="mb-1.5 mt-5 block text-lg font-semibold">Telegram — chat ID</label>
            <input id="n-tg" name="telegramChatId" defaultValue={cfg.telegramChatId} className="input" placeholder="vd -1001234567890" />
            <div className="mt-2"><Status ok={st.telegram} label={st.telegram ? "Bot Telegram đã cấu hình" : "Chưa cấu hình (TELEGRAM_BOT_TOKEN)"} /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ActionButton action={testNotify} label="Kiểm tra gửi thử" className="btn-line w-full" />
              <ActionButton action={sendSeoReportNow} label="Gửi báo cáo SEO ngay" className="btn-line w-full" />
              <button type="submit" className="btn-primary w-full">Lưu cấu hình</button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted"><Icon name="info" className="h-4 w-4" /> Yêu cầu và hồ sơ vẫn được lưu trong quản trị dù gửi thông báo lỗi.</p>
          </Panel>
        </div>
      </ActionForm>
      <Notice tone="info" icon="info">
        Thông báo tự động đọc theo cấu hình ở trang này. Ô chat ID để trống thì dùng biến môi trường TELEGRAM_ADMIN_CHAT_ID.
        Bài chờ duyệt: báo khi AI viết xong bản nháp. Báo cáo AI SEO: 3:00 sáng mỗi ngày (gửi im lặng) và sáng thứ Hai sau vòng SEO hằng tuần.
      </Notice>
    </>
  );
}
