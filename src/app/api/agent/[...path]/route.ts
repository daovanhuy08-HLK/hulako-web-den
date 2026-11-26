// API cho SEO Agent chạy trên máy (tools/seo-agent.mjs). Xác thực: Bearer RUNNER_TOKEN (cùng token với runner viết bài).
// Token chỉ gọi được các tuyến dưới đây — không đọc/sửa dữ liệu khách hàng, không xuất bản bài.
//   GET  /api/agent/ping               → cấu hình + lệnh "chạy ngay" (agent hỏi mỗi phút)
//   GET  /api/agent/context            → cấu hình, DNA, từ khoá/bài đã có, số liệu Google, đối thủ, lệnh "chạy ngay"
//   POST /api/agent/status             { job, ok, note }           → ghi trạng thái
//   POST /api/agent/keywords           { items[], source }         → lưu từ khoá R&D / xu hướng
//   POST /api/agent/serp               { keyword, results[], decode } → lưu decode cấu trúc bài top
//   POST /api/agent/competitor-diff    { domain, urls[] }          → URL mới/sửa so với lần trước
//   POST /api/agent/competitor-pages   { domain, pages[] }         → lưu cấu trúc trang đối thủ
//   POST /api/agent/competitor-error   { domain, error }
//   POST /api/agent/insight            { kind, title, data, telegram? } → lưu phân tích (+ gửi Telegram)
//   POST /api/agent/plan               { proposals[], summary }    → kế hoạch bài/ngày + giao viết nháp + Telegram
//   POST /api/agent/report             {}                          → báo cáo thứ hạng & tối ưu qua Telegram
//   POST /api/agent/refresh            {}                          → gom + chấm điểm lại từ khoá (không dùng AI)
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/lib/api";
import {
  agentContext, agentHeartbeat, agentPoll, buildRankSection, createDailyPlan, diffCompetitorUrls, markCompetitorError,
  saveCompetitorPages, saveInsight, saveKeywords, saveSerp, type Proposal,
} from "@/lib/seo/agent";
import { buildSeoReport } from "@/lib/seo/report";
import { notifyAdmin } from "@/lib/notify";
import { enqueue, runJob } from "@/lib/ai/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request) {
  const want = process.env.RUNNER_TOKEN ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
const host = (req: Request) => (req.headers.get("x-agent-host") ?? "agent").slice(0, 80);
type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, { params }: Ctx) {
  if (!authorized(req)) return apiError(401, "unauthorized", "Sai token");
  const p = (await params).path.join("/");
  await agentHeartbeat(host(req));
  if (p === "ping") return NextResponse.json(await agentPoll());
  if (p === "context") return NextResponse.json(await agentContext());
  return apiError(404, "not_found", "Không có tuyến này");
}

export async function POST(req: Request, { params }: Ctx) {
  if (!authorized(req)) return apiError(401, "unauthorized", "Sai token");
  const p = (await params).path.join("/");
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => String(b[k] ?? "");
  try {
    switch (p) {
      case "status":
        await agentHeartbeat(host(req), { name: s("job"), ok: b.ok !== false, note: s("note") });
        return NextResponse.json({ ok: true });
      case "keywords":
        await agentHeartbeat(host(req));
        return NextResponse.json(await saveKeywords(Array.isArray(b.items) ? b.items : [], s("source") || "agent_research"));
      case "serp":
        return NextResponse.json(await saveSerp({ keyword: s("keyword"), results: Array.isArray(b.results) ? b.results : [], decode: (b.decode as Record<string, unknown>) ?? {} }));
      case "competitor-diff":
        return NextResponse.json(await diffCompetitorUrls(s("domain"), Array.isArray(b.urls) ? b.urls : []));
      case "competitor-pages":
        return NextResponse.json(await saveCompetitorPages(s("domain"), Array.isArray(b.pages) ? b.pages : []));
      case "competitor-error":
        await markCompetitorError(s("domain"), s("error"));
        return NextResponse.json({ ok: true });
      case "insight":
        return NextResponse.json(await saveInsight(s("kind") || "research", s("title") || "Phân tích", (b.data as Record<string, unknown>) ?? {}, b.telegram ? s("telegram") : undefined));
      case "plan":
        return NextResponse.json(await createDailyPlan(Array.isArray(b.proposals) ? (b.proposals as Proposal[]) : [], s("summary")));
      case "report": {
        const text = await buildSeoReport("daily", [await buildRankSection(), ...(b.extra ? [s("extra")] : [])]);
        const sent = await notifyAdmin("seoReport", text);
        if (sent === "sent") await saveInsight("rank", "Báo cáo thứ hạng & tối ưu", { length: text.length });
        return NextResponse.json({ ok: sent === "sent", sent });
      }
      case "refresh": {
        const day = new Date().toISOString().slice(0, 10);
        const out: Record<string, unknown> = {};
        for (const type of ["harvest_keywords", "score_opportunities"] as const) {
          const { job, created } = await enqueue(type, {}, `agent:${day}`, "agent");
          out[type] = created ? (await runJob(job.id))?.status ?? "failed" : "đã chạy hôm nay";
        }
        return NextResponse.json(out);
      }
    }
  } catch (e) {
    return apiError(500, "agent_error", (e as Error).message.slice(0, 300));
  }
  return apiError(404, "not_found", "Không có tuyến này");
}
