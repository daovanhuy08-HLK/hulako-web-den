// Màn 034 Kết nối nguồn dữ liệu SEO: trạng thái Search Console / xu hướng / CSV / khoá AI.
// Bí mật (khoá, private key) chỉ nằm ở biến môi trường máy chủ — trang này chỉ cho biết đã/chưa cấu hình, không hiện giá trị.
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { getDb, schema } from "@/lib/db";
import { aiConfigured, AI_MODEL, monthSpendUsd } from "@/lib/ai/claude";
import { gscConfigured } from "@/lib/seo/gsc";
import { latestGscDate } from "@/lib/seo/metrics";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton } from "@/components/admin/ActionForm";
import { SeoNav } from "@/components/admin/SeoNav";
import { Badge, IconBox, PageTitle, Panel, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { testGscConnection } from "../../../actions/extra";

export const metadata = { title: "Kết nối nguồn dữ liệu" };

export default async function Sources({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("seo.view");
  const tab = (await searchParams).tab ?? "gsc";
  const db = await getDb();
  const [latest, spend, [lastCollect], [{ csv }]] = await Promise.all([
    latestGscDate().catch(() => null), monthSpendUsd(),
    db.select().from(schema.aiJobs).where(eq(schema.aiJobs.type, "collect_gsc")).orderBy(desc(schema.aiJobs.createdAt)).limit(1),
    db.select({ csv: sql<number>`count(*)::int` }).from(schema.keywords).where(eq(schema.keywords.source, "csv")),
  ]);
  const gsc = gscConfigured();
  const site = process.env.GSC_SITE_URL ?? "";
  const Env = ({ name, ok }: { name: string; ok: boolean }) => (
    <li className="flex items-center justify-between gap-3 border-t border-[#EFECE8] py-2.5 first:border-0"><code className="text-sm">{name}</code><Badge status={ok ? "configured" : "not_configured"} label={ok ? "Đã đặt" : "Chưa đặt"} /></li>
  );

  return (
    <>
      <PageTitle title="Kết nối nguồn dữ liệu" />
      <SeoNav current="/admin/seo/sources" />
      <Tabs variant="pill" base="/admin/seo/sources" current={tab} tabs={[{ key: "gsc", label: "Search Console", icon: "trending" }, { key: "trend", label: "Xu hướng", icon: "bars" }, { key: "ai", label: "Khoá AI", icon: "sparkles" }, { key: "csv", label: "Nhập CSV", icon: "csv" }]} />
      {tab === "gsc" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFECE8] pb-5">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F1ED] text-2xl font-black text-[#4285F4]">G</span>
                <div><p className="text-2xl font-bold">Google Search Console</p><span className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${gsc ? "bg-[#E7F6EC] text-[#1E7B3C]" : "bg-[#EFEDEA] text-ink-soft"}`}><span className={`h-2 w-2 rounded-full ${gsc ? "bg-[#1E7B3C]" : "bg-ink-muted"}`} /> {gsc ? "Đã cấu hình" : "Chưa kết nối"}</span></div>
              </div>
              <ActionButton action={testGscConnection} label="Kiểm tra kết nối" icon="link" className="btn-primary" />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div><p className="mb-1.5 font-semibold">Website đã xác minh</p><p className="input flex items-center bg-[#FBFAF8] text-ink-soft">{site || "Chưa đặt GSC_SITE_URL"}</p></div>
              <div><p className="mb-1.5 font-semibold">Phạm vi dữ liệu</p><p className="input flex items-center bg-[#FBFAF8] text-ink-soft">Hiệu suất tìm kiếm (ngày × truy vấn × trang)</p></div>
            </div>
            <h3 className="mb-2 mt-6 font-bold">Cách kết nối (người quản trị máy chủ làm một lần)</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-[15px] text-ink-soft">
              <li>Tạo service account trên Google Cloud, bật Search Console API, tải khoá JSON.</li>
              <li>Trong Search Console → Cài đặt → Người dùng: thêm email service account (quyền Đầy đủ để gửi sitemap, hoặc Hạn chế để chỉ đọc số liệu).</li>
              <li>Đặt biến môi trường trên máy chủ: <code>GSC_SITE_URL</code>, <code>GSC_CLIENT_EMAIL</code>, <code>GSC_PRIVATE_KEY</code> rồi triển khai lại.</li>
              <li>Bấm “Kiểm tra kết nối”, sau đó chạy “Thu Search Console” ở trang AI SEO.</li>
            </ol>
            <ul className="mt-4 rounded-card border border-line px-4 py-1"><Env name="GSC_SITE_URL" ok={!!process.env.GSC_SITE_URL} /><Env name="GSC_CLIENT_EMAIL" ok={!!process.env.GSC_CLIENT_EMAIL} /><Env name="GSC_PRIVATE_KEY" ok={!!process.env.GSC_PRIVATE_KEY} /></ul>
          </Panel>
          <Panel>
            <div className="flex items-start gap-4 border-b border-[#EFECE8] pb-5"><IconBox icon="refresh" size="lg" /><div><p className="text-lg font-bold">Trạng thái đồng bộ</p><p className="text-ink-muted">{lastCollect ? <><Badge status={lastCollect.status} /> {lastCollect.error ? <span className="mt-1 block text-sm text-[#B42318]">{lastCollect.error}</span> : null}</> : "Chưa có dữ liệu"}</p></div></div>
            <div className="flex items-start gap-4 border-b border-[#EFECE8] py-5"><IconBox icon="calendar" size="lg" /><div><p className="text-lg font-bold">Lần cập nhật</p><p className="text-ink-muted">{latest ? `Số liệu tới ngày ${latest}` : "—"}{lastCollect?.finishedAt ? ` · chạy lúc ${formatDateTimeVN(lastCollect.finishedAt)}` : ""}</p></div></div>
            <Link href="/admin/seo?tab=jobs" className="btn-outline mt-5 w-full"><Icon name="refresh" /> Xem tác vụ thu số liệu</Link>
          </Panel>
        </div>
      )}
      {tab === "trend" && (
        <Panel title="Nguồn xu hướng">
          <p className="text-ink-soft">Chưa cấu hình nguồn xu hướng hợp lệ. Điểm xu hướng được lưu riêng với lượng tìm kiếm (cột <code>trend_score</code>) và hiện “Chưa có dữ liệu” khi thiếu.</p>
          <p className="mt-3 text-ink-soft">Hiện có thể đưa điểm xu hướng vào bằng tệp CSV (cột <code>trend_score</code>) hoặc nhập tay ở trang Từ khoá. Nguồn tự động (API xu hướng có giấy phép) cần được duyệt rồi nối vào backend.</p>
          <Link href="/admin/seo/import" className="btn-primary mt-4"><Icon name="upload" /> Nhập CSV có điểm xu hướng</Link>
        </Panel>
      )}
      {tab === "ai" && (
        <Panel title="AI nội dung — Claude CLI của Claude Desktop (runner trên máy)">
          <ul className="rounded-card border border-line px-4 py-1"><Env name="RUNNER_TOKEN" ok={aiConfigured()} /></ul>
          <RunnerInfo />
          <p className="mt-4 text-ink-soft">Không dùng API key. Website xếp tác vụ AI vào hàng chờ; runner chạy ngầm trên máy (<code>npm run ai:start</code> trong thư mục <code>hulako-web-den</code>) nhận việc, gọi Claude CLI bằng tài khoản Claude Desktop đã đăng nhập rồi gửi kết quả về. Model đặt ở máy (<code>AI_MODEL</code> trong <code>.env.runner</code>, mặc định sonnet). Máy tắt → tác vụ nằm chờ, bật lại runner tự làm tiếp.</p>
          <p className="mt-2 text-sm text-ink-muted">Mã runner chỉ đặt bằng biến môi trường trên máy chủ và trong file .env.runner trên máy, không nhập qua trang quản trị.</p>
        </Panel>
      )}
      {tab === "csv" && (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4"><IconBox icon="csv" size="lg" /><div><p className="text-2xl font-bold">Nhập danh sách từ khóa</p><p className="text-ink-muted">Đã nhập {csv} từ khoá từ CSV</p></div></div>
            <Link href="/admin/seo/import" className="btn-primary"><Icon name="upload" /> Chọn tệp CSV</Link>
          </div>
        </Panel>
      )}
    </>
  );
}

/** Trạng thái runner: lần cuối liên lạc + số việc đang chờ */
async function RunnerInfo() {
  const [st, waiting] = await Promise.all([
    import("@/lib/settings").then((m) => m.getSetting("runnerStatus")),
    import("@/lib/ai/jobs").then((m) => m.runnerQueueCount()),
  ]);
  const last = st.lastSeen ? new Date(st.lastSeen) : null;
  const online = !!last && Date.now() - last.getTime() < 10 * 60_000;
  return (
    <p className={`mt-4 rounded-xl px-4 py-3 ${online ? "bg-[#E7F6EC] text-[#14532D]" : "bg-brand-tint text-ink-soft"}`}>
      {last ? `Runner ${st.name}: ${online ? "đang hoạt động" : "chưa liên lạc gần đây"} · lần cuối ${last.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : "Runner chưa từng kết nối."} · {waiting} tác vụ đang chờ runner
    </p>
  );
}
