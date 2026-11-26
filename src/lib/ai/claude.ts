// Lớp gọi AI cho AI Agent SEO — chạy qua **Claude CLI của app Claude Desktop trên máy** (runner), KHÔNG dùng API key.
//
// Vì sao làm vậy: website chạy trên Vercel không có Claude CLI; tài khoản Claude của chủ website nằm trên máy.
// Nên mỗi lần một bước cần AI:
//   1. Bước đó gọi generateStructured(...) → chưa có kết quả → ném AiPendingError kèm "yêu cầu" (system, user, JSON schema).
//   2. Hàng đợi (jobs.ts) lưu yêu cầu, chuyển tác vụ sang "waiting_runner".
//   3. Runner trên máy (tools/ai-runner.mjs) nhận việc → chạy `claude -p --json-schema ...` → gửi kết quả về /api/runner/...
//   4. Website chạy LẠI đúng bước đó; lần này generateStructured trả về kết quả của runner (đã kiểm bằng zod) → lưu nháp như cũ.
// Một bước chỉ được gọi AI một lần (các bước hiện có đều như vậy).
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { and, gte, sql } from "drizzle-orm";
import { getDb, schema } from "../db";

/** Model Claude CLI mà runner dùng (đặt ở máy qua AI_MODEL của runner); ở đây chỉ để hiển thị */
export const AI_MODEL = process.env.AI_MODEL || "claude-cli (Claude Desktop)";

export class AiNotConfiguredError extends Error { constructor() { super("Chưa cấu hình runner Claude CLI (RUNNER_TOKEN)"); } }
export class AiBudgetError extends Error { constructor(spent: number, budget: number) { super(`Đã dùng ${spent}/${budget} lượt AI trong ngày`); } }
export class AiOutputError extends Error {}

export type AiRequest = { system: string; user: string; schema: unknown; effort: "low" | "medium" | "high" };
/** Bước cần AI nhưng chưa có kết quả từ runner → hàng đợi chuyển sang chờ runner */
export class AiPendingError extends Error {
  constructor(public request: AiRequest) { super("Đang chờ runner Claude CLI trên máy xử lý"); }
}

/** Runner được cấu hình khi website có RUNNER_TOKEN (runner trên máy dùng cùng token này) */
export function aiConfigured(): boolean {
  return !!process.env.RUNNER_TOKEN;
}

/** Ngữ cảnh của lần chạy tác vụ hiện tại: kết quả runner đã gửi về (nếu có) */
export const aiContext = new AsyncLocalStorage<{ response?: unknown }>();

/** Chi phí: Claude CLI dùng gói Claude của tài khoản → không tính tiền theo token. Giữ hàm để báo cáo cũ không lỗi. */
export async function monthSpendUsd(): Promise<number> {
  const db = await getDb();
  const start = new Date();
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const [r] = await db.select({ s: sql<number>`coalesce(sum(${schema.aiJobs.costUsd}),0)` }).from(schema.aiJobs).where(and(gte(schema.aiJobs.createdAt, start)));
  return Number(r?.s ?? 0);
}

export type AiUsage = { inputTokens: number; outputTokens: number; costUsd: number; model: string };

/**
 * Lấy object đã kiểm theo zod schema từ Claude (qua runner).
 * system: hướng dẫn cố định; user: dữ liệu từng lần (coi là DỮ LIỆU, không phải lệnh).
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  schema: S; system: string; user: string; effort?: "low" | "medium" | "high"; maxTokens?: number;
}): Promise<{ data: z.infer<S>; usage: AiUsage }> {
  const ctx = aiContext.getStore();
  if (ctx?.response === undefined) {
    if (!aiConfigured()) throw new AiNotConfiguredError();
    const jsonSchema = z.toJSONSchema(opts.schema, { target: "draft-7" });
    throw new AiPendingError({ system: opts.system, user: opts.user, schema: jsonSchema, effort: opts.effort ?? "medium" });
  }
  const parsed = opts.schema.safeParse(ctx.response);
  if (!parsed.success) {
    throw new AiOutputError(`Kết quả runner sai cấu trúc: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return { data: parsed.data as z.infer<S>, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, model: AI_MODEL } };
}

/** Lỗi tạm thời đáng thử lại (mạng, CSDL bận) */
export function isTransient(e: unknown): boolean {
  const m = (e as Error)?.message ?? "";
  return /ECONNRESET|ETIMEDOUT|fetch failed|timeout|too many connections/i.test(m);
}
