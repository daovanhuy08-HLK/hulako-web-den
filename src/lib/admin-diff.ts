// So sánh theo dòng (LCS) cho màn Lịch sử phiên bản (048). Đủ dùng cho bài vài trăm dòng.
export type DiffLine = { type: "same" | "add" | "del"; text: string };

export function diffLines(a: string, b: string, maxLines = 600): DiffLine[] {
  const x = a.split(/\r?\n/).slice(0, maxLines), y = b.split(/\r?\n/).slice(0, maxLines);
  const n = x.length, m = y.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ type: "same", text: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "del", text: x[i++] });
    else out.push({ type: "add", text: y[j++] });
  }
  while (i < n) out.push({ type: "del", text: x[i++] });
  while (j < m) out.push({ type: "add", text: y[j++] });
  return out;
}
