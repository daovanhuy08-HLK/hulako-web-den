"use server";
// Server Actions cho trang "Vòng học AI" (/admin/seo/learning): khoá/mở trọng số, bật/tắt tự áp dụng, hoàn tác, chạy vòng học ngay.
import { revalidatePath } from "next/cache";
import { adminAction, str, UserError } from "@/lib/admin";
import { getSetting, setSetting, WEIGHT_KEYS } from "@/lib/settings";
import { revertWeights, runLearningCycle } from "@/lib/seo/learning";
import { audit } from "@/lib/audit";

export async function saveLearningConfig(fd: FormData) {
  return adminAction("settings.edit", async (u) => {
    const cur = await getSetting("scoringWeights");
    const next = { ...cur, autoApply: fd.get("autoApply") === "on", locked: fd.get("locked") === "on" };
    // Cho phép người quản trị đặt tay trọng số (trong biên 0.5–2)
    for (const k of WEIGHT_KEYS) {
      const v = Number(str(fd, k));
      if (str(fd, k) !== "") {
        if (!Number.isFinite(v) || v < 0.5 || v > 2) throw new UserError(`Trọng số "${k}" phải nằm trong 0.5–2`);
        next[k] = v;
      }
    }
    await setSetting("scoringWeights", next);
    await audit(u.id, "learning.config", "settings", "scoringWeights", { autoApply: next.autoApply, locked: next.locked });
    revalidatePath("/admin/seo/learning");
    return { ok: true, message: "Đã lưu cấu hình vòng học" };
  });
}

export async function revertLearning(fd: FormData) {
  return adminAction("settings.edit", async (u) => {
    const id = str(fd, "id");
    try { await revertWeights(id); } catch (e) { throw new UserError((e as Error).message); }
    await audit(u.id, "learning.revert", "learning_log", id);
    revalidatePath("/admin/seo/learning");
    return { ok: true, message: "Đã hoàn tác về trọng số trước đó" };
  });
}

export async function runLearningNow(_fd?: FormData) {
  return adminAction("seo.run_ai", async (u) => {
    const r = await runLearningCycle();
    await audit(u.id, "learning.run", "learning_log", null);
    revalidatePath("/admin/seo/learning");
    const w = r.weights as { skipped?: string; applied?: boolean };
    return { ok: true, message: `Đã đánh giá ${r.evaluated.evaluated} thí nghiệm. ${w.skipped ?? (w.applied ? "Đã cập nhật trọng số." : "Đã ghi đề xuất trọng số (đang khoá).")}` };
  });
}
