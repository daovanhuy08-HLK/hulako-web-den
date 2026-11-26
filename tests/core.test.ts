// Kiểm thử logic lõi không cần CSDL: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkClaims } from "../src/lib/guardrails";
import { normalizeVi, slugify, parseVNLocal } from "../src/lib/text";
import { isAllowedMarketUrl } from "../src/lib/settings";
import { findConflicts, pickRule } from "../src/lib/recommend";
import { expectedCtr } from "../src/lib/seo/metrics";

test("T10: chặn claim cấm theo quy tắc biên tập HULAKO", () => {
  const bad = [
    "Đèn chính hãng siêu sáng", "Công suất 400W cực mạnh", "Live là ra đơn, tăng doanh số x10", "Bảo hành 12 tháng toàn quốc",
    "Thương hiệu HULAKO®", "CRI 95%", "Nhiệt độ màu 2700W-6500W", "Rẻ nhất thị trường", "HULAKO đã được bảo hộ",
  ];
  for (const t of bad) assert.ok(checkClaims({ t }).length > 0, `phải chặn: ${t}`);
  const ok = ["Nhiệt độ màu 2700K–6500K, CRI 95", "Đặt đèn chếch 45° là da sáng đều", "Đã nộp đơn đăng ký nhãn hiệu"];
  for (const t of ok) assert.equal(checkClaims({ t }).length, 0, `không được chặn: ${t}`);
});

test("T03: tìm kiếm có dấu và không dấu chuẩn hoá giống nhau", () => {
  assert.equal(normalizeVi("Đèn LIVE bị tối"), "den live bi toi");
  assert.equal(normalizeVi("den live bi toi"), "den live bi toi");
  assert.equal(slugify("Cách đặt đèn cho phòng nhỏ!"), "cach-dat-den-cho-phong-nho");
});

test("Lịch đăng: giờ Việt Nam lưu thành UTC", () => {
  assert.equal(parseVNLocal("2026-11-20T09:00")?.toISOString(), "2026-11-20T02:00:00.000Z");
  assert.equal(parseVNLocal("sai"), null);
});

test("Link mua chỉ nhận HTTPS + tên miền sàn công khai", () => {
  assert.ok(isAllowedMarketUrl("https://shopee.vn/product/1/2"));
  assert.ok(isAllowedMarketUrl("https://vt.tiktok.com/abc"));
  assert.ok(!isAllowedMarketUrl("http://shopee.vn/x"));
  assert.ok(!isAllowedMarketUrl("https://seller-vn.tiktok.com.evil.com/x"));
  assert.ok(!isAllowedMarketUrl("javascript:alert(1)"));
});

type R = Parameters<typeof pickRule>[0][number];
const rule = (id: string, priority: number, conditions: R["conditions"]): R =>
  ({ id, ruleSetVersion: 1, name: id, priority, conditions, setupId: null, variantIds: [], advice: "", articleSlug: null, note: "" });

test("T09: chọn quy tắc ưu tiên cao nhất, trùng mức thì cụ thể hơn; kết quả ổn định", () => {
  const rules = [
    rule("a", 5, { style: ["ngoi"] }),
    rule("b", 5, { style: ["ngoi"], area: ["duoi-10"] }),
    rule("c", 10, { industry: ["my-pham"], style: ["tren-ban"] }),
  ];
  const input = { area: "duoi-10", industry: "quan-ao", style: "ngoi", owned: [] } as const;
  assert.equal(pickRule(rules, { ...input, owned: [] })?.id, "b");
  assert.equal(pickRule(rules, { ...input, owned: [] })?.id, "b"); // cùng đầu vào → cùng kết quả
  assert.equal(pickRule(rules, { area: "chua-biet", industry: "khac", style: "dung", owned: [] }), null); // ngoài mẫu → tư vấn
});

test("Phát hiện xung đột quy tắc trước khi kích hoạt", () => {
  assert.equal(findConflicts([rule("a", 5, { style: ["ngoi"] }), rule("b", 5, { style: ["ngoi", "dung"] })]).length, 1);
  assert.equal(findConflicts([rule("a", 5, { style: ["ngoi"] }), rule("b", 6, { style: ["ngoi"] })]).length, 0);
  assert.equal(findConflicts([rule("a", 5, { style: ["ngoi"] }), rule("b", 5, { style: ["dung"] })]).length, 0);
});

test("Feedback loop: CTR kỳ vọng giảm theo vị trí", () => {
  assert.ok(expectedCtr(1) > expectedCtr(3));
  assert.ok(expectedCtr(8) > expectedCtr(15));
});

test("DNA mục 9–10: chặn thêm claim cấm (đối chiếu HULAKO_DNA.md v0.1)", () => {
  const bad = [
    "Bí quyết giàu nhanh nhờ live", "Bảo hành trọn đời", "Bảo hành 1 năm", "Đèn siêu sáng cho phòng nhỏ", "Sáng gấp 5 lần đèn thường",
    "Chân chắc chắn tuyệt đối", "Đừng mua hàng dỏm của shop kia", "90% người bán live bị tối", "7 năm làm nghề thiết bị livestream",
  ];
  for (const t of bad) assert.ok(checkClaims({ t }).length > 0, `phải chặn: ${t}`);
  const ok = ["Phòng 10m² dùng một đèn chính là đủ sáng mặt.", "Đổi trả theo chính sách của sàn nơi bạn mua.", "Nhiệt độ màu 5600K, CRI 95"];
  for (const t of ok) assert.equal(checkClaims({ t }).length, 0, `không được chặn: ${t}`);
});
