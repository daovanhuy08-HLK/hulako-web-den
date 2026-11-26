// API cho runner Claude CLI chạy trên máy chủ website (tools/ai-runner.mjs). Xác thực: Bearer RUNNER_TOKEN.
// Token này CHỈ gọi được các tuyến dưới đây — không đọc/sửa được dữ liệu khác.
//   GET  /api/runner/ping                 → kiểm tra kết nối, số việc đang chờ
//   POST /api/runner/claim                → nhận 1 việc (204 nếu hết việc)
//   POST /api/runner/jobs/{id}/complete   → gửi kết quả { output, model }
//   POST /api/runner/jobs/{id}/fail       → báo lỗi { error }
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/lib/api";
import { claimForRunner, completeFromRunner, failFromRunner, runnerQueueCount } from "@/lib/ai/jobs";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // chạy lại bước để lưu bản nháp sau khi nhận kết quả

function authorized(req: Request) {
  const want = process.env.RUNNER_TOKEN ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function heartbeat(req: Request) {
  const name = (req.headers.get("x-runner-name") ?? "runner").slice(0, 80);
  await setSetting("runnerStatus", { name, lastSeen: new Date().toISOString() }).catch(() => null);
  return name;
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, { params }: Ctx) {
  if (!authorized(req)) return apiError(401, "unauthorized", "Sai runner token");
  const { path } = await params;
  if (path.join("/") !== "ping") return apiError(404, "not_found", "Không có tuyến này");
  await heartbeat(req);
  return NextResponse.json({ ok: true, waiting: await runnerQueueCount() });
}

export async function POST(req: Request, { params }: Ctx) {
  if (!authorized(req)) return apiError(401, "unauthorized", "Sai runner token");
  const { path } = await params;
  const name = await heartbeat(req);
  if (path.length === 1 && path[0] === "claim") {
    const job = await claimForRunner(name);
    return job ? NextResponse.json(job) : new NextResponse(null, { status: 204 });
  }
  if (path.length === 3 && path[0] === "jobs") {
    const [, id, action] = path;
    if (!/^[0-9a-f-]{36}$/.test(id)) return apiError(422, "bad_id", "Mã tác vụ không hợp lệ");
    const body = await req.json().catch(() => null) as { output?: unknown; model?: string; error?: string } | null;
    if (action === "complete") {
      if (!body || body.output === undefined) return apiError(422, "no_output", "Thiếu output");
      const r = await completeFromRunner(id, body.output, String(body.model ?? "claude-cli"));
      if (!r.ok) return apiError(409, "not_completed", r.error ?? "Kết quả không lưu được", undefined);
      return NextResponse.json({ ok: true, status: r.status, summary: JSON.stringify(r.result ?? {}).slice(0, 200) });
    }
    if (action === "fail") {
      await failFromRunner(id, String(body?.error ?? "Lỗi không rõ"));
      return NextResponse.json({ ok: true });
    }
  }
  return apiError(404, "not_found", "Không có tuyến này");
}
