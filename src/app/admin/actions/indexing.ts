"use server";
// Server Actions cho trang "Index bài viết" (/admin/seo/indexing): gửi lại index, kiểm tra trạng thái Google, chạy bảo trì ngay.
import { revalidatePath } from "next/cache";
import { adminAction, str, UserError } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { gscConfigured } from "@/lib/seo/gsc";
import { indexMaintenance, inspectAndStore, submitPaths } from "@/lib/indexing";

const PAGE = "/admin/seo/indexing";
const validPath = (p: string) => /^\/(kien-thuc|tin-tuc)\/[a-z0-9-]+$/.test(p);

export async function resubmitIndex(fd: FormData) {
  return adminAction("seo.run_ai", async (u) => {
    const path = str(fd, "path");
    if (!validPath(path)) throw new UserError("Đường dẫn bài viết không hợp lệ");
    const r = await submitPaths([path]);
    await audit(u.id, "index.resubmit", "url", path, { note: r.note });
    revalidatePath(PAGE);
    return { ok: r.indexNow.ok || r.google.ok, message: r.note };
  });
}

export async function inspectIndex(fd: FormData) {
  return adminAction("seo.run_ai", async () => {
    const path = str(fd, "path");
    if (!validPath(path)) throw new UserError("Đường dẫn bài viết không hợp lệ");
    if (!gscConfigured()) throw new UserError("Chưa kết nối Search Console (GSC_SITE_URL, GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY)");
    try {
      const r = await inspectAndStore(path);
      revalidatePath(PAGE);
      return { ok: true, message: r?.indexed ? "Google đã index bài này" : `Google chưa index: ${r?.coverage || r?.verdict}` };
    } catch (e) {
      throw new UserError((e as Error).message);
    }
  });
}

export async function runIndexNow(_fd?: FormData) {
  return adminAction("seo.run_ai", async (u) => {
    const r = await indexMaintenance({ deadline: Date.now() + 40_000, inspectLimit: 25 });
    await audit(u.id, "index.maintenance", "url", null, r);
    revalidatePath(PAGE);
    return { ok: true, message: `Theo dõi ${r.tracked} bài · gửi lại ${r.resubmitted} · kiểm tra ${r.inspected} (mới index ${r.newlyIndexed})${r.note ? ` — ${r.note}` : ""}` };
  });
}
