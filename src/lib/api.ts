// Chuẩn lỗi API (mục 09): code, message, fieldErrors, requestId. Không lộ stack trace.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

export function apiError(status: number, code: string, message: string, fieldErrors?: FieldErrors) {
  const requestId = randomUUID();
  if (status >= 500) console.error(`[${requestId}] ${code}: ${message}`);
  return NextResponse.json({ code, message, fieldErrors, requestId }, { status, headers: { "Cache-Control": "no-store" } });
}

export function zodFieldErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_";
    out[k] ??= issue.message;
  }
  return out;
}

/** Chặn POST từ trang khác (CSRF cơ bản): Origin phải trùng Host */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
