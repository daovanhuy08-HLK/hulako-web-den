// Từ vựng lọc dùng chung cho thiết bị và mẫu góc live
export const USE_CASES = [
  { value: "livestream-ban-hang", label: "Livestream bán hàng" },
  { value: "quay-video", label: "Quay video nội dung" },
  { value: "chup-san-pham", label: "Chụp ảnh sản phẩm" },
  { value: "livestream-ca-nhan", label: "Livestream cá nhân" },
];

export const SPACES = [
  { value: "phong-nho", label: "Phòng nhỏ" },
  { value: "goc-ban", label: "Góc bàn" },
  { value: "phong-rong", label: "Phòng rộng" },
];
export const INDUSTRIES = [
  { value: "quan-ao", label: "Quần áo" },
  { value: "my-pham", label: "Mỹ phẩm" },
  { value: "khac", label: "Nhóm khác" },
];
export const STYLES = [
  { value: "ngoi", label: "Live ngồi" },
  { value: "dung", label: "Live đứng" },
  { value: "tren-ban", label: "Quay trên bàn" },
  { value: "review", label: "Quay review" },
];
export const FAQ_TOPICS = [
  { value: "lap-dat", label: "Lắp đặt" },
  { value: "anh-sang", label: "Ánh sáng" },
  { value: "chan-do", label: "Chân đỡ" },
  { value: "mua-hang", label: "Mua hàng & đổi trả" },
];
export const DEVICE_TYPES = [
  { value: "softbox", label: "Softbox" },
  { value: "den-bang", label: "Đèn bảng" },
  { value: "den-vong", label: "Đèn vòng" },
  { value: "chan-do", label: "Chân đỡ" },
];

export const pick = (v: string | string[] | undefined, allowed: { value: string }[]) =>
  typeof v === "string" && allowed.some((a) => a.value === v) ? v : undefined;
