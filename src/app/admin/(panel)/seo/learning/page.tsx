// Vòng học AI — phễu đo lường (tìm kiếm → nhấp → xem → chuyển đổi), thí nghiệm sau xuất bản,
// trọng số chấm điểm hệ thống tự học (khoá/hoàn tác được), hiệu quả theo phiên bản hướng dẫn viết, nhật ký học.
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { getSetting, WEIGHT_KEYS } from "@/lib/settings";
import { funnel, KIND_LABEL, promptPerformance, VERDICT_LABEL, EVAL_DAYS } from "@/lib/seo/learning";
import { formatDateTimeVN } from "@/lib/text";
import { ActionButton, ActionForm } from "@/components/admin/ActionForm";
import { Notice, PageTitle, Panel, StatCard, Table, Toggle } from "@/components/admin/ui";
import { revertLearning, runLearningNow, saveLearningConfig } from "../../../actions/learning";

export const metadata = { title: "Vòng học AI" };
export const dynamic = "force-dynamic";

const WEIGHT_LABEL: Record<string, string> = {
  brandFit: "Phù hợp thương hiệu", demand: "Bằng chứng nhu cầu", illustratable: "Khả năng minh hoạ", learned: "Chuyển đổi của cụm", launch: "Cụm ra mắt ưu tiên",
};
const pct = (x: number | null) => (x == null ? "Chưa có dữ liệu" : `${(x * 100).toFixed(1)}%`);
const VERDICT_CLS: Record<string, string> = {
  win: "bg-[#E7F6EC] text-[#1E7B3C]", loss: "bg-[#FDECEC] text-[#B42318]", neutral: "bg-[#EFEDEA] text-ink-soft",
  insufficient: "bg-[#FFF4D6] text-[#8A5A00]", running: "bg-[#EEF2FF] text-[#3730A3]",
};

