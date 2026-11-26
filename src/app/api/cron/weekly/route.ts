// Cron hằng tuần (04:00 sáng thứ Hai giờ VN): vòng phản hồi SEO đầy đủ.
//   gom từ khoá → AI đề xuất từ khoá → chấm điểm (có học từ chuyển đổi) → AI viết nháp top N → (đầu tháng) AI đề xuất nâng cấp hướng dẫn viết
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { enqueue, drainQueue, runJob } from "@/lib/ai/jobs";
import { aiConfigured } from "@/lib/ai/claude";
import { topOpenOpportunities } from "@/lib/seo/pipeline";
import { getSetting } from "@/lib/settings";
import { sendSeoReport } from "@/lib/seo/report";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7)}`;
}

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const agent = await getSetting("agent");
  if (agent.paused) return NextResponse.json({ paused: true });
  const week = isoWeek();
  const out: Record<string, unknown> = { week };

  // Bước không tốn AI: chạy ngay, tuần tự
  // Vòng học chạy TRƯỚC chấm điểm để điểm tuần này dùng trọng số mới nhất
  for (const type of ["learning_cycle", "harvest_keywords", "score_opportunities"] as const) {
    const { job, created } = await enqueue(type, {}, week, "cron");
    if (created) await runJob(job.id);
  }
  if (aiConfigured()) {
    if (agent.suggestKeywordsWeekly) await enqueue("suggest_keywords", {}, week, "cron");
    const top = (await topOpenOpportunities(agent.autoDraftsPerWeek)).filter((o) => o.score >= agent.minScoreForAutoDraft);
    for (const o of top) await enqueue("write_draft", { opportunityId: o.id }, `${o.id}`, "cron");
    out.autoDrafts = top.length;
    const now = new Date();
    if (agent.improvePromptMonthly && now.getUTCDate() <= 7) await enqueue("improve_prompt", {}, `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`, "cron");
  } else {
    out.ai = "Chưa cấu hình RUNNER_TOKEN — chỉ chạy phần không dùng AI";
  }
  out.ran = (await drainQueue(220_000)).length;
  out.report = await sendSeoReport("weekly", [
    `🗓 <b>Vòng SEO tuần ${week}</b>: đã học lại trọng số, gom & chấm điểm từ khoá${typeof out.autoDrafts === "number" ? `, giao AI viết ${out.autoDrafts} bản nháp mới` : ""}.`,
    "Bước cần AI do runner trên máy làm — xong bài nào bot sẽ báo bài đó.",
  ]).catch((e) => (e as Error).message);
  return NextResponse.json(out);
}
