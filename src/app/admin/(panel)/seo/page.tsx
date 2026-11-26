// A09 AI SEO và từ khoá (màn 020) + Hàng chờ duyệt (029) + Theo dõi tác vụ AI SEO (031) + từ khoá + hướng dẫn viết.
import Link from "next/link";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { aiConfigured, monthSpendUsd } from "@/lib/ai/claude";
import { JOB_TYPES } from "@/lib/ai/jobs";
import { DEFAULT_WRITER_GUIDE } from "@/lib/ai/prompts";
import { gscConfigured } from "@/lib/seo/gsc";
import { latestGscDate } from "@/lib/seo/metrics";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { sendSeoReportNow } from "../../actions/extra";
import { SeoNav } from "@/components/admin/SeoNav";
import { Badge, EmptyState, Field, IconBox, Notice, Num, PageTitle, Panel, StatCard, Table, Tabs } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { activatePrompt, addKeyword, cancelAgentJob, dismissOpportunity, retryAgentJob, runAgentJob, savePromptVersion, skipKeyword } from "../../actions/seo";

export const metadata = { title: "AI SEO" };
type SP = Record<string, string | undefined>;
const TABS = [
  { key: "opps", label: "Cơ hội từ khóa" }, { key: "queue", label: "Hàng chờ duyệt" }, { key: "jobs", label: "Tác vụ AI" },
  { key: "keywords", label: "Từ khóa" }, { key: "prompts", label: "Hướng dẫn viết" }, { key: "report", label: "Báo cáo", href: "/admin/seo/report" },
];
const OPP_TYPE: Record<string, string> = { new: "Viết mới", update: "Cập nhật bài", merge: "Gộp bài", ctr_fix: "Sửa tiêu đề/meta" };
const INTENT: Record<string, string> = { rong: "Rộng", sau: "Chuyên sâu", "san-pham": "Sản phẩm", "xu-ly-loi": "Xử lý lỗi", "xu-huong": "Xu hướng" };
const KIND: Record<string, string> = { "sieu-rong": "Siêu rộng", dai: "Từ khóa dài", nganh: "Ngành", "san-pham": "Sản phẩm", ngan: "Ngắn", "dia-ly": "Địa lý", trend: "Xu hướng" };

