// A10 Cài đặt hệ thống (màn 023): Chung (thông tin website, kênh liên hệ, kết nối dịch vụ), Tích hợp, Dữ liệu cá nhân.
// Tài khoản & quyền (032), Thông báo (068), Nhật ký (039) ở trang con. Bí mật kết nối chỉ ở biến môi trường máy chủ.
import Link from "next/link";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";
import { aiConfigured, AI_MODEL } from "@/lib/ai/claude";
import { gscConfigured } from "@/lib/seo/gsc";
import { channelStatus } from "@/lib/admin-settings";
import { ActionForm, SubmitFor } from "@/components/admin/ActionForm";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { Badge, Field, IconBox, PageTitle, Panel, Table } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { saveChannels, saveConsent } from "../../actions/settings";

export const metadata = { title: "Cài đặt hệ thống" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage("settings.edit");
  const tab = (await searchParams).tab ?? "general";
  return (
    <>
      <PageTitle title="Cài đặt hệ thống">
        {tab === "general" && can(u.roles, "pages.edit") && <SubmitFor form="channels-form" label="Lưu thay đổi" />}
      </PageTitle>
      <SettingsTabs current={tab} />
      {tab === "general" && <General />}
      {tab === "integrations" && <Integrations />}
      {tab === "privacy" && <Privacy />}
    </>
  );
}

async function General() {
  const [c, ch] = await Promise.all([getSetting("company"), getSetting("channels")]);
  const st = channelStatus();
  const services = [
    { icon: "search" as const, label: "Search Console", ok: gscConfigured(), href: "/admin/seo/sources" },
    { icon: "sparkles" as const, label: "AI nội dung", ok: aiConfigured(), href: "/admin/seo/sources?tab=ai" },
    { icon: "mail" as const, label: "Email thông báo", ok: st.email, href: "/admin/settings/notifications" },
    { icon: "message" as const, label: "Telegram nội bộ", ok: st.telegram, href: "/admin/settings/notifications" },
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
      <Panel className="!mb-0">
        <h2 className="mb-4 text-2xl font-bold">Thông tin website</h2>
        <div className="space-y-4">
          <Field inline label="Tên website" name="_brand" defaultValue={c.brand} readOnly />
          <Field inline label="Email liên hệ" name="_email" defaultValue={c.email} readOnly />
          <Field inline label="Múi giờ" name="_tz" defaultValue="Việt Nam (UTC+7)" readOnly />
          <p className="text-sm text-ink-muted">Sửa tên, pháp nhân, email ở <Link href="/admin/pages?tab=about" className="font-semibold text-brand-dark underline">Trang công ty</Link> — một nguồn dùng chung cho Về HULAKO, Liên hệ và chân trang.</p>
        </div>
        <h2 className="mb-4 mt-8 border-t border-[#EFECE8] pt-6 text-2xl font-bold">Kênh liên hệ</h2>
        <ActionForm action={saveChannels} id="channels-form" buttons={null} toast>
          <div className="space-y-4">
            <Field inline label="Shopee" name="shopee" defaultValue={ch.shopee} placeholder="https://shopee.vn/…" />
            <Field inline label="TikTok Shop" name="tiktokShop" defaultValue={ch.tiktokShop} placeholder="https://…" />
            <Field inline label="TikTok kênh" name="tiktok" defaultValue={ch.tiktok} placeholder="https://www.tiktok.com/@…" />
            <Field inline label="Zalo (kênh tư vấn)" name="zalo" defaultValue={ch.zalo} placeholder="https://zalo.me/…" />
            <Field inline label="Messenger" name="messenger" defaultValue={ch.messenger} placeholder="https://m.me/…" />
            <p className="text-sm text-ink-muted">Kênh nào để trống sẽ tự ẩn trên website.</p>
          </div>
        </ActionForm>
      </Panel>
      <div className="space-y-5">
        <Panel className="!mb-0" title="Kết nối dịch vụ">
          {services.map((s) => (
            <div key={s.label} className="flex flex-wrap items-center gap-3 border-t border-[#EFECE8] py-3.5 first:border-0">
              <IconBox icon={s.icon} /><span className="flex-1 text-lg font-medium">{s.label}</span>
              <Badge status={s.ok ? "configured" : "not_configured"} />
              <Link href={s.href} className="btn-outline btn-sm">Cấu hình</Link>
            </div>
          ))}
        </Panel>
        <Panel className="!mb-0" title="Quản lý truy cập">
          <p className="text-ink-soft">Quản lý tài khoản, vai trò và phân quyền truy cập hệ thống.</p>
          <Link href="/admin/settings/users" className="mt-4 inline-flex items-center gap-2 text-lg font-semibold text-brand-dark hover:underline"><Icon name="users" /> Tài khoản và quyền <Icon name="chevronRight" className="h-4 w-4" /></Link>
        </Panel>
      </div>
    </div>
  );
}

