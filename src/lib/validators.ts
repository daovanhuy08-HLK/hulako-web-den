// Schema kiểm tra dữ liệu dùng chung cho trình duyệt và máy chủ.
import { z } from "zod";

const phoneRe = /^(\+?84|0)[0-9]{8,10}$/;

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập họ tên").max(80),
  email: z.string().trim().email("Email chưa đúng định dạng").max(120).optional().or(z.literal("")),
  phone: z.string().trim().regex(phoneRe, "Số điện thoại chưa đúng (vd 0912345678)").optional().or(z.literal("")),
  topic: z.string().trim().min(1, "Vui lòng chọn chủ đề").max(60),
  message: z.string().trim().min(5, "Nội dung quá ngắn").max(3000, "Nội dung tối đa 3000 ký tự"),
  context: z.record(z.string(), z.unknown()).default({}),
  source: z.enum(["contact", "product", "article", "selector", "support", "lead_magnet"]).default("contact"),
  consent: z.literal(true, { message: "Bạn cần đồng ý để HULAKO liên hệ lại" }),
  idempotencyKey: z.string().min(8).max(80),
  website: z.string().max(200).optional(), // ô ẩn bẫy bot
}).refine((d) => d.email || d.phone, { message: "Cần ít nhất email hoặc số điện thoại", path: ["phone"] });

// Popup quà tặng trong bài viết: bắt buộc đủ 5 trường (tên, SĐT, email, lĩnh vực kinh doanh, địa chỉ nhận hàng)
export const magnetLeadSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập họ tên").max(80),
  phone: z.string().trim().regex(phoneRe, "Số điện thoại chưa đúng (vd 0912345678)"),
  email: z.string().trim().email("Email chưa đúng định dạng").max(120),
  businessField: z.string().trim().min(2, "Vui lòng chọn lĩnh vực kinh doanh").max(80),
  shippingAddress: z.string().trim().min(10, "Vui lòng nhập địa chỉ đầy đủ (số nhà, phường/xã, tỉnh/thành)").max(300, "Địa chỉ tối đa 300 ký tự"),
  context: z.record(z.string(), z.unknown()).default({}),
  source: z.literal("lead_magnet"),
  consent: z.literal(true, { message: "Bạn cần đồng ý để HULAKO gửi quà và liên hệ" }),
  idempotencyKey: z.string().min(8).max(80),
  website: z.string().max(200).optional(), // ô ẩn bẫy bot
});

export const applicationSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập họ tên").max(80),
  email: z.string().trim().email("Email chưa đúng định dạng").max(120).optional().or(z.literal("")),
  phone: z.string().trim().regex(phoneRe, "Số điện thoại chưa đúng").optional().or(z.literal("")),
  note: z.string().trim().max(2000).default(""),
  consent: z.literal("on", { message: "Bạn cần đồng ý với thông báo xử lý dữ liệu" }),
}).refine((d) => d.email || d.phone, { message: "Cần ít nhất email hoặc số điện thoại", path: ["phone"] });
