// Phần tính toán thuần của vòng học (không truy cập CSDL) — để kiểm thử độc lập.
export type Snapshot = Record<string, number | null>;

/** Kết luận theo loại thí nghiệm. Trả "insufficient" khi chưa đủ dữ liệu để nói chắc. */
export function judge(kind: string, before: Snapshot, after: Snapshot): { verdict: "win" | "loss" | "neutral" | "insufficient"; score: number } {
  const n = (v: number | null | undefined) => Number(v ?? 0);
  const outcome = n(after.clicks) + 5 * n(after.conversions); // điểm kết quả: 1 nhấp = 1, 1 chuyển đổi (bấm sàn/tư vấn/gửi form) = 5
  if (kind === "new_article") {
    if (n(after.impressions) < 30 && n(after.views) < 30) return { verdict: n(after.impressions) < 5 ? "loss" : "insufficient", score: outcome };
    if (n(after.clicks) >= 10 || n(after.conversions) >= 1) return { verdict: "win", score: outcome };
    return { verdict: "neutral", score: outcome };
  }
  if (kind === "ctr_fix") {
    if (n(before.impressions) < 50 || n(after.impressions) < 50 || before.ctr == null || after.ctr == null) return { verdict: "insufficient", score: outcome };
    const rel = (after.ctr - before.ctr) / Math.max(before.ctr, 0.001);
    return { verdict: rel >= 0.15 ? "win" : rel <= -0.15 ? "loss" : "neutral", score: rel * 100 };
  }
  // update: vị trí cải thiện ≥ 2 bậc hoặc nhấp +20% → thắng
  if (n(before.impressions) < 30 && n(after.impressions) < 30) return { verdict: "insufficient", score: outcome };
  const posGain = before.position != null && after.position != null ? before.position - after.position : 0;
  const clickRel = (n(after.clicks) - n(before.clicks)) / Math.max(n(before.clicks), 1);
  if (posGain >= 2 || clickRel >= 0.2) return { verdict: "win", score: posGain * 5 + clickRel * 100 };
  if (posGain <= -2 || clickRel <= -0.2) return { verdict: "loss", score: posGain * 5 + clickRel * 100 };
  return { verdict: "neutral", score: posGain * 5 + clickRel * 100 };
}


export function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

