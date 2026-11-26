// Xử lý chữ tiếng Việt: bỏ dấu để tìm kiếm có dấu/không dấu, tạo slug, tạo mã.
import { randomBytes, createHash } from "node:crypto";

export function normalizeVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(s: string): string {
  return normalizeVi(s).replace(/\s/g, "-").slice(0, 90).replace(/-+$/, "");
}

/** Mã tiếp nhận dễ đọc, vd TV-7K3M9Q */
export function genCode(prefix: string): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function stripMarkdown(md: string): string {
  return md.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`|-]/g, " ").replace(/\s+/g, " ").trim();
}

export const VN_TZ = "Asia/Ho_Chi_Minh";
export function formatDateVN(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}
export function formatDateTimeVN(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(d));
}
/** "2026-11-20T09:00" (giờ VN từ input datetime-local) -> Date UTC */
export function parseVNLocal(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  return new Date(`${s}:00+07:00`);
}
