// Lựa chọn của công cụ chọn đèn — dùng được cả ở trình duyệt (không import DB)
export const AREA_OPTIONS = [
  { value: "duoi-10", label: "Dưới 10 m²" },
  { value: "10-20", label: "10–20 m²" },
  { value: "tren-20", label: "Trên 20 m²" },
  { value: "chua-biet", label: "Chưa biết" },
] as const;
export const INDUSTRY_OPTIONS = [
  { value: "quan-ao", label: "Quần áo" },
  { value: "my-pham", label: "Mỹ phẩm" },
  { value: "khac", label: "Khác" },
] as const;
export const STYLE_OPTIONS = [
  { value: "ngoi", label: "Live ngồi" },
  { value: "dung", label: "Live đứng" },
  { value: "tren-ban", label: "Quay trên bàn" },
  { value: "chua-xac-dinh", label: "Chưa xác định" },
] as const;
export const OWNED_OPTIONS = [
  { value: "den", label: "Đèn" },
  { value: "chan-do", label: "Chân đỡ" },
  { value: "gia-dien-thoai", label: "Giá điện thoại" },
  { value: "chua-co", label: "Chưa có" },
] as const;

