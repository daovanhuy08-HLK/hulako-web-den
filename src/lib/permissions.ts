// Phân quyền theo vai trò (mục 07). Kiểm ở máy chủ cho từng hành động.
import type { Role } from "./db/schema";

export const PERMS = {
  "content.edit": ["admin", "seo_editor", "reviewer"],
  "content.submit": ["admin", "seo_editor"],
  "content.review": ["admin", "reviewer"], // duyệt, yêu cầu sửa, lên lịch, xuất bản, gỡ, khôi phục
  "product.edit": ["admin", "product_ops"],
  "product.publish": ["admin"], // cấp riêng cho vận hành bằng cách thêm vai trò admin hoặc reviewer
  "setup.edit": ["admin", "product_ops"],
  "rules.activate": ["admin"],
  "media.edit": ["admin", "product_ops", "seo_editor"],
  "media.approve": ["admin", "product_ops"],
  "pages.edit": ["admin"],
  "faq.edit": ["admin", "consultant"],
  "lead.view": ["admin", "consultant"],
  "job.edit": ["admin", "recruiter"],
  "application.view": ["admin", "recruiter"],
  "seo.view": ["admin", "seo_editor", "reviewer"],
  "seo.run_ai": ["admin", "seo_editor", "ai_agent"],
  "settings.edit": ["admin"],
  "users.manage": ["admin"],
} satisfies Record<string, Role[]>;

export type Perm = keyof typeof PERMS;

export function can(roles: readonly Role[] | undefined, perm: Perm): boolean {
  if (!roles) return false;
  return roles.some((r) => (PERMS[perm] as readonly Role[]).includes(r));
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quản trị hệ thống",
  seo_editor: "Biên tập viên SEO",
  reviewer: "Người duyệt nội dung",
  product_ops: "Vận hành sản phẩm",
  consultant: "Tư vấn viên",
  recruiter: "Tuyển dụng",
  ai_agent: "Tài khoản tác vụ AI",
};
