// Kiểm thử phần chấm kết luận thí nghiệm của vòng học (src/lib/seo/learning-core.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, pearson } from "../src/lib/seo/learning-core";

const empty = { impressions: 0, clicks: 0, ctr: null, position: null, views: 0, conversions: 0 };

test("bài mới: có ≥10 nhấp hoặc ≥1 chuyển đổi → thắng", () => {
  assert.equal(judge("new_article", empty, { ...empty, impressions: 400, clicks: 12, views: 50 }).verdict, "win");
  assert.equal(judge("new_article", empty, { ...empty, impressions: 200, clicks: 2, views: 40, conversions: 1 }).verdict, "win");
});
test("bài mới: gần như không hiển thị → thua; ít dữ liệu → chưa đủ", () => {
  assert.equal(judge("new_article", empty, { ...empty, impressions: 2 }).verdict, "loss");
  assert.equal(judge("new_article", empty, { ...empty, impressions: 20, views: 10 }).verdict, "insufficient");
});
test("viết lại tiêu đề: CTR tăng ≥15% → thắng, giảm ≥15% → thua, thiếu hiển thị → chưa đủ", () => {
  const before = { ...empty, impressions: 1000, clicks: 20, ctr: 0.02 };
  assert.equal(judge("ctr_fix", before, { ...empty, impressions: 1000, clicks: 30, ctr: 0.03 }).verdict, "win");
  assert.equal(judge("ctr_fix", before, { ...empty, impressions: 1000, clicks: 10, ctr: 0.01 }).verdict, "loss");
  assert.equal(judge("ctr_fix", before, { ...empty, impressions: 10, clicks: 1, ctr: 0.1 }).verdict, "insufficient");
});
test("cập nhật nội dung: lên ≥2 bậc → thắng", () => {
  assert.equal(judge("update", { ...empty, impressions: 300, clicks: 10, position: 12 }, { ...empty, impressions: 320, clicks: 10, position: 9 }).verdict, "win");
});
test("tương quan Pearson", () => {
  assert.ok(pearson([1, 2, 3, 4], [1, 2, 3, 4]) > 0.99);
  assert.ok(pearson([1, 2, 3, 4], [4, 3, 2, 1]) < -0.99);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), 0);
});
