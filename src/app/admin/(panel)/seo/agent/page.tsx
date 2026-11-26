// Agent SEO trên máy — điều khiển & xem kết quả của tools/seo-agent.mjs (chạy 24/7 bằng pm2 trên máy chủ website):
// trạng thái, cấu hình giờ Telegram/số bài, R&D từ khoá 7 nhóm, decode bài top, spy đối thủ, kế hoạch hằng ngày.
import Link from "next/link";
import { desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { KEYWORD_KINDS } from "@/lib/seo/agent";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { Field, Notice, PageTitle, Panel, StatCard, Table, Toggle } from "@/components/admin/ui";
import { addCompetitor, runSeoAgentJob, saveSeoAgentConfig, setCompetitorStatus } from "../../../actions/seo-agent";

export const metadata = { title: "Agent SEO trên máy" };
export const dynamic = "force-dynamic";

const JOB_LABEL: Record<string, string> = {
  trends: "Xu hướng 24–72h", research: "R&D từ khoá 7 nhóm", spy: "Spy đối thủ", refresh: "Chấm điểm lại từ khoá",
  plan: "Kế hoạch bài hôm nay", report: "Báo cáo thứ hạng",
};
const INSIGHT_LABEL: Record<string, string> = { plan: "Kế hoạch", spy: "Spy đối thủ", trend: "Xu hướng", rank: "Báo cáo", research: "R&D" };

export default async function SeoAgentPage({ searchParams }: { searchParams: Promise<{ nhom?: string }> }) {
  const u = await requireUser("seo.view");
  const { nhom } = await searchParams;
  const kind = nhom && nhom in KEYWORD_KINDS ? nhom : "sieu-rong";
  const db = await getDb();
  const [cfg, st, cmds, kindCounts, kws, comps, pages, insights, serps] = await Promise.all([
    getSetting("seoAgent"), getSetting("seoAgentStatus"), getSetting("seoAgentCommands"),
    db.select({ kind: schema.keywords.kind, n: sql<number>`count(*)::int` }).from(schema.keywords).where(ne(schema.keywords.kind, "")).groupBy(schema.keywords.kind),
    db.select().from(schema.keywords).where(eq(schema.keywords.kind, kind)).orderBy(desc(schema.keywords.createdAt)).limit(40),
    db.select().from(schema.competitors).where(inArray(schema.competitors.status, ["active", "suggested"])).orderBy(desc(schema.competitors.status), desc(schema.competitors.seenInSerp)).limit(40),
    db.select({ p: schema.competitorPages, domain: schema.competitors.domain }).from(schema.competitorPages)
      .innerJoin(schema.competitors, eq(schema.competitors.id, schema.competitorPages.competitorId))
      .where(inArray(schema.competitorPages.state, ["new", "updated"])).orderBy(desc(schema.competitorPages.changedAt)).limit(15),
    db.select().from(schema.agentInsights).where(gte(schema.agentInsights.createdAt, new Date(Date.now() - 14 * 86400_000))).orderBy(desc(schema.agentInsights.createdAt)).limit(20),
    db.select().from(schema.serpSnapshots).orderBy(desc(schema.serpSnapshots.createdAt)).limit(12),
  ]);
  const counts = Object.fromEntries(kindCounts.map((k) => [k.kind, Number(k.n)]));
  const ageMin = st.lastSeen ? Math.round((Date.now() - new Date(st.lastSeen).getTime()) / 60000) : null;
  const online = ageMin != null && ageMin < 5;
  const editable = can(u.roles, "settings.edit");
  const run = can(u.roles, "seo.run_ai");
  const latestPlan = insights.find((i) => i.kind === "plan");

  return (
    <div>
      <PageTitle title="Agent SEO trên máy" back="/admin/seo"
        tag={<span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${online ? "bg-[#E7F6EC] text-[#1E7B3C]" : "bg-[#FDECEC] text-[#B42318]"}`}><span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-[#1E7B3C]" : "bg-[#B42318]"}`} />{online ? "Đang chạy" : ageMin == null ? "Chưa kết nối" : `Mất liên lạc ${ageMin < 120 ? `${ageMin} phút` : `${Math.round(ageMin / 60)} giờ`}`}</span>}
        subtitle="Chạy 24/7 trên máy tính bằng Claude của Claude Desktop (có tìm kiếm web). Kết quả về đây và báo Telegram theo giờ hẹn." />

      <Notice tone="info" title="Agent làm gì và giới hạn">
        R&D từ khoá 7 nhóm · xu hướng 24–72h · đề xuất {cfg.proposalsMin}–{cfg.proposalsMax} bài/ngày · decode cấu trúc bài top rồi AI viết <b>bản nháp nội dung mới</b> ({cfg.autoWritePerDay} bài/ngày) · báo cáo thứ hạng · spy đối thủ.
        Bài <b>không tự đăng</b> — bạn duyệt rồi mới lên web (Google phạt nội dung AI hàng loạt không kiểm duyệt). Thứ hạng chuẩn lấy từ Search Console; vị trí agent thấy khi tìm web chỉ để tham khảo. Không công cụ nào cam kết được “top Google”.
      </Notice>

      {!online && (
        <Notice tone="warn" title="Agent trên máy chưa chạy">
          Máy tính phải bật. Kiểm tra trong PowerShell tại thư mục <code>hulako-web-den</code>: <code>npm run agent:logs</code> · bật lại: <code>npm run agent:start</code>.
          {cmds.pending.length > 0 && <> Đang có {cmds.pending.length} lệnh chờ agent nhận.</>}
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="search" label="Từ khoá agent đã R&D" value={Object.values(counts).reduce((a, b) => a + b, 0)} hint={`${counts.trend ?? 0} xu hướng · ${counts["sieu-rong"] ?? 0} siêu rộng`} />
        <StatCard icon="file" label="Kế hoạch gần nhất" value={latestPlan ? latestPlan.title : "—"} hint={latestPlan ? formatDateTimeVN(latestPlan.createdAt) : `Gửi lúc ${cfg.planTime} mỗi ngày`} />
        <StatCard icon="eye" label="Đối thủ đang theo dõi" value={comps.filter((c) => c.status === "active").length} hint={`${comps.filter((c) => c.status === "suggested").length} gợi ý chờ duyệt`} />
        <StatCard icon="trending" label="Từ khoá đã decode" value={serps.length ? `${serps.length}+` : 0} hint="Cấu trúc bài top, không chép nội dung" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Việc của agent" icon="refresh">
          <Table head={["Việc", "Lần chạy cuối", "Kết quả", ""]}>
            {Object.entries(JOB_LABEL).map(([k, label]) => {
              const j = st.jobs[k];
              return (
                <tr key={k}>
                  <td className="font-semibold">{label}<p className="text-xs font-normal text-ink-muted">{k === "plan" ? `mỗi ngày ${cfg.planTime}` : k === "report" ? `mỗi ngày ${cfg.reportTime}` : k === "trends" ? `mỗi ${cfg.trendsEveryHours} giờ` : k === "research" ? "mỗi ngày 01:30" : k === "spy" ? "mỗi ngày 02:30" : "mỗi ngày 06:00"}</p></td>
                  <td className="text-sm">{j ? formatDateTimeVN(new Date(j.at)) : <span className="text-ink-muted">Chưa chạy</span>}</td>
                  <td className="max-w-[300px] text-sm">{j ? <span className={j.ok ? "" : "text-[#B42318]"}>{j.ok ? "✓ " : "✗ "}{j.note}</span> : "—"}</td>
                  <td>{run && <ActionButton action={runSeoAgentJob} fields={{ job: k }} label="Chạy ngay" className="btn-line btn-sm" />}</td>
                </tr>
              );
            })}
          </Table>
        </Panel>

        <Panel title="Cấu hình" icon="sliders">
          <ActionForm action={saveSeoAgentConfig} submitLabel="Lưu cấu hình" buttons={editable ? undefined : <span className="text-sm text-ink-muted">Chỉ quản trị hệ thống được sửa.</span>}>
            <Toggle name="enabled" defaultChecked={cfg.enabled} label={<b>Bật lịch tự động của agent</b>} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Giờ gửi đề xuất (Telegram)" name="planTime" type="time" defaultValue={cfg.planTime} />
              <Field label="Giờ gửi báo cáo thứ hạng" name="reportTime" type="time" defaultValue={cfg.reportTime} />
              <Field label="Đề xuất tối thiểu/ngày" name="proposalsMin" type="number" defaultValue={cfg.proposalsMin} />
              <Field label="Đề xuất tối đa/ngày" name="proposalsMax" type="number" defaultValue={cfg.proposalsMax} />
              <Field label="AI tự viết nháp/ngày" name="autoWritePerDay" type="number" defaultValue={cfg.autoWritePerDay} hint="Mỗi bài ≈ 3 lượt Claude (tìm + decode + viết)" />
              <Field label="Quét xu hướng mỗi (giờ)" name="trendsEveryHours" type="number" defaultValue={cfg.trendsEveryHours} />
            </div>
            <div className="mt-3 grid gap-3">
              <Field label="Từ khoá gốc (mỗi dòng 1)" name="seeds" rows={4} defaultValue={cfg.seeds.join("\n")} />
              <Field label="Khu vực cho từ khoá địa lý (mỗi dòng 1)" name="regions" rows={3} defaultValue={cfg.regions.join("\n")} />
              <Field label="Mô tả ngành" name="industry" rows={2} defaultValue={cfg.industry} />
            </div>
          </ActionForm>
        </Panel>
      </div>

      <Panel title="Từ khoá R&D theo nhóm" icon="search" className="mt-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(KEYWORD_KINDS).map(([k, label]) => (
            <Link key={k} href={`/admin/seo/agent?nhom=${k}`} className={`chip ${k === kind ? "chip-active" : ""}`}>{label.split(" (")[0]} ({counts[k] ?? 0})</Link>
          ))}
        </div>
        <p className="mb-3 text-sm text-ink-muted">{KEYWORD_KINDS[kind as keyof typeof KEYWORD_KINDS]}</p>
        <Table head={["Từ khoá", "Vì sao ra khách", "Nguồn", "Hạng Google", "Trạng thái"]} empty={!kws.length} emptyText="Chưa có — agent R&D lúc 01:30 mỗi ngày, hoặc bấm “Chạy ngay”.">
          {kws.map((k) => (
            <tr key={k.id}>
              <td className="font-semibold">{k.query}{k.trendScore != null && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-dark">🔥 {Math.round(k.trendScore)}</span>}</td>
              <td className="max-w-[420px] text-sm text-ink-soft">{k.note || "—"}</td>
              <td className="text-xs text-ink-muted">{k.source.replace("agent_", "agent · ")}</td>
              <td className="text-sm">{k.position != null ? k.position.toFixed(1) : "—"}</td>
              <td className="text-sm">{k.status === "in_opportunity" ? "Đã có bài" : k.status === "skipped" ? "Bỏ qua" : "Chưa viết"}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Đối thủ" icon="eye">
          {run && (
            <ActionForm action={addCompetitor} submitLabel="Theo dõi" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Tên miền đối thủ" name="domain" placeholder="tenmien.vn" /><Field label="Tên (tuỳ chọn)" name="name" /></div>
            </ActionForm>
          )}
          <Table className="mt-4" head={["Tên miền", "Trạng thái", "Trang", ""]} empty={!comps.length} emptyText="Chưa có. Agent tự gợi ý đối thủ khi decode kết quả tìm kiếm.">
            {comps.map((c) => (
              <tr key={c.id}>
                <td><span className="font-semibold">{c.domain}</span>{c.name && <span className="text-ink-muted"> · {c.name}</span>}
                  <p className="text-xs text-ink-muted">{c.discoveredBy === "agent" ? `Agent thấy ${c.seenInSerp} lần trong top tìm kiếm` : "Bạn thêm"}{c.lastError ? ` · lỗi: ${c.lastError}` : ""}</p></td>
                <td className="text-sm">{c.status === "active" ? "Đang theo dõi" : "Gợi ý"}</td>
                <td className="text-sm">{c.pageCount || "—"}{c.lastCrawledAt && <p className="text-xs text-ink-muted">{formatDateTimeVN(c.lastCrawledAt)}</p>}</td>
                <td>{run && (c.status === "suggested"
                  ? <span className="flex gap-2"><ActionButton action={setCompetitorStatus} fields={{ domain: c.domain, status: "active" }} label="Theo dõi" className="btn-primary btn-sm" /><ActionButton action={setCompetitorStatus} fields={{ domain: c.domain, status: "ignored" }} label="Bỏ" className="btn-line btn-sm" /></span>
                  : <ActionButton action={setCompetitorStatus} fields={{ domain: c.domain, status: "ignored" }} label="Ngừng" className="btn-line btn-sm" />)}</td>
              </tr>
            ))}
          </Table>
          {pages.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 font-bold">Trang đối thủ mới/sửa gần đây</h3>
              <ul className="space-y-2 text-sm">{pages.map(({ p, domain }) => <li key={p.id}><span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${p.state === "new" ? "bg-[#E7F6EC] text-[#1E7B3C]" : "bg-[#FFF4D6] text-[#8A5A00]"}`}>{p.state === "new" ? "Mới" : "Sửa"}</span><a href={p.url} target="_blank" rel="noreferrer" className="hover:underline">{p.title || p.url}</a> <span className="text-ink-muted">· {domain}{p.wordCount ? ` · ${p.wordCount} chữ` : ""}</span></li>)}</ul>
            </>
          )}
        </Panel>

        <Panel title="Decode bài top gần đây" icon="layers">
          <Table head={["Từ khoá", "Web mình", "Cấu trúc bài top"]} empty={!serps.length} emptyText="Chưa có — agent decode khi lập kế hoạch bài mỗi ngày.">
            {serps.map((s) => {
              const d = s.decode as { avgWords?: number; recommendedOutline?: string[]; contentGaps?: string[]; analyzedUrls?: string[] };
              return (
                <tr key={s.id}>
                  <td className="font-semibold">{s.keyword}<p className="text-xs font-normal text-ink-muted">{formatDateTimeVN(s.createdAt)}</p></td>
                  <td className="text-sm">{s.ourPosition ? `#${s.ourPosition}` : "Chưa có"}</td>
                  <td className="text-sm">
                    {d.avgWords ? <p>~{Math.round(d.avgWords)} chữ · {d.analyzedUrls?.length ?? 0} bài phân tích</p> : null}
                    {d.recommendedOutline?.length ? <details><summary className="cursor-pointer text-brand-dark">Dàn ý đề xuất ({d.recommendedOutline.length} mục)</summary><ol className="mt-1 list-decimal pl-5 text-ink-soft">{d.recommendedOutline.map((h, i) => <li key={i}>{h}</li>)}</ol></details> : null}
                    {d.contentGaps?.length ? <p className="mt-1 text-xs text-ink-muted">Khoảng trống: {d.contentGaps.slice(0, 3).join(" · ")}</p> : null}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      </div>

      <Panel title="Nhật ký agent (14 ngày)" icon="history" className="mt-5">
        <Table head={["Thời gian", "Loại", "Nội dung", "Telegram"]} empty={!insights.length} emptyText="Chưa có hoạt động.">
          {insights.map((i) => {
            const d = i.data as { summary?: string; items?: { title: string; writing: boolean }[]; trends?: { trend: string }[]; actions?: { title: string }[] };
            return (
              <tr key={i.id}>
                <td className="text-sm">{formatDateTimeVN(i.createdAt)}</td>
                <td className="text-sm font-semibold">{INSIGHT_LABEL[i.kind] ?? i.kind}</td>
                <td className="max-w-[560px] text-sm">
                  <p className="font-semibold">{i.title}</p>
                  {d.summary && <p className="text-ink-soft">{d.summary}</p>}
                  {d.items && <p className="text-ink-muted">{d.items.slice(0, 6).map((x) => `${x.writing ? "✍️ " : ""}${x.title}`).join(" · ")}</p>}
                  {d.trends && <p className="text-ink-muted">{d.trends.slice(0, 5).map((x) => x.trend).join(" · ")}</p>}
                  {d.actions && <p className="text-ink-muted">{d.actions.slice(0, 5).map((x) => x.title).join(" · ")}</p>}
                </td>
                <td className="text-sm">{i.sentAt ? "✓ đã gửi" : "—"}</td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </div>
  );
}
