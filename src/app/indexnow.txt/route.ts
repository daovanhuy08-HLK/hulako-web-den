// Tệp khoá IndexNow (keyLocation = /indexnow.txt) — công cụ tìm kiếm tải tệp này để xác minh quyền sở hữu website
import { indexNowKey } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = await indexNowKey().catch(() => "");
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
