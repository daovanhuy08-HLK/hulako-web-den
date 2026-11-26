// Cron hằng ngày (03:00 giờ VN): thu Search Console, dọn dữ liệu quá hạn, gửi lại thông báo lỗi, chạy hàng đợi.
import { NextResponse } from "next/server";
import { cronAuthorized, purgeExpiredPersonalData } from "@/lib/cron";
import { enqueue, drainQueue } from "@/lib/ai/jobs";
import { gscConfigured } from "@/lib/seo/gsc";
import { retryFailedNotifications } from "@/lib/notify";
import { getSetting } from "@/lib/settings";
import { indexMaintenance } from "@/lib/indexing";
import { sendSeoReport } from "@/lib/seo/report";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const today = new Date().toISOString().slice(0, 10);
  const agent = await getSetting("agent");
  const out: Record<string, unknown> = {};
  out.purged = await purgeExpiredPersonalData();
  out.notificationsRetried = await retryFailedNotifications();
  // Hỗ trợ index: gửi lại bài chưa được index, kiểm tra trạng thái trên Google (không chặn phần còn lại nếu lỗi)
  out.indexing = await indexMaintenance({ deadline: Date.now() + 50_000 }).catch((e) => ({ error: (e as Error).message }));
  if (!agent.paused) {
    // Thiếu cấu hình vẫn tạo tác vụ để lỗi "chưa cấu hình" hiện rõ ở A09
    out.gsc = (await enqueue("collect_gsc", { days: 3 }, `daily:${today}`, "cron")).created ? "queued" : "exists";
    if (!gscConfigured()) out.gscNote = "Search Console chưa cấu hình";
    out.ran = (await drainQueue(220_000)).length;
  }
  // Báo cáo AI SEO qua Telegram (im lặng). Thứ Hai (giờ VN) bỏ qua vì đã có báo cáo tuần sau vòng SEO hằng tuần.
  const vnDay = new Date(Date.now() + 7 * 3600_000).getUTCDay();
  // Agent SEO trên máy còn chạy (liên lạc trong 3 giờ) thì nó tự gửi báo cáo theo giờ đã hẹn → cron không gửi trùng
  const agentSt = await getSetting("seoAgentStatus");
  const agentAlive = agentSt.lastSeen && Date.now() - new Date(agentSt.lastSeen).getTime() < 3 * 3600_000;
  if (vnDay !== 1 && !agentAlive) out.report = await sendSeoReport("daily").catch((e) => (e as Error).message);
  return NextResponse.json(out);
}