export default async function SeoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const u = await requirePage("seo.view");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab && !t.href)?.key ?? "opps";
  const canRun = can(u.roles, "seo.run_ai");
  const db = await getDb();
  const [[{ kw }], [{ queue }], latest, [lastJob]] = await Promise.all([
    db.select({ kw: sql<number>`count(*)::int` }).from(schema.keywords).where(sql`${schema.keywords.status} <> 'skipped'`),
    db.select({ queue: sql<number>`count(*)::int` }).from(schema.articles).where(eq(schema.articles.status, "review")),
    latestGscDate().catch(() => null),
    db.select({ at: schema.aiJobs.finishedAt }).from(schema.aiJobs).where(eq(schema.aiJobs.status, "done")).orderBy(desc(schema.aiJobs.finishedAt)).limit(1),
  ]);
  const connected = gscConfigured();
  return (
    <>
      <PageTitle title={tab === "jobs" ? "Tác vụ AI SEO" : "AI SEO và từ khóa"}
        tag={<span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold ${connected ? "bg-[#E7F6EC] text-[#1E7B3C]" : "bg-brand-soft text-brand-dark"}`}><Icon name="link" /> {connected ? "Đã kết nối Search Console" : "Chưa kết nối nguồn dữ liệu"}</span>}>
        <Link href="/admin/seo/sources" className="btn-primary"><Icon name="link" /> Kết nối nguồn</Link>
        <Link href="/admin/seo/import" className="btn-line"><Icon name="plus" /> Nhập từ khóa</Link>
        <ActionButton action={sendSeoReportNow} label="Báo cáo về Telegram" icon="send" className="btn-line" />
      </PageTitle>
      <SeoNav current="/admin/seo" />
      <Tabs base="/admin/seo" current={tab} tabs={TABS} />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard icon="search" label="Từ khóa" value={Number(kw)} href="/admin/seo?tab=keywords" />
        <StatCard icon="file" label="Bài chờ duyệt" value={Number(queue)} href="/admin/seo?tab=queue" />
        <StatCard icon="refresh" label="Lần cập nhật" value={<span className="text-xl">{latest ?? (lastJob?.at ? formatDateTimeVN(lastJob.at) : "—")}</span>} hint={latest ? "Số liệu Search Console mới nhất" : lastJob?.at ? "Tác vụ AI hoàn thành gần nhất" : "Chưa có dữ liệu"} />
      </div>
      {tab === "opps" && <Opportunities canRun={canRun} sp={sp} />}
      {tab === "queue" && <Queue />}
      {tab === "jobs" && <Jobs canRun={canRun} sp={sp} />}
      {tab === "keywords" && <Keywords />}
      {tab === "prompts" && <Prompts canActivate={can(u.roles, "content.review")} canRun={canRun} />}
    </>
  );
}

function Flow({ canRun }: { canRun: boolean }) {
  const steps = [
    { icon: "search" as const, label: "Tìm cơ hội", sub: "Thu Search Console, gom & chấm điểm", job: "score_opportunities" },
    { icon: "file" as const, label: "Tạo nháp", sub: "AI lập brief + bản nháp từ cơ hội", job: "" },
    { icon: "checkCircle" as const, label: "Duyệt đăng", sub: "Người duyệt kiểm tra rồi xuất bản", job: "" },
  ];
  return (
    <Panel title="Quy trình">
      <ol className="relative">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-6 top-12 h-[calc(100%-48px)] w-0.5 bg-line" />}
            <IconBox icon={s.icon} /><div><p className="text-lg font-semibold">{s.label}</p><p className="text-sm text-ink-muted">{s.sub}</p></div>
          </li>
        ))}
      </ol>
      {canRun && (
        <div className="mt-5 grid gap-2 border-t border-[#EFECE8] pt-4">
          <ActionButton action={runAgentJob} label="Thu Search Console" icon="download" className="btn-line btn-sm w-full" fields={{ type: "collect_gsc" }} />
          <ActionButton action={runAgentJob} label="Gom từ khoá từ Search Console" icon="layers" className="btn-line btn-sm w-full" fields={{ type: "harvest_keywords" }} />
          <ActionButton action={runAgentJob} label="Gom & chấm điểm cơ hội" icon="bars" className="btn-line btn-sm w-full" fields={{ type: "score_opportunities" }} />
          <ActionButton action={runAgentJob} label="AI đề xuất từ khoá" icon="sparkles" className="btn-primary btn-sm w-full" fields={{ type: "suggest_keywords" }} />
        </div>
      )}
      <p className="mt-3 text-xs text-ink-muted">AI chỉ tạo đề xuất và bản nháp. Mọi lần xuất bản đi qua tài khoản người duyệt.</p>
    </Panel>
  );
}

async function Opportunities({ canRun, sp }: { canRun: boolean; sp: SP }) {
  const db = await getDb();
  const where: SQL[] = [inArray(schema.opportunities.status, ["open", "briefed", "drafted"])];
  if (sp.type && sp.type in OPP_TYPE) where.push(eq(schema.opportunities.type, sp.type));
  const rows = await db.select().from(schema.opportunities).where(and(...where)).orderBy(desc(schema.opportunities.score)).limit(80);
  const kwIds = [...new Set(rows.flatMap((r) => r.keywordIds.slice(0, 1)))];
  const kws = kwIds.length ? await db.select().from(schema.keywords).where(inArray(schema.keywords.id, kwIds)) : [];
  const ideas = rows.length ? [] : await db.select().from(schema.keywords).where(eq(schema.keywords.status, "new")).orderBy(desc(schema.keywords.createdAt)).limit(10);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title={rows.length ? "Cơ hội từ khóa" : "Ý tưởng khởi đầu"} actions={<Link href="/admin/seo/outline" className="btn-primary btn-sm"><Icon name="plus" /> Tạo đề cương</Link>}>
        <form className="mb-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="tab" value="opps" />
          <label htmlFor="opp-type" className="font-semibold">Đề xuất</label>
          <select id="opp-type" name="type" defaultValue={sp.type ?? ""} className="input !w-auto"><option value="">Tất cả</option>{Object.entries(OPP_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="btn-line btn-sm">Lọc</button>
        </form>
        {rows.length ? (
          <Table head={["Từ khóa / cơ hội", "Nhóm", "Đề xuất", "Điểm", "Dữ liệu", ""]}>
            {rows.map((o) => {
              const k = kws.find((x) => x.id === o.keywordIds[0]);
              return (
                <tr key={o.id}>
                  <td className="min-w-[220px]"><Link href={`/admin/seo/opportunities/${o.id}`} className="font-semibold hover:text-brand-dark">{k?.query ?? o.title}</Link>{k && k.query !== o.title && <p className="text-xs text-ink-muted">{o.title}</p>}</td>
                  <td className="whitespace-nowrap text-sm">{KIND[k?.kind ?? ""] ?? (INTENT[k?.intent ?? ""] ?? (k?.intent || "—"))}</td>
                  <td><span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-dark"><Icon name="file" className="h-4 w-4" />{OPP_TYPE[o.type] ?? o.type}</span></td>
                  <td className="text-lg font-extrabold text-brand">{Math.round(o.score)}</td>
                  <td><Num v={k?.impressions ?? k?.searchVolume ?? null} /></td>
                  <td className="whitespace-nowrap">
                    {o.draftArticleId ? <Link className="btn-line btn-sm" href={`/admin/content/${o.draftArticleId}`}>Mở bản nháp</Link>
                      : o.type === "merge" ? <Link href={`/admin/seo/opportunities/${o.id}`} className="btn-line btn-sm">Xem & quyết định</Link>
                      : canRun ? <ActionButton action={runAgentJob} label="AI viết nháp" className="btn-primary btn-sm" fields={{ type: "write_draft", opportunityId: o.id }} /> : null}
                    {o.status === "open" && <ActionButton action={dismissOpportunity} label="Bỏ qua" className="btn-ghost btn-sm" fields={{ id: o.id }} />}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : ideas.length ? (
          <Table head={["Từ khóa", "Nhóm", "Đề xuất", "Dữ liệu"]}>
            {ideas.map((k) => (
              <tr key={k.id}><td>{k.query}</td><td className="whitespace-nowrap">{KIND[k.kind] ?? (INTENT[k.intent] ?? (k.intent || "—"))}</td>
                <td><Link href={`/admin/seo/outline?keyword=${encodeURIComponent(k.query)}&cluster=${encodeURIComponent(k.cluster)}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-dark"><Icon name="file" className="h-4 w-4" /> Viết mới</Link></td>
                <td><Num v={k.searchVolume ?? k.impressions} /></td></tr>
            ))}
          </Table>
        ) : <EmptyState icon="search" title="Chưa có cơ hội từ khoá" text="Kết nối Search Console, nhập CSV hoặc thêm từ khoá tay rồi bấm “Gom & chấm điểm cơ hội”."><Link href="/admin/seo/import" className="btn-line btn-sm">Nhập CSV</Link><Link href="/admin/seo?tab=keywords" className="btn-line btn-sm">Thêm từ khoá</Link></EmptyState>}
      </Panel>
      <Flow canRun={canRun} />
    </div>
  );
}

