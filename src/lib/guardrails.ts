// Quy tắc biên tập HULAKO (mục 11 đặc tả + DNA mục 9): chặn claim cấm trước khi xuất bản.
// Áp dụng cho tiêu đề, metadata, alt ảnh, nội dung và dữ liệu có cấu trúc.
import { normalizeVi } from "./text";

export type GuardIssue = { rule: string; match: string; field: string; hint: string };

type Rule = { id: string; re: RegExp; hint: string; raw?: boolean };

// raw=true: so trên chuỗi gốc (cần ký hiệu/đơn vị); còn lại so trên chuỗi đã bỏ dấu
const RULES: Rule[] = [
  { id: "chinh-hang", re: /chinh hang/, hint: "Không dùng cụm “chính hãng”." },
  { id: "registered", re: /®|\(r\)/i, raw: true, hint: "Không dùng ký hiệu ®." },
  { id: "bao-ho", re: /da duoc bao ho|duoc bao ho doc quyen/, hint: "Chỉ được ghi “đã nộp đơn đăng ký nhãn hiệu”." },
  { id: "cong-suat", re: /\b\d{2,5}\s?w\b/i, raw: true, hint: "Không nêu công suất W khi chưa có số đo đã xác nhận." },
  { id: "doanh-so", re: /tang (don|doanh so|doanh thu|thu nhap|view)|x\s?\d+ doanh so|trieu view|live la ra don|ra don ngay/, hint: "Không hứa tăng đơn, doanh số, thu nhập, lượt xem." },
  { id: "lam-giau", re: /lam giau|giau nhanh|von 0 dong|thu nhap \d/, hint: "Không nói làm giàu nhanh, thu nhập cụ thể." },
  { id: "bao-hanh", re: /bao hanh (\d+ (thang|nam)|tron doi)/, hint: "Cam kết bảo hành chung chưa được duyệt." },
  { id: "tuyet-doi", re: /\b(re nhat|tot nhat|so 1|so mot|doc quyen|khong bao gio do|ben mai|hang dau|chac chan tuyet doi|sieu sang|sang gap \d+ lan)\b/, hint: "Tuyên bố vị thế tuyệt đối thiếu căn cứ." },
  // DNA mục 9: không chê đích danh shop/thương hiệu khác
  { id: "che-doi-thu", re: /\b(hang dom|hang nhai|hang lo|shop kia)\b/, hint: "Không chê shop hoặc thương hiệu khác — chỉ hướng dẫn cách so sánh." },
  // DNA mục 10: chưa có số liệu nào được duyệt công bố; không tự đặt phần trăm
  { id: "phan-tram-tu-dat", re: /\d+([.,]\d+)?\s?%\s?(người|khách|shop|đơn|nguoi|khach|don)/i, raw: true, hint: "Không tự đặt phần trăm khi chưa có khảo sát/số liệu được duyệt." },
  { id: "kinh-nghiem-chua-duyet", re: /\b\d+ nam (lam nghe|kinh nghiem|trong nghe)\b/, hint: "Số năm làm nghề chưa được founder xác nhận công bố." },
  { id: "tu-cam", re: /\b(sieu pham|dinh cao|hoan hao|cuc ky|dang cap|bung no)\b/, hint: "Từ ngữ quảng cáo nằm trong danh sách không dùng." },
  { id: "cri-phan-tram", re: /cri\s*[:=]?\s*\d+\s*%/i, raw: true, hint: "Ghi CRI không kèm %." },
  { id: "nhiet-do-mau", re: /\b\d{4}\s?w\s?[-–]\s?\d{4}\s?w\b/i, raw: true, hint: "Nhiệt độ màu ghi đơn vị K (vd 2700K–6500K)." },
  { id: "so-lieu-noi-bo", re: /\b\d{1,3}([.,]\d{3})+ (don|khach hang)\b/, hint: "Số liệu nội bộ chưa được duyệt công bố." },
];

export function checkClaims(fields: Record<string, string | null | undefined>): GuardIssue[] {
  const issues: GuardIssue[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const norm = normalizeVi(value.replace(/®/g, " (r) "));
    for (const r of RULES) {
      const m = (r.raw ? value : norm).match(r.re);
      if (m) issues.push({ rule: r.id, match: m[0], field, hint: r.hint });
    }
  }
  return issues;
}

/** Danh sách luật dạng chữ để đưa vào prompt AI */
export const GUARDRAIL_TEXT = `LUẬT CỨNG (vi phạm thì bài bị chặn xuất bản):
1. Không viết "chính hãng". Không dùng ký hiệu ®. Không nói "đã được bảo hộ".
2. Không nêu công suất W cụ thể. Nhiệt độ màu ghi đơn vị K (2700K–6500K). CRI không có %.
3. Không hứa tăng đơn, tăng doanh số, tăng view, thu nhập, làm giàu.
4. Không cam kết bảo hành chung (vd "bảo hành 12 tháng").
5. Không dùng: rẻ nhất, tốt nhất, số 1, độc quyền, không bao giờ đổ, siêu phẩm, đỉnh cao, hoàn hảo, cực kỳ, đẳng cấp, bùng nổ, triệu view.
6. Không bịa số liệu, đánh giá, lời khách. Hiện CHƯA có số liệu nào được duyệt công bố (số đơn, % khách, số năm làm nghề, điểm sao…). Không tự đặt phần trăm.
7. Không nhắc tên gian hàng nào ngoài "gian hàng HULAKO". Không chê đích danh shop/thương hiệu khác ("hàng dỏm", "shop kia").
8. Không nói "giàu nhanh", "vốn 0 đồng", "siêu sáng", "sáng gấp N lần", "chắc chắn tuyệt đối".
9. Dữ kiện chưa chắc chắn phải đưa vào danh sách cần kiểm chứng, không viết như sự thật. Các mục DNA còn ⚠️ (bảo hành, công suất, độ vững chân theo lô, năm thành lập, sứ mệnh/tầm nhìn, đối thủ) KHÔNG được viết như sự thật.`;
