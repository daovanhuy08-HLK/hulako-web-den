// Cron 15 phút/lần: xuất bản bài đã lên lịch tới giờ (chạy lặp an toàn, không đăng trùng — T06) và chạy tiếp hàng đợi AI.
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { publishDue } from "@/lib/workflow";
import { drainQueue } from "@/lib/ai/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const published = await publishDue();
  const ran = await drainQueue(200_000);
  return NextResponse.json({ published, ran: ran.length });
}