function Integrations() {
  const st = channelStatus();
  const integ: [string, boolean, string][] = [
    ["Postgres (DATABASE_URL)", !!process.env.DATABASE_URL, process.env.DATABASE_URL ? "Postgres" : "PGlite cục bộ (chỉ dev)"],
    ["AI qua Claude CLI trên máy (RUNNER_TOKEN)", aiConfigured(), AI_MODEL],
    ["Search Console (GSC_*)", gscConfigured(), process.env.GSC_SITE_URL ?? ""],
    ["Lưu ảnh (BLOB_READ_WRITE_TOKEN)", !!process.env.BLOB_READ_WRITE_TOKEN, "thiếu → ảnh lưu trong Postgres"],
    ["Email thông báo (RESEND_API_KEY)", st.email, st.emailEnvRecipients ? "có người nhận mặc định" : "chưa có người nhận mặc định"],
    ["Telegram (TELEGRAM_BOT_TOKEN)", st.telegram, st.telegramEnvChat ? "có chat mặc định" : "chưa có chat mặc định"],
    ["Bảo vệ cron (CRON_SECRET)", !!process.env.CRON_SECRET, ""],
    ["Phiên đăng nhập (SESSION_SECRET)", (process.env.SESSION_SECRET ?? "").length >= 32, "≥ 32 ký tự"],
  ];
  return (
    <Panel title="Tích hợp (bí mật lưu ở biến môi trường máy chủ, không hiển thị)">
      <Table head={["Tích hợp", "Trạng thái", "Ghi chú"]}>
        {integ.map(([n, ok, note]) => <tr key={n}><td>{n}</td><td><Badge status={ok ? "configured" : "not_configured"} label={ok ? "Đã cấu hình" : "Chưa cấu hình"} /></td><td className="text-sm text-ink-muted">{note}</td></tr>)}
      </Table>
      <p className="mt-3 text-sm text-ink-muted">Lịch chạy & cấu hình AI Agent: <Link href="/admin/seo/schedule" className="font-semibold text-brand-dark underline">Lịch tự động AI SEO</Link>.</p>
    </Panel>
  );
}

async function Privacy() {
  const c = await getSetting("consent");
  return (
    <Panel title="Thông báo thu thập dữ liệu & thời hạn lưu">
      <ActionForm action={saveConsent} submitLabel="Lưu thông báo" submitIcon="save">
        <div className="space-y-4">
          <Field label="Phiên bản thông báo" name="version" defaultValue={c.version} hint="Đổi nội dung thì tăng phiên bản; mỗi hồ sơ lưu phiên bản tại thời điểm gửi." />
          <Field label="Thông báo ở form tư vấn" name="lead" defaultValue={c.lead} rows={3} />
          <Field label="Thông báo ở form ứng tuyển" name="application" defaultValue={c.application} rows={3} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lưu yêu cầu tư vấn (ngày)" name="retentionDaysLead" type="number" defaultValue={c.retentionDaysLead} />
            <Field label="Lưu hồ sơ ứng tuyển (ngày)" name="retentionDaysApplication" type="number" defaultValue={c.retentionDaysApplication} />
          </div>
        </div>
      </ActionForm>
      <p className="mt-3 text-xs text-ink-muted">Cron hằng ngày tự xoá hồ sơ quá hạn (kèm tệp CV). Yêu cầu xoá theo đề nghị của khách: mở hồ sơ → “Xoá dữ liệu cá nhân”.</p>
    </Panel>
  );
}
