import { NextResponse } from "next/server";
import { listProducts } from "@/lib/queries";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const data = await listProducts({
    category: u.searchParams.get("category") ?? undefined,
    useCase: u.searchParams.get("useCase") ?? undefined,
    page: Math.max(1, Number(u.searchParams.get("page")) || 1),
  });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
