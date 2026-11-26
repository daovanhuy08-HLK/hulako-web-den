// Thẻ điều hướng chung cho khu Cài đặt hệ thống
import { Tabs } from "./ui";

export function SettingsTabs({ current }: { current: string }) {
  return (
    <Tabs variant="underline" current={current} tabs={[
      { key: "general", label: "Chung", href: "/admin/settings" },
      { key: "users", label: "Tài khoản và quyền", href: "/admin/settings/users" },
      { key: "integrations", label: "Tích hợp", href: "/admin/settings?tab=integrations" },
      { key: "notifications", label: "Thông báo", href: "/admin/settings/notifications" },
      { key: "privacy", label: "Dữ liệu cá nhân", href: "/admin/settings?tab=privacy" },
      { key: "audit", label: "Nhật ký", href: "/admin/settings/audit" },
    ]} />
  );
}