export default async function LearningPage() {
  const u = await requireUser("seo.view");
  const db = await getDb();
  const [f28, weights, exps, logs, perPrompt] = await Promise.all([
    funnel(28),
    getSetting("scoringWeights"),
    db.select({ e: schema.experiments, slug: schema.articles.slug, kind: schema.articles.kind, title: schema.revisions.title })
      .from(schema.experiments)
      .leftJoin(schema.articles, eq(schema.articles.id, schema.experiments.articleId))
      .leftJoin(schema.revisions, eq(schema.revisions.id, schema.experiments.revisionId))
      .orderBy(desc(schema.experiments.startedAt)).limit(50),
    db.select().from(schema.learningLog).orderBy(desc(schema.learningLog.createdAt)).limit(30),
    promptPerformance(),
  ]);
  const editable = can(u.roles, "settings.edit");
  const counts = exps.reduce<Record<string, number>>((m, x) => ((m[x.e.verdict] = (m[x.e.verdict] ?? 0) + 1), m), {});
  const decided = (counts.win ?? 0) + (counts.loss ?? 0) + (counts.neutral ?? 0);

  return (
    <div>
      <PageTitle title="Vòng học AI" back="/admin/seo" subtitle={`Đo → thử → học → tự điều chỉnh. Mỗi bài xuất bản là một thí nghiệm, đo lại sau ${EVAL_DAYS} ngày.`}>
        {can(u.roles, "seo.run_ai") && <ActionButton action={runLearningNow} label="Chạy vòng học ngay" className="btn-primary" icon="refresh" />}
      </PageTitle>

      <Notice tone="info" title="Hệ thống tự nâng cấp ở đâu, giới hạn thế nào">
        Tự học: <b>trọng số chấm điểm cơ hội</b> (mỗi lần ±20%, trong biên 0.5–2, khoá/hoàn tác được) và <b>ưu tiên cụm theo tỷ lệ chuyển đổi</b>.
        AI chỉ <b>đề xuất</b> phiên bản hướng dẫn viết mới và <b>bản nháp</b> — người duyệt kích hoạt/xuất bản. Hệ thống không tự sửa mã nguồn, không tự đăng bài.
        Không có công cụ nào cam kết được “top Google”: vòng học giúp ra bài đúng nhu cầu nhanh hơn và sửa bài theo số liệu thật.
      </Notice>

      <h2 className="mb-3 mt-6 text-xl font-bold">Phễu 28 ngày</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="eye" label="Lượt hiển thị Google" value={f28.impressions.toLocaleString("vi-VN")} hint={f28.position != null ? `Vị trí TB ${f28.position.toFixed(1)}` : "Chưa có dữ liệu Search Console"} />
        <StatCard icon="pointer" label="Lượt nhấp từ Google" value={f28.clicks.toLocaleString("vi-VN")} hint={`CTR ${pct(f28.ctr)}`} />
        <StatCard icon="monitor" label="Lượt xem trang" value={f28.views.toLocaleString("vi-VN")} hint="Đo trên website, không cookie" />
        <StatCard icon="target" label="Chuyển đổi" value={(f28.marketplaceClicks + f28.consultClicks + f28.leads).toLocaleString("vi-VN")}
          hint={`Bấm sàn ${f28.marketplaceClicks} · Bấm tư vấn ${f28.consultClicks} · Gửi form ${f28.leads} · Tỷ lệ ${pct(f28.conversionRate)}`} />
      </div>
      <p className="mt-2 text-xs text-ink-muted">Lượt bấm sang sàn là lượt bấm, không phải số đơn hàng. Chọn đèn hoàn tất: {f28.selector} · Ứng tuyển: {f28.applies}.</p>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Panel title="Trọng số chấm điểm đang dùng" icon="sliders">
          <p className="mb-4 text-sm text-ink-muted">
            {weights.basedOn ? `Học từ ${weights.basedOn} bài mới có kết luận · cập nhật ${formatDateTimeVN(new Date(weights.updatedAt))}` : "Chưa đủ dữ liệu để học (cần ≥ 6 bài mới có kết luận) — đang dùng trọng số mặc định 1."}
          </p>
          <ActionForm action={saveLearningConfig} submitLabel="Lưu cấu hình" buttons={editable ? undefined : <span className="text-sm text-ink-muted">Chỉ quản trị hệ thống được sửa.</span>}>
            <div className="grid gap-3 sm:grid-cols-2">
              {WEIGHT_KEYS.map((k) => (
                <label key={k} className="block">
                  <span className="label !text-sm">{WEIGHT_LABEL[k]}</span>
                  <input name={k} type="number" step="0.05" min="0.5" max="2" defaultValue={weights[k]} disabled={!editable} className="input" />
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <Toggle name="autoApply" defaultChecked={weights.autoApply} disabled={!editable} label="Tự áp dụng khi học xong" />
              <Toggle name="locked" defaultChecked={weights.locked} disabled={!editable} label="Khoá (chỉ ghi đề xuất)" />
            </div>
          </ActionForm>
        </Panel>

        <Panel title="Kết quả thí nghiệm" icon="bars">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["win", "neutral", "loss", "running"] as const).map((v) => (
              <div key={v} className="rounded-xl border border-line p-3 text-center">
                <p className="text-2xl font-extrabold">{counts[v] ?? 0}</p>
                <p className="text-sm text-ink-muted">{VERDICT_LABEL[v]}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink-muted">Tỷ lệ thắng: {decided ? pct((counts.win ?? 0) / decided) : "Chưa có dữ liệu"} · Chưa đủ dữ liệu: {counts.insufficient ?? 0}</p>
          <h3 className="mb-2 mt-5 font-bold">Theo phiên bản hướng dẫn viết</h3>
          <Table head={["Phiên bản", "Thí nghiệm", "Thắng", "Thua", "Đang đo"]} empty={!perPrompt.length} emptyText="Chưa có bài AI nào được xuất bản.">
            {perPrompt.map((p) => <tr key={String(p.version)}><td>v{p.version}</td><td>{p.total}</td><td>{p.wins}</td><td>{p.losses}</td><td>{p.running}</td></tr>)}
          </Table>
          <p className="mt-2 text-xs text-ink-muted">AI dùng bảng này khi đề xuất bộ hướng dẫn viết mới (hằng tháng) — xem và kích hoạt ở <Link href="/admin/seo?tab=prompts" className="underline">Hướng dẫn viết</Link>.</p>
        </Panel>
      </div>

      <Panel title="Thí nghiệm gần đây" icon="target" className="mt-5">
        <Table head={["Bài", "Loại", "Bắt đầu", "Nền (trước)", "Sau 28 ngày", "Kết luận"]} empty={!exps.length} emptyText="Chưa có thí nghiệm — sẽ tự tạo khi có bài được xuất bản.">
          {exps.map(({ e, slug, kind, title }) => (
            <tr key={e.id}>
              <td className="max-w-[280px]">{slug ? <Link className="font-semibold hover:underline" href={`/${kind === "news" ? "tin-tuc" : "kien-thuc"}/${slug}`} target="_blank">{title ?? slug}</Link> : "—"}
                <p className="truncate text-xs text-ink-muted" title={e.hypothesis}>{e.hypothesis}</p></td>
              <td>{KIND_LABEL[e.kind] ?? e.kind}{e.promptVersion ? <span className="block text-xs text-ink-muted">Hướng dẫn v{e.promptVersion}</span> : null}</td>
              <td className="whitespace-nowrap text-sm">{formatDateTimeVN(e.startedAt)}</td>
              <td className="text-sm">{e.baseline.impressions ?? 0} hiển thị · {e.baseline.clicks ?? 0} nhấp</td>
              <td className="text-sm">{e.result ? `${e.result.impressions ?? 0} hiển thị · ${e.result.clicks ?? 0} nhấp · ${e.result.conversions ?? 0} chuyển đổi` : `Đo lúc ${formatDateTimeVN(e.evaluateAfter)}`}</td>
              <td><span className={`inline-flex rounded-full px-3 py-1 text-[13px] font-semibold ${VERDICT_CLS[e.verdict] ?? ""}`}>{VERDICT_LABEL[e.verdict] ?? e.verdict}</span></td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="Nhật ký học" icon="history">
        <Table head={["Thời điểm", "Nội dung", "Thay đổi", ""]} empty={!logs.length} emptyText="Chưa có lần tự điều chỉnh nào.">
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-sm">{formatDateTimeVN(l.createdAt)}</td>
              <td>{l.summary}{l.revertedAt && <span className="ml-2 text-xs font-semibold text-ink-muted">(đã hoàn tác)</span>}</td>
              <td className="text-xs text-ink-muted">{l.after ? Object.entries(l.after).map(([k, v]) => `${WEIGHT_LABEL[k] ?? k}: ${(l.before as Record<string, unknown> | null)?.[k] ?? "?"} → ${v}`).join(" · ") : JSON.stringify(l.evidence).slice(0, 140)}</td>
              <td>{l.kind === "weights" && l.applied && !l.revertedAt && editable && <ActionButton action={revertLearning} fields={{ id: l.id }} label="Hoàn tác" confirm="Đưa trọng số về giá trị trước lần điều chỉnh này?" />}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
