import { NextResponse } from "next/server";
import { search, type SearchType } from "@/lib/search";
import { apiError } from "@/lib/api";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").slice(0, 120);
  const type = u.searchParams.get("type") as SearchType | null;
  if (type && !["article", "product", "setup"].includes(type)) {
    return apiError(422, "invalid_type", "type không hợp lệ", { type: "article | product | setup" });
  }
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const data = await search(q, type ?? undefined, page);
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