async function Queue() {
  const db = await getDb();
  const rows = await db.select({ a: schema.articles, title: schema.revisions.title, topic: schema.topics.name }).from(schema.articles)
    .leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId)).leftJoin(schema.topics, eq(schema.topics.id, schema.articles.topicId))
    .where(and(inArray(schema.articles.status, ["review", "draft"]), sql`(${schema.articles.aiGenerated} = true or ${schema.articles.status} = 'review')`))
    .orderBy(sql`case ${schema.articles.status} when 'review' then 0 else 1 end`, desc(schema.articles.updatedAt)).limit(100);
  return (
    <Table head={["Bài viết", "Chủ đề", "Nguồn", "Trạng thái", "Cập nhật", ""]} empty={!rows.length} emptyText="Hàng chờ trống — bản nháp AI và bài gửi duyệt sẽ hiện ở đây.">
      {rows.map(({ a, title, topic }) => (
        <tr key={a.id}>
          <td className="font-semibold">{title ?? "(chưa có tiêu đề)"}</td><td>{topic ?? "—"}</td>
          <td>{a.aiGenerated ? <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-semibold text-[#3730A3]">AI · hướng dẫn v{a.promptVersion ?? 1}</span> : "Biên tập viên"}</td>
          <td><Badge status={a.status} /></td><td className="whitespace-nowrap text-sm text-ink-muted">{formatDateTimeVN(a.updatedAt)}</td>
          <td><Link href={a.status === "review" ? `/admin/content/${a.id}/review` : `/admin/content/${a.id}`} className="btn-line btn-sm">{a.status === "review" ? "Duyệt" : "Mở nháp"}</Link></td>
        </tr>
      ))}
    </Table>
  );
}

async function Jobs({ canRun, sp }: { canRun: boolean; sp: SP }) {
  const db = await getDb();
  const GROUP: Record<string, string[]> = { running: ["queued", "running", "waiting_runner", "runner_running"], done: ["done", "skipped"], failed: ["failed", "cancelled"] };
  const g = sp.status && sp.status in GROUP ? sp.status : "all";
  const [rows, spend] = await Promise.all([
    db.select().from(schema.aiJobs).where(g === "all" ? undefined : inArray(schema.aiJobs.status, GROUP[g])).orderBy(desc(schema.aiJobs.createdAt)).limit(100),
    monthSpendUsd(),
  ]);
  const scope = (s: Record<string, unknown>) => (s.opportunityId ? "Cơ hội " + String(s.opportunityId).slice(0, 8) : s.days ? `${s.days} ngày gần nhất` : "Toàn bộ");
  const missing = [!gscConfigured() && "Search Console", !aiConfigured() && "runner AI (RUNNER_TOKEN)"].filter(Boolean);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-card border border-line bg-white p-1.5">
            {[["all", "Tất cả"], ["running", "Đang chạy"], ["done", "Hoàn thành"], ["failed", "Thất bại"]].map(([k, l]) => (
              <Link key={k} href={`/admin/seo?tab=jobs${k === "all" ? "" : `&status=${k}`}`} className={`rounded-xl px-5 py-2.5 font-semibold ${g === k ? "bg-brand-soft text-brand" : "hover:bg-black/5"}`}>{l}</Link>
            ))}
          </div>
          <div className="flex gap-2">
            <Link href="/admin/seo/schedule" className="btn-line"><Icon name="calendar" /> Lịch tự động</Link>
          </div>
        </div>
        {missing.length > 0 && <Notice tone="warn" title={`Chưa cấu hình nguồn dữ liệu: ${missing.join(", ")}`} action={<Link href="/admin/seo/sources" className="btn-outline btn-sm">Cấu hình</Link>}>Tác vụ cần nguồn này sẽ báo “Chưa cấu hình nguồn” — luồng viết tay vẫn dùng được.</Notice>}
        <Table head={["Tác vụ", "Phạm vi", "Trạng thái", "Thời gian", "Thao tác"]} empty={!rows.length} emptyText="Chưa có lần chạy nào.">
          {rows.map((j) => (
            <tr key={j.id}>
              <td><Link href={`/admin/seo/jobs/${j.id}`} className="font-semibold hover:text-brand-dark">{JOB_TYPES[j.type as keyof typeof JOB_TYPES] ?? j.type}</Link>
                {j.error && <p className="max-w-sm truncate text-xs text-[#B42318]" title={j.error}>{j.error}</p>}{j.needsReview && <p className="text-xs font-semibold text-[#B42318]">Cần kiểm tra</p>}</td>
              <td className="text-sm">{scope(j.scope)}</td>
              <td><Badge status={j.error?.startsWith("Chưa cấu hình") ? "not_configured" : j.status} label={j.error?.startsWith("Chưa cấu hình") ? "Chờ cấu hình" : undefined} /></td>
              <td className="whitespace-nowrap text-sm text-ink-muted">{formatDateTimeVN(j.createdAt)}</td>
              <td className="whitespace-nowrap">
                {canRun && ["failed", "skipped", "cancelled"].includes(j.status) ? <ActionButton action={retryAgentJob} label="Chạy lại" className="btn-outline btn-sm" fields={{ id: j.id }} />
                  : <Link href={`/admin/seo/jobs/${j.id}`} className="btn-line btn-sm">Xem chi tiết</Link>}
                {canRun && j.status === "queued" && <ActionButton action={cancelAgentJob} label="Huỷ" className="btn-ghost btn-sm" fields={{ id: j.id }} />}
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <aside>
        <Panel title="Thông tin tác vụ">
          <div className="flex items-start gap-4 border-b border-[#EFECE8] pb-4"><IconBox icon="file" /><div><p className="font-semibold">Nguồn</p><p className="text-ink-soft">Search Console: {gscConfigured() ? "đã cấu hình" : "chưa cấu hình"} · AI: {aiConfigured() ? "đã cấu hình" : "chưa cấu hình"}</p></div></div>
          <div className="flex items-start gap-4 pt-4"><IconBox icon="database" /><div><p className="font-semibold">Chi phí AI tháng này</p><p className="text-ink-soft">{spend.toFixed(2)} / {process.env.AI_MONTHLY_BUDGET_USD ?? 30} USD</p></div></div>
        </Panel>
        {canRun && (
          <Panel title="Tạo tác vụ">
            <ActionForm action={runAgentJob} submitLabel="Đưa vào hàng chờ" submitIcon="plus">
              <Field label="Loại tác vụ" name="type" options={Object.entries(JOB_TYPES).filter(([k]) => k !== "write_draft").map(([value, label]) => ({ value, label }))} />
            </ActionForm>
          </Panel>
        )}
        <Panel title="Nhật ký">
          {rows.length ? <ul className="space-y-2 text-sm">{rows.slice(0, 6).map((j) => <li key={j.id} className="flex items-center justify-between gap-2"><span className="truncate">{JOB_TYPES[j.type as keyof typeof JOB_TYPES] ?? j.type}</span><Badge status={j.status} /></li>)}</ul>
            : <EmptyState icon="clock" title="Chưa có lần chạy" />}
        </Panel>
      </aside>
    </div>
  );
}

async function Keywords() {
  const db = await getDb();
  const rows = await db.select().from(schema.keywords).orderBy(desc(sql`coalesce(${schema.keywords.impressions}, ${schema.keywords.searchVolume}, 0)`)).limit(150);
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Thêm từ khoá thủ công / từ đội tư vấn">
          <ActionForm action={addKeyword} resetOnSuccess submitLabel="Thêm từ khoá" submitIcon="plus">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Truy vấn" name="query" required /><Field label="Cụm (slug)" name="cluster" placeholder="setup-phong-nho" />
              <Field label="Ý định" name="intent" options={[["", "—"], ["rong", "Rộng"], ["sau", "Sâu"], ["san-pham", "Sản phẩm"], ["xu-ly-loi", "Xử lý lỗi"], ["xu-huong", "Xu hướng"]].map(([value, label]) => ({ value, label }))} />
              <Field label="Nguồn" name="source" options={[{ value: "manual", label: "Thủ công" }, { value: "consultant", label: "Đội tư vấn tổng hợp" }]} />
              <Field label="Lượng tìm kiếm (nếu có)" name="searchVolume" type="number" />
            </div>
          </ActionForm>
        </Panel>
        <Panel title="Nhập nhiều từ khoá">
          <p className="text-ink-soft">Tải tệp CSV, đối chiếu cột và kiểm tra dòng trùng trước khi nhập.</p>
          <Link href="/admin/seo/import" className="btn-primary mt-4"><Icon name="upload" /> Nhập từ khoá CSV</Link>
        </Panel>
      </div>
      <Table head={["Truy vấn", "Cụm / ý định", "Nguồn", "Hiển thị", "Nhấp", "Vị trí", "Lượng tìm kiếm", "Xu hướng", ""]} empty={!rows.length}>
        {rows.map((k) => (
          <tr key={k.id} className={k.status === "skipped" ? "opacity-50" : ""}>
            <td><b>{k.query}</b>{k.variantsSeen.length > 1 && <p className="text-xs text-ink-muted">+{k.variantsSeen.length - 1} biến thể</p>}</td>
            <td className="text-xs">{k.cluster || "—"} / {INTENT[k.intent] ?? (k.intent || "—")}</td><td className="text-xs">{k.source}</td>
            <td><Num v={k.impressions} /></td><td><Num v={k.clicks} /></td><td><Num v={k.position} fmt={(n) => n.toFixed(1)} /></td>
            <td><Num v={k.searchVolume} /></td><td><Num v={k.trendScore} /></td>
            <td>{k.status !== "skipped" && <ActionButton action={skipKeyword} label="Bỏ" className="btn-ghost btn-sm" fields={{ id: k.id }} />}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

async function Prompts({ canActivate, canRun }: { canActivate: boolean; canRun: boolean }) {
  const db = await getDb();
  const rows = await db.select().from(schema.promptVersions).where(eq(schema.promptVersions.key, "article_writer")).orderBy(desc(schema.promptVersions.version));
  const active = rows.find((r) => r.status === "active");
  return (
    <>
      <Panel title="Vòng tự nâng cấp" actions={canRun ? <ActionButton action={runAgentJob} label="AI phân tích & đề xuất bản mới" icon="sparkles" className="btn-primary" fields={{ type: "improve_prompt" }} /> : undefined}>
        <p className="text-ink-soft">Mỗi tháng AI Agent đọc hiệu quả các bài đã xuất bản (CTR, vị trí, bấm sang sàn) và nhận xét của người duyệt, rồi đề xuất phiên bản hướng dẫn viết mới. Bản đề xuất ở trạng thái <b>nháp</b>; chỉ có hiệu lực khi người duyệt bấm <b>Kích hoạt</b>. Luật cứng thương hiệu nằm cố định trong mã nguồn, AI không sửa được.</p>
      </Panel>
      {!active && <Notice tone="info">Đang dùng hướng dẫn mặc định v1 trong mã nguồn.</Notice>}
      {rows.map((p) => (
        <Panel key={p.id} title={`v${p.version} · ${p.origin === "ai" ? "AI đề xuất" : "Người viết"}`} actions={<span className="flex items-center gap-2"><Badge status={p.status} />{canActivate && p.status !== "active" && <ActionButton action={activatePrompt} label="Kích hoạt" className="btn-primary btn-sm" confirm={`Dùng hướng dẫn v${p.version} cho các bài AI viết từ nay?`} fields={{ id: p.id }} />}</span>}>
          {p.rationale && <p className="mb-3 whitespace-pre-wrap rounded-xl bg-brand-tint p-3 text-sm">{p.rationale}</p>}
          <details><summary className="cursor-pointer font-semibold">Xem nội dung</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-[#F7F5F2] p-3 text-xs">{p.content}</pre></details>
        </Panel>
      ))}
      {canActivate && (
        <Panel title="Tạo phiên bản thủ công">
          <ActionForm action={savePromptVersion} submitLabel="Lưu nháp" submitIcon="save">
            <Field label="Nội dung hướng dẫn + template" name="content" rows={16} defaultValue={active?.content ?? DEFAULT_WRITER_GUIDE} />
            <div className="mt-3"><Field label="Lý do thay đổi" name="rationale" rows={2} /></div>
          </ActionForm>
        </Panel>
      )}
    </>
  );
}
