"use server";
// Server Actions cho trang "Agent SEO trên máy" (/admin/seo/agent): lưu cấu hình, ra lệnh chạy ngay, quản lý đối thủ.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { adminAction, lines, num, str, UserError } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { getDb, schema } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/settings";

const PAGE = "/admin/seo/agent";
const JOBS = ["trends", "research", "spy", "refresh", "plan", "report"] as const;
const hm = (v: string, label: string) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new UserError(`${label} phải theo dạng HH:MM (vd 07:30)`); return v; };

export async function saveSeoAgentConfig(fd: FormData) {
  return adminAction("settings.edit", async (u) => {
    const cur = await getSetting("seoAgent");
    const min = Math.round(num(fd, "proposalsMin", cur.proposalsMin)), max = Math.round(num(fd, "proposalsMax", cur.proposalsMax));
    if (min < 1 || max > 30 || min > max) throw new UserError("Số bài đề xuất: tối thiểu ≥ 1, tối đa ≤ 30, tối thiểu ≤ tối đa");
    const write = Math.round(num(fd, "autoWritePerDay", cur.autoWritePerDay));
    if (write < 0 || write > 20) throw new UserError("Số bản nháp AI tự viết mỗi ngày: 0–20");
    const next = {
      ...cur, enabled: fd.get("enabled") === "on",
      planTime: hm(str(fd, "planTime"), "Giờ gửi đề xuất"), reportTime: hm(str(fd, "reportTime"), "Giờ gửi báo cáo"),
      proposalsMin: min, proposalsMax: max, autoWritePerDay: write,
      trendsEveryHours: Math.min(24, Math.max(1, Math.round(num(fd, "trendsEveryHours", cur.trendsEveryHours)))),
      seeds: lines(fd, "seeds").slice(0, 20), regions: lines(fd, "regions").slice(0, 20), industry: str(fd, "industry").slice(0, 400) || cur.industry,
    };
    if (!next.seeds.length) throw new UserError("Nhập ít nhất 1 từ khoá gốc");
    await setSetting("seoAgent", next);
    await audit(u.id, "seo_agent.config", "settings", "seoAgent", { planTime: next.planTime, reportTime: next.reportTime, min, max, write });
    revalidatePath(PAGE);
    return { ok: true, message: "Đã lưu — agent trên máy nhận cấu hình mới trong vòng 1 phút" };
  });
}

export async function runSeoAgentJob(fd: FormData) {
  return adminAction("seo.run_ai", async (u) => {
    const job = str(fd, "job") as (typeof JOBS)[number];
    if (!JOBS.includes(job)) throw new UserError("Việc không hợp lệ");
    const cmds = await getSetting("seoAgentCommands");
    if (!cmds.pending.some((c) => c.job === job)) cmds.pending.push({ job, at: new Date().toISOString(), by: u.email });
    await setSetting("seoAgentCommands", { pending: cmds.pending.slice(-10) });
    await audit(u.id, "seo_agent.run", "settings", job);
    revalidatePath(PAGE);
    return { ok: true, message: "Đã gửi lệnh — agent trên máy sẽ chạy trong vòng 1 phút (máy phải đang bật)" };
  });
}

const cleanDomain = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

export async function addCompetitor(fd: FormData) {
  return adminAction("seo.run_ai", async (u) => {
    const domain = cleanDomain(str(fd, "domain"));
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new UserError("Nhập tên miền đối thủ, vd tenmien.vn");
    const db = await getDb();
    await db.insert(schema.competitors).values({ domain, name: str(fd, "name").slice(0, 80), status: "active", discoveredBy: "manual" })
      .onConflictDoUpdate({ target: schema.competitors.domain, set: { status: "active", name: str(fd, "name").slice(0, 80) || undefined } });
    await audit(u.id, "seo_agent.competitor_add", "competitor", domain);
    revalidatePath(PAGE);
    return { ok: true, message: `Đã theo dõi ${domain}. Lần quét đầu chỉ lưu mốc; từ lần sau agent báo trang mới/sửa.` };
  });
}

export async function setCompetitorStatus(fd: FormData) {
  return adminAction("seo.run_ai", async (u) => {
    const domain = cleanDomain(str(fd, "domain"));
    const status = str(fd, "status");
    if (!["active", "ignored"].includes(status)) throw new UserError("Trạng thái không hợp lệ");
    const db = await getDb();
    await db.update(schema.competitors).set({ status }).where(eq(schema.competitors.domain, domain));
    await audit(u.id, `seo_agent.competitor_${status}`, "competitor", domain);
    revalidatePath(PAGE);
    return { ok: true, message: status === "active" ? `Đã bật theo dõi ${domain}` : `Đã bỏ qua ${domain}` };
  });
}
