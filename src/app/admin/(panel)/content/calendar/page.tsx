// Màn 030 Lịch xuất bản: lịch tháng theo giờ Việt Nam (lưu UTC), cột "Chưa lên lịch" = bài đã duyệt, form lên lịch đăng.
import Image from "next/image";
import Link from "next/link";
import { and, eq, gte, inArray, lt, or } from "drizzle-orm";
import { requirePage } from "@/lib/admin-page";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { VN_TZ } from "@/lib/text";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageTitle, SampleTag } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { scheduleFromCalendar } from "../../../actions/extra";

export const metadata = { title: "Lịch xuất bản" };

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const dayLabel = (d: Date) => new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TZ, weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
const timeVN = (d: Date) => new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TZ, hour: "2-digit", minute: "2-digit" }).format(d);

export default async function Calendar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePage("content.edit");
  const sp = await searchParams;
  const today = dayKey(new Date());
  const [y, m] = (/^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7)).split("-").map(Number);
  const start = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00+07:00`);
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - 7 * 3600_000);
  const db = await getDb();
  const cols = { id: schema.articles.id, status: schema.articles.status, scheduledAt: schema.articles.scheduledAt, publishedAt: schema.articles.publishedAt, isSample: schema.articles.isSample, title: schema.revisions.title, cover: schema.revisions.coverUrl };
  const [events, approved] = await Promise.all([
    db.select(cols).from(schema.articles).leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.draftRevisionId))
      .where(or(and(eq(schema.articles.status, "scheduled"), gte(schema.articles.scheduledAt, start), lt(schema.articles.scheduledAt, next)),
        and(eq(schema.articles.status, "published"), gte(schema.articles.publishedAt, start), lt(schema.articles.publishedAt, next)))),
    db.select(cols).from(schema.articles).leftJoin(schema.revisions, eq(schema.revisions.id, schema.articles.approvedRevisionId))
      .where(inArray(schema.articles.status, ["approved"])),
  ]);
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const at = e.status === "scheduled" ? e.scheduledAt : e.publishedAt;
    if (!at) continue;
    const k = dayKey(at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Thứ Hai = 0
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: { days: string[]; label: string }[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const ds = cells.slice(i, i + 7).filter((d): d is number => d !== null);
    if (!ds.length) continue;
    weeks.push({ days: ds.map((d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`), label: `${ds[0]}–${ds[ds.length - 1]}/${m}` });
  }
  const mm = (dy: number, dm: number) => { const d = new Date(Date.UTC(dy, dm - 1, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const canSchedule = can(u.roles, "content.review");

  return (
    <>
      <PageTitle title="Lịch xuất bản">
        <Link href="/admin/content?status=approved" className="btn-line">Bài đã duyệt</Link>
        <a href="#len-lich" className="btn-primary"><Icon name="plus" /> Tạo lịch đăng</a>
      </PageTitle>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`?m=${mm(y, m - 1)}`} className="btn-line btn-sm" aria-label="Tháng trước"><Icon name="arrowLeft" className="h-4 w-4" /></Link>
        <span className="inline-flex min-h-[44px] items-center gap-3 rounded-[10px] border border-line bg-white px-4 font-semibold"><Icon name="calendar" /> Tháng {m} năm {y}</span>
        <Link href={`?m=${mm(y, m + 1)}`} className="btn-line btn-sm" aria-label="Tháng sau"><Icon name="arrowRight" className="h-4 w-4" /></Link>
        <Link href="?" className="btn-ghost btn-sm">Hôm nay</Link>
        <span className="ml-auto text-sm text-ink-muted">Giờ Việt Nam (UTC+7)</span>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <div className="flex gap-3 overflow-x-auto pb-2">
            <div className="flex min-h-[560px] w-[240px] flex-none flex-col rounded-card border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3.5 text-lg font-bold">Chưa lên lịch</h2>
              <div className="flex-1 space-y-3 p-3">
                {approved.length ? approved.map((a) => (
                  <CalCard key={a.id} href={`?${new URLSearchParams({ ...(sp.m ? { m: sp.m } : {}), article: a.id })}#len-lich`} title={a.title} cover={a.cover} isSample={a.isSample}
                    badge={<span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#E7F6EC] px-2.5 py-0.5 text-xs font-semibold text-[#1E7B3C]"><Icon name="check" className="h-3.5 w-3.5" /> Đã duyệt</span>} />
                )) : <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-ink-muted">Không có bài đã duyệt chờ lên lịch.</p>}
              </div>
            </div>
            {weeks.map((w, wi) => {
              const list = w.days.flatMap((k) => byDay.get(k) ?? []);
              const hasToday = w.days.includes(today);
              return (
                <div key={wi} className={`flex min-h-[560px] w-[236px] flex-none flex-col rounded-card border bg-white ${hasToday ? "border-brand/50" : "border-line"}`}>
                  <div className="border-b border-line px-4 py-3">
                    <h2 className="text-lg font-bold">Tuần {wi + 1}</h2>
                    <p className="text-xs text-ink-muted">{w.label}</p>
                  </div>
                  <div className="flex-1 space-y-3 p-3">
                    {list.length ? list.map((e) => {
                      const at = (e.status === "scheduled" ? e.scheduledAt : e.publishedAt)!;
                      return (
                        <CalCard key={e.id} href={`/admin/content/${e.id}`} title={e.title} cover={e.cover} isSample={e.isSample}
                          meta={`${dayLabel(at)} · ${timeVN(at)}`}
                          badge={e.status === "scheduled"
                            ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark"><Icon name="clock" className="h-3.5 w-3.5" /> Đã lên lịch</span>
                            : <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#E7F6EC] px-2.5 py-0.5 text-xs font-semibold text-[#1E7B3C]"><Icon name="check" className="h-3.5 w-3.5" /> Đã xuất bản</span>} />
                      );
                    }) : (
                      <a href="#len-lich" className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-3 py-8 text-center text-sm text-ink-muted hover:border-brand/40 hover:text-brand-dark">
                        <Icon name="plus" className="h-6 w-6" /> Chưa có bài trong tuần — lên lịch ở khung bên phải
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 flex flex-wrap gap-4 text-xs text-ink-muted">
            <span>Mỗi cột là một tuần (Thứ Hai – Chủ Nhật) của tháng đang xem, giờ Việt Nam.</span>
            <span>Tác vụ xuất bản theo lịch chỉ đăng đúng bản đã duyệt và chạy lặp an toàn.</span>
          </p>
        </section>

        <aside className="space-y-5">
          <section className="card p-5" id="len-lich">
            <h2 className="mb-4 text-xl font-bold">Chi tiết lịch đăng</h2>
            {canSchedule ? (
              <ActionForm action={scheduleFromCalendar} submitLabel="Lưu lịch" buttons={<button className="btn-primary w-full">Lưu lịch</button>}>
                <div className="space-y-4">
                  <div><label htmlFor="cal-id" className="mb-1.5 block font-semibold">Bài viết</label>
                    <select id="cal-id" name="id" defaultValue={sp.article ?? ""} className="input"><option value="">Chọn bài viết đã duyệt</option>{approved.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></div>
                  <div><label htmlFor="cal-date" className="mb-1.5 block font-semibold">Ngày đăng</label><input id="cal-date" type="date" name="date" min={today} className="input" /></div>
                  <div><label htmlFor="cal-time" className="mb-1.5 block font-semibold">Giờ đăng</label><input id="cal-time" type="time" name="time" defaultValue="08:00" className="input" /></div>
                  <div><p className="mb-1.5 font-semibold">Múi giờ</p><p className="input flex items-center gap-2 bg-[#FBFAF8]"><Icon name="globe" /> Việt Nam (UTC+7)</p></div>
                </div>
              </ActionForm>
            ) : <p className="text-sm text-ink-muted">Lên lịch đăng cần vai trò Người duyệt nội dung.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}

function CalCard({ href, title, cover, isSample, badge, meta }: { href: string; title: string | null; cover: string | null; isSample: boolean; badge: React.ReactNode; meta?: string }) {
  return (
    <Link href={href} className="flex gap-3 rounded-xl border border-line bg-white p-2.5 transition hover:border-brand/40 hover:shadow-sm">
      <span className="relative h-[72px] w-[56px] flex-none overflow-hidden rounded-lg bg-[#F1F0EE]">
        {cover ? <Image src={cover} alt="" fill sizes="60px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center text-ink-muted/60"><Icon name="image" /></span>}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-[15px] font-bold leading-snug">{title ?? "(chưa có tiêu đề)"}</span>
        {meta && <span className="mt-0.5 block text-xs text-ink-muted">{meta}</span>}
        <span className="mt-1.5 flex flex-wrap gap-1.5">{isSample && <SampleTag>Bài mẫu</SampleTag>}{badge}</span>
      </span>
    </Link>
  );
}
