#!/usr/bin/env node
// HULAKO SEO Agent — chạy 24/7 TRÊN MÁY bạn (pm2 "hulako-seo-agent"), dùng Claude CLI của Claude Desktop (không API key)
// có công cụ TÌM KIẾM + ĐỌC WEB. Kết quả gửi về website qua /api/agent/* (RUNNER_TOKEN), website báo Telegram.
//
// Lịch mặc định (giờ VN, đổi giờ đề xuất/báo cáo ở Quản trị › AI SEO › Agent trên máy):
//   mỗi 4 giờ   trends    Xu hướng 24–72h: Google Trends VN + tin ngành → từ khoá "trend"; xu hướng mạnh → Telegram
//   01:30       research  R&D 7 nhóm từ khoá (siêu rộng, dài, ngành, sản phẩm, ngắn, địa lý, trend) + gợi ý tìm kiếm thật
//   02:30       spy       Theo dõi sitemap đối thủ → trang mới/sửa → đọc cấu trúc → đề xuất viết/sửa/kéo traffic → Telegram
//   06:00       refresh   Gom + chấm điểm lại từ khoá theo số liệu Search Console mới nhất
//   planTime    plan      Chọn 5–20 bài/ngày → DECODE cấu trúc bài top cho các bài sẽ viết → website giao AI viết nháp → Telegram
//   reportTime  report    Báo cáo thứ hạng từ khoá & tối ưu → Telegram
//
// An toàn: Claude chỉ được dùng WebSearch/WebFetch (không chạy lệnh, không đọc/ghi file), thư mục tạm trống, không lưu phiên.
// Đọc web lịch sự: tôn trọng robots.txt, giãn cách ≥ 2 giây/host, chỉ lưu CẤU TRÚC bài (tiêu đề, mục), không chép nội dung.
// Bài viết chỉ là BẢN NHÁP — người duyệt kiểm tra và xuất bản.
//
// Tham số: --check (kiểm tra kết nối) · --run <việc> (chạy 1 việc rồi thoát: trends|research|spy|refresh|plan|report)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { hostname } from 'node:os';
import { askClaude, AuthError, LimitError, loadEnvRunner, findClaudeBin } from './lib/claude.mjs';
import { autocomplete, googleTrendsVN, parseArticle, politeFetch, sitemapUrls } from './agent/web.mjs';

loadEnvRunner();
const API = (process.env.HLK_WEB_API ?? 'https://hulako-web-den.vercel.app').replace(/\/$/, '');
const TOKEN = process.env.HLK_RUNNER_TOKEN ?? '';
const MODEL = process.env.AGENT_MODEL ?? process.env.AI_MODEL ?? 'sonnet';
const DAILY_LIMIT = Number(process.env.AGENT_DAILY_LIMIT ?? 60); // số lượt gọi Claude tối đa/ngày của agent (runner viết bài có hạn mức riêng)
const HOST = `${hostname()}-seo-agent`.replace(/[^\w.:-]/g, '');
const STATE_FILE = new URL('../logs/seo-agent-state.json', import.meta.url);
mkdirSync(new URL('../logs/', import.meta.url), { recursive: true });

const log = (...a) => console.log(new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), '·', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vnNow = () => new Date(Date.now() + 7 * 3600_000); // dùng getUTC* để đọc giờ VN
const vnDay = () => vnNow().toISOString().slice(0, 10);
const vnHM = () => vnNow().toISOString().slice(11, 16);

// ───────── trạng thái cục bộ (lần chạy cuối, số lượt Claude hôm nay) ─────────
let state = { last: {}, calls: { day: '', n: 0 } };
try { state = { ...state, ...JSON.parse(readFileSync(STATE_FILE, 'utf8')) }; } catch { /* lần đầu */ }
const saveState = () => { try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch { /* bỏ qua */ } };

async function claude(opts) {
  if (state.calls.day !== vnDay()) state.calls = { day: vnDay(), n: 0 };
  if (state.calls.n >= DAILY_LIMIT) throw new LimitError(`Đã dùng hết ${DAILY_LIMIT} lượt Claude hôm nay (AGENT_DAILY_LIMIT)`);
  state.calls.n++; saveState();
  return askClaude({ model: MODEL, entry: 'hulako-seo-agent', timeoutMs: 12 * 60_000, ...opts });
}

async function api(method, path, body) {
  const res = await fetch(`${API}/api/agent/${path}`, {
    method, headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, 'x-agent-host': HOST },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  if (res.status === 401) throw new AuthError('Website từ chối token (401) — kiểm tra HLK_RUNNER_TOKEN trong .env.runner');
  if (!res.ok) throw new Error(`API ${path} ${res.status}: ${json?.message ?? JSON.stringify(json).slice(0, 200)}`);
  return json;
}

let ctxCache = null;
async function context(fresh = false) {
  if (!fresh && ctxCache && Date.now() - ctxCache.at < 10 * 60_000) return ctxCache.data;
  const data = await api('GET', 'context');
  ctxCache = { at: Date.now(), data };
  return data;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sys = (ctx, role) => `${ctx.brand}\n\nVAI TRÒ HIỆN TẠI: ${role}\nNgành: ${ctx.config.industry}. Thị trường: Việt Nam, tiếng Việt có dấu.\nTrả lời đúng JSON schema. Không bịa số liệu (lượng tìm kiếm, thứ hạng): không chắc thì để null hoặc ghi "chưa có dữ liệu".`;
const KINDS = ['sieu-rong', 'dai', 'nganh', 'san-pham', 'ngan', 'dia-ly', 'trend'];
const kwSchema = (max) => ({
  type: 'object', required: ['keywords'],
  properties: { keywords: { type: 'array', maxItems: max, items: {
    type: 'object', required: ['query', 'kind', 'intent', 'cluster', 'note'],
    properties: {
      query: { type: 'string', description: 'Truy vấn tiếng Việt có dấu, đúng như người dùng gõ' },
      kind: { type: 'string', enum: KINDS }, intent: { type: 'string', enum: ['rong', 'sau', 'san-pham', 'xu-ly-loi', 'xu-huong'] },
      cluster: { type: 'string' }, note: { type: 'string', description: 'Vì sao từ khoá này có khả năng ra KHÁCH HÀNG cho HULAKO (1 câu)' },
      trendScore: { type: ['number', 'null'] },
    } } } },
});

// ═════════════ 1. XU HƯỚNG 24–72h ═════════════
async function jobTrends() {
  const ctx = await context();
  const trends = await googleTrendsVN().catch(() => []);
  const out = await claude({
    tools: ['WebSearch'], effort: 'medium',
    system: sys(ctx, 'Chuyên viên nghiên cứu xu hướng tìm kiếm.'),
    schema: {
      type: 'object', required: ['trends'],
      properties: { trends: { type: 'array', maxItems: 8, items: {
        type: 'object', required: ['trend', 'relevance', 'why', 'keywords', 'angle'],
        properties: {
          trend: { type: 'string' }, relevance: { type: 'number', description: '0–100: mức liên quan tới khách của HULAKO' },
          why: { type: 'string' }, angle: { type: 'string', description: 'Góc bài HULAKO có thể viết ngay (dạy trước, bán sau)' },
          keywords: { type: 'array', maxItems: 6, items: { type: 'string' } }, source: { type: 'string' },
        } } } },
    },
    user: [
      'Nhiệm vụ: tìm XU HƯỚNG TÌM KIẾM 24–72 GIỜ QUA có thể kéo khách cho HULAKO.',
      '1) Xem danh sách Google Trends Việt Nam bên dưới, giữ lại xu hướng có liên quan (kể cả liên quan gián tiếp: mùa sale 11.11/12.12/Tết, chính sách TikTok Shop/Shopee, người nổi tiếng livestream bán hàng, sự kiện thương mại điện tử...).',
      '2) Dùng WebSearch tìm tin 72 giờ gần nhất về: livestream bán hàng, TikTok Shop, Shopee Live, thiết bị quay/ánh sáng, thương mại điện tử Việt Nam.',
      '3) Chỉ trả về xu hướng có thật (có nguồn). Không có gì liên quan thì trả mảng rỗng.',
      `Google Trends VN hiện tại:\n${JSON.stringify(trends)}`,
    ].join('\n\n'),
  });
  const list = (out.trends ?? []).filter((t) => t.relevance >= 40);
  const items = list.flatMap((t) => t.keywords.map((k) => ({ query: k, kind: 'trend', intent: 'xu-huong', cluster: 'xu-huong', trendScore: t.relevance, note: `${t.trend}: ${t.why}`.slice(0, 380) })));
  const saved = items.length ? await api('POST', 'keywords', { items, source: 'agent_trends' }) : { added: 0 };
  const hot = list.filter((t) => t.relevance >= 75);
  await api('POST', 'insight', {
    kind: 'trend', title: `${list.length} xu hướng liên quan`, data: { trends: list },
    ...(hot.length ? { telegram: [`🔥 <b>Xu hướng nóng liên quan ngành (24–72h)</b>`, ...hot.map((t) => `• <b>${esc(t.trend)}</b> (${Math.round(t.relevance)}/100)\n  ↳ Góc bài: ${esc(t.angle)}\n  🔑 ${esc(t.keywords.slice(0, 3).join(', '))}`), 'Agent sẽ đưa vào đề xuất bài sáng mai (hoặc bấm “Chạy kế hoạch” trong admin để viết ngay).'].join('\n') } : {}),
  });
  return `${list.length} xu hướng liên quan, ${hot.length} nóng, +${saved.added} từ khoá`;
}

// ═════════════ 2. R&D TỪ KHOÁ 7 NHÓM ═════════════
async function jobResearch() {
  const ctx = await context(true);
  const seeds = ctx.config.seeds.slice(0, 10);
  const mods = ['', ' loại nào tốt', ' giá', ' cho', ' cách', ' bị'];
  const sug = new Set();
  for (const s of seeds) for (const m of mods) for (const x of await autocomplete(`${s}${m}`)) sug.add(x);
  for (const r of ctx.config.regions.slice(0, 3)) for (const x of await autocomplete(`${seeds[0]} ${r}`)) sug.add(x);
  const existing = new Set(ctx.keywords.map((k) => k.q.toLowerCase()));
  const out = await claude({
    tools: ['WebSearch'], effort: 'medium',
    system: sys(ctx, 'Trưởng nhóm R&D từ khoá SEO, mục tiêu: từ khoá RA KHÁCH HÀNG chứ không chỉ ra lượt xem.'),
    schema: kwSchema(80),
    user: [
      'Nhiệm vụ: nghiên cứu 50–80 từ khoá MỚI (chưa có trong danh sách hiện có), chia đủ 7 nhóm, mỗi nhóm ≥ 5:',
      '- sieu-rong: chủ đề người mua tiềm năng tìm nhưng KHÔNG nói thẳng về đèn (vd: cách bán hàng online hiệu quả, mở shop TikTok, kịch bản livestream, quay video sản phẩm bằng điện thoại).',
      '- dai: câu dài, cụ thể, nhiều ý định (vd: cách setup đèn livestream trong phòng ngủ 10m2).',
      '- nganh: thuật ngữ ngành ánh sáng/livestream/studio.',
      '- san-pham: tên/loại sản phẩm + thuộc tính (softbox 50x70, đèn led bảng, chân đèn 2m1...).',
      '- ngan: 1–3 từ, lượng tìm cao, cạnh tranh mạnh.',
      `- dia-ly: kèm địa danh (${ctx.config.regions.join(', ')}) hoặc "gần đây".`,
      '- trend: đang lên theo mùa/sự kiện (sale lớn, Tết, chính sách sàn).',
      'Ưu tiên từ khoá có trong GỢI Ý TÌM KIẾM THẬT bên dưới (người dùng đã gõ). Có thể dùng WebSearch để kiểm tra người ta thật sự tìm và nội dung đang có.',
      `Gợi ý tìm kiếm thật từ Google:\n${JSON.stringify([...sug].slice(0, 200))}`,
      `Từ khoá đã có (đừng lặp lại):\n${JSON.stringify(ctx.keywords.slice(0, 400).map((k) => k.q))}`,
      `Truy vấn đang có hiển thị trên Google (Search Console):\n${JSON.stringify(ctx.gsc.slice(0, 60))}`,
    ].join('\n\n'),
  });
  const items = (out.keywords ?? []).filter((k) => !existing.has(k.query.toLowerCase()));
  const r = await api('POST', 'keywords', { items, source: 'agent_research' });
  const byKind = Object.fromEntries(KINDS.map((k) => [k, items.filter((x) => x.kind === k).length]));
  await api('POST', 'insight', { kind: 'research', title: `R&D ${items.length} từ khoá`, data: { byKind, suggestions: sug.size } });
  return `+${r.added} từ khoá mới (${Object.entries(byKind).map(([k, n]) => `${k}:${n}`).join(' ')}), ${sug.size} gợi ý thật`;
}

// ═════════════ 3. SPY ĐỐI THỦ ═════════════
async function jobSpy() {
  const ctx = await context(true);
  const active = ctx.competitors.filter((c) => c.status === 'active').slice(0, 10);
  const suggested = ctx.competitors.filter((c) => c.status === 'suggested');
  if (!active.length) return `Chưa bật theo dõi đối thủ nào (${suggested.length} gợi ý chờ duyệt trong admin)`;
  const changes = [];
  for (const c of active) {
    try {
      const urls = await sitemapUrls(c.domain, { max: 3000 });
      if (!urls.length) { await api('POST', 'competitor-error', { domain: c.domain, error: 'Không đọc được sitemap' }); continue; }
      const diff = await api('POST', 'competitor-diff', { domain: c.domain, urls });
      if (diff.baseline || !diff.changed?.length) { log(`  ${c.domain}: ${diff.note}`); continue; }
      const pages = [];
      for (const url of diff.changed.slice(0, 12)) {
        try { const p = await politeFetch(url); const a = parseArticle(p.text, url); pages.push({ ...a, lastmod: urls.find((u) => u.url === url)?.lastmod ?? null }); }
        catch (e) { log(`  bỏ qua ${url}: ${e.message}`); }
      }
      if (pages.length) {
        await api('POST', 'competitor-pages', { domain: c.domain, pages: pages.map((p) => ({ url: p.url, title: p.title, lastmod: p.lastmod, hash: p.hash, wordCount: p.wordCount, headings: p.headings })) });
        changes.push({ domain: c.domain, pages: pages.map((p) => ({ url: p.url, title: p.title, wordCount: p.wordCount, headings: p.headings.slice(0, 15), schema: p.schemaTypes })) });
      }
    } catch (e) {
      await api('POST', 'competitor-error', { domain: c.domain, error: e.message }).catch(() => null);
    }
  }
  if (!changes.length) return `Theo dõi ${active.length} đối thủ — chưa có trang mới/sửa`;
  const out = await claude({
    tools: [], effort: 'medium',
    system: sys(ctx, 'Chuyên viên phân tích đối thủ SEO.'),
    schema: {
      type: 'object', required: ['summary', 'actions'],
      properties: {
        summary: { type: 'string', description: 'Đối thủ đang làm gì (2–4 câu)' },
        actions: { type: 'array', maxItems: 8, items: { type: 'object', required: ['type', 'title', 'keyword', 'why'], properties: {
          type: { type: 'string', enum: ['viet-bai', 'sua-bai', 'keo-traffic'] }, title: { type: 'string' }, keyword: { type: 'string' },
          why: { type: 'string' }, ourUrl: { type: ['string', 'null'], description: 'URL bài của mình cần sửa (nếu type sua-bai)' },
        } } },
      },
    },
    user: [
      'Đối thủ vừa đăng mới/sửa các trang dưới đây (chỉ có cấu trúc: tiêu đề, mục H2/H3, số chữ). Phân tích họ đang nhắm từ khoá/chủ đề gì, rồi đề xuất việc cho HULAKO:',
      '- viet-bai: chủ đề mình chưa có; - sua-bai: bài mình đã có nhưng kém hơn (chỉ ra bài); - keo-traffic: cách giành lượt tìm kiếm đó (góc khác biệt, công cụ, video, FAQ, liên kết nội bộ).',
      'Không đề xuất sao chép nội dung của đối thủ.',
      `Thay đổi của đối thủ:\n${JSON.stringify(changes)}`,
      `Bài của HULAKO hiện có:\n${JSON.stringify(ctx.articles.map((a) => ({ title: a.title, url: a.url, keyword: a.keyword })))}`,
    ].join('\n\n'),
  });
  const icon = { 'viet-bai': '✍️', 'sua-bai': '🛠', 'keo-traffic': '🧲' };
  await api('POST', 'keywords', { items: out.actions.filter((a) => a.keyword).map((a) => ({ query: a.keyword, kind: '', note: `Spy đối thủ: ${a.why}` })), source: 'agent_research' });
  await api('POST', 'insight', {
    kind: 'spy', title: `${changes.reduce((n, c) => n + c.pages.length, 0)} trang đối thủ mới/sửa`, data: { changes, ...out },
    telegram: [
      '🕵️ <b>Spy đối thủ</b>',
      ...changes.map((c) => `• <b>${esc(c.domain)}</b>: ${c.pages.length} trang mới/sửa — ${esc(c.pages.slice(0, 2).map((p) => p.title).join(' | '))}`),
      '', esc(out.summary), '', '<b>Đề xuất cho HULAKO</b>',
      ...out.actions.map((a) => `${icon[a.type] ?? '•'} ${esc(a.title)} <i>(${esc(a.keyword)})</i>\n   ↳ ${esc(a.why)}`),
    ].join('\n'),
  });
  return `${changes.length} đối thủ có thay đổi, ${out.actions.length} đề xuất`;
}

// ═════════════ 4. DECODE bài top cho 1 từ khoá ═════════════
async function decodeKeyword(ctx, keyword) {
  const serp = await claude({
    tools: ['WebSearch'], effort: 'low',
    system: 'Bạn tra cứu kết quả tìm kiếm. Chỉ trả JSON.',
    schema: { type: 'object', required: ['results'], properties: { results: { type: 'array', maxItems: 10, items: { type: 'object', required: ['url', 'title'], properties: { url: { type: 'string' }, title: { type: 'string' } } } } } },
    user: `Dùng WebSearch tìm (người dùng Google tại Việt Nam, tiếng Việt): "${keyword}". Trả về tối đa 10 kết quả tự nhiên đứng đầu, đúng thứ tự, kèm URL và tiêu đề. Không bịa URL.`,
  });
  const results = (serp.results ?? []).filter((r) => /^https?:\/\//.test(r.url));
  const pages = [];
  for (const r of results) {
    if (pages.length >= 5) break;
    if (/shopee|lazada|tiki|tiktok\.com|facebook|youtube|instagram/.test(r.url) || r.url.includes(ctx.host)) continue;
    try { const p = await politeFetch(r.url); const a = parseArticle(p.text, r.url); if (a.wordCount > 200) pages.push(a); } catch { /* trang chặn hoặc lỗi: bỏ */ }
  }
  let decode = { note: 'Không đọc được bài nào trong top' };
  if (pages.length) {
    decode = await claude({
      tools: [], effort: 'low',
      system: sys(ctx, 'Chuyên viên phân tích cấu trúc nội dung SEO (decode).'),
      schema: {
        type: 'object', required: ['searchIntent', 'avgWords', 'commonSections', 'questions', 'formats', 'contentGaps', 'recommendedOutline', 'titlePatterns'],
        properties: {
          searchIntent: { type: 'string' }, avgWords: { type: 'number' },
          commonSections: { type: 'array', items: { type: 'string' }, description: 'Các mục hầu hết bài top đều có' },
          questions: { type: 'array', items: { type: 'string' }, description: 'Câu hỏi người đọc mà bài top trả lời' },
          formats: { type: 'array', items: { type: 'string' }, description: 'Định dạng: bảng so sánh, các bước, FAQ, video, ảnh minh hoạ…' },
          contentGaps: { type: 'array', items: { type: 'string' }, description: 'Điều các bài top còn thiếu mà HULAKO có thể làm tốt hơn' },
          recommendedOutline: { type: 'array', items: { type: 'string' }, description: 'Dàn ý H2/H3 đề xuất cho HULAKO (cấu trúc, KHÔNG chép câu chữ)' },
          titlePatterns: { type: 'array', items: { type: 'string' } },
        },
      },
      user: [
        `Từ khoá: "${keyword}". Dưới đây là CẤU TRÚC (tiêu đề, mục H2/H3, số chữ, schema) của các bài đứng đầu. Hãy decode: họ trả lời ý định tìm kiếm thế nào, mục nào bắt buộc, câu hỏi nào, định dạng nào, còn thiếu gì; rồi đề xuất dàn ý cho bài HULAKO — nội dung sẽ viết mới hoàn toàn.`,
        JSON.stringify(pages.map((p) => ({ url: p.url, title: p.title, h1: p.h1, wordCount: p.wordCount, headings: p.headings.slice(0, 30), questions: p.questions, tables: p.tables, lists: p.lists, images: p.images, videos: p.videos, schema: p.schemaTypes }))),
      ].join('\n\n'),
    });
    decode.analyzedUrls = pages.map((p) => p.url);
  }
  await api('POST', 'serp', { keyword, results, decode });
  return { decode, urls: results.map((r) => r.url) };
}

// ═════════════ 5. KẾ HOẠCH 5–20 BÀI/NGÀY ═════════════
async function jobPlan() {
  if (state.last.research?.slice(0, 10) !== vnDay()) await runJob('research'); // chưa R&D hôm nay thì làm trước
  const ctx = await context(true);
  const { proposalsMin: min, proposalsMax: max, autoWritePerDay } = ctx.config;
  const fresh = ctx.keywords.filter((k) => k.status === 'new').slice(0, 300);
  const out = await claude({
    tools: [], effort: 'medium',
    system: sys(ctx, 'Trưởng ban biên tập SEO lập kế hoạch bài viết trong ngày.'),
    schema: {
      type: 'object', required: ['summary', 'proposals'],
      properties: {
        summary: { type: 'string', description: 'Tóm tắt 2–3 câu: hôm nay nên tập trung gì và vì sao' },
        proposals: { type: 'array', minItems: Math.min(min, 5), maxItems: max, items: {
          type: 'object', required: ['keyword', 'kind', 'title', 'angle', 'why', 'priority', 'type'],
          properties: {
            keyword: { type: 'string' }, kind: { type: 'string', enum: KINDS }, title: { type: 'string', description: 'Tiêu đề bài đề xuất' },
            angle: { type: 'string', description: 'Góc viết khác biệt của HULAKO' }, why: { type: 'string', description: 'Vì sao bài này có thể ra khách' },
            priority: { type: 'number', description: '0–100' }, type: { type: 'string', enum: ['new', 'update'] },
            updateUrl: { type: ['string', 'null'], description: 'URL bài HULAKO cần cập nhật khi type=update' },
          } } },
      },
    },
    user: [
      `Nhiệm vụ: chọn ${min}–${max} bài viết/cập nhật cho HÔM NAY (số lượng tuỳ chất lượng cơ hội, không ép đủ ${max}).`,
      'Tiêu chí: khả năng RA KHÁCH (ưu tiên ý định mua/giải quyết vấn đề), đa dạng 7 nhóm từ khoá, tận dụng xu hướng nóng, không trùng/ăn thịt từ khoá với bài đã có (nếu đã có bài cùng ý định → đề xuất type=update).',
      'Từ khoá đang có hạng 8–30 trên Google → ưu tiên cập nhật bài tương ứng để lên trang 1.',
      `Từ khoá mới chưa viết:\n${JSON.stringify(fresh.map((k) => ({ q: k.q, kind: k.kind })))}`,
      `Số liệu Google (Search Console 28 ngày):\n${JSON.stringify(ctx.gsc.slice(0, 80))}`,
      `Bài đã có:\n${JSON.stringify(ctx.articles.map((a) => ({ title: a.title, url: a.url, keyword: a.keyword, published: a.published })))}`,
      `Phân tích gần đây của agent (xu hướng, đối thủ):\n${JSON.stringify(ctx.recentInsights ?? [])}`,
    ].join('\n\n'),
  });
  const proposals = (out.proposals ?? []).sort((a, b) => b.priority - a.priority);
  // Decode cấu trúc bài top cho các bài sẽ được AI viết hôm nay (bài mới, ưu tiên cao nhất)
  const toDecode = proposals.filter((p) => p.type === 'new').slice(0, autoWritePerDay);
  for (const p of toDecode) {
    try { const d = await decodeKeyword(ctx, p.keyword); p.decode = d.decode; p.competitorUrls = d.urls.slice(0, 8); log(`  decode "${p.keyword}": ${d.decode.analyzedUrls?.length ?? 0} bài`); }
    catch (e) { if (e instanceof LimitError || e instanceof AuthError) throw e; log(`  decode "${p.keyword}" lỗi: ${e.message}`); }
  }
  const r = await api('POST', 'plan', { proposals, summary: out.summary });
  return `${r.created} đề xuất, AI đang viết ${r.writing} bản nháp, Telegram: ${r.sent ?? 'không gửi'}`;
}

const JOBS = {
  trends: jobTrends,
  research: jobResearch,
  spy: jobSpy,
  refresh: async () => JSON.stringify(await api('POST', 'refresh', {})),
  plan: jobPlan,
  report: async () => { const r = await api('POST', 'report', {}); return r.ok ? 'Đã gửi báo cáo thứ hạng' : `Chưa gửi được: ${r.sent}`; },
};

const running = new Set();
async function runJob(name) {
  if (running.has(name)) return;
  running.add(name);
  const t0 = Date.now();
  log(`▶ ${name}`);
  try {
    const note = await JOBS[name]();
    state.last[name] = new Date(Date.now() + 7 * 3600_000).toISOString(); saveState();
    log(`✓ ${name} (${Math.round((Date.now() - t0) / 1000)}s): ${note}`);
    await api('POST', 'status', { job: name, ok: true, note }).catch(() => null);
  } catch (e) {
    log(`✗ ${name}: ${e.message}`);
    // vẫn đánh dấu đã chạy để không lặp lại liên tục; lần sau theo lịch sẽ thử lại
    state.last[name] = new Date(Date.now() + 7 * 3600_000).toISOString(); saveState();
    await api('POST', 'status', { job: name, ok: false, note: e.message }).catch(() => null);
    if (e instanceof AuthError) throw e;
  } finally { running.delete(name); }
}

/** Việc nào tới giờ? daily: đúng/qua giờ hẹn và hôm nay chưa chạy · every: đủ N giờ từ lần trước */
function dueJobs(cfg) {
  const day = vnDay(), hm = vnHM();
  const ranToday = (j) => state.last[j]?.slice(0, 10) === day;
  const hoursSince = (j) => (state.last[j] ? (Date.now() + 7 * 3600_000 - new Date(state.last[j]).getTime()) / 3600_000 : 1e9);
  const due = [];
  if (hoursSince('trends') >= Math.max(1, cfg.trendsEveryHours)) due.push('trends');
  for (const [j, at] of [['research', '01:30'], ['spy', '02:30'], ['refresh', '06:00'], ['plan', cfg.planTime], ['report', cfg.reportTime]]) {
    if (hm >= at && !ranToday(j)) due.push(j);
  }
  return due;
}

async function check() {
  log(`Claude CLI: ${findClaudeBin()} · model ${MODEL}`);
  const ctx = await context(true);
  log(`Website ${API}: OK · ${ctx.keywords.length} từ khoá · ${ctx.articles.length} bài · ${ctx.competitors.length} đối thủ · đề xuất lúc ${ctx.config.planTime}, báo cáo lúc ${ctx.config.reportTime}`);
  const t = await claude({ tools: ['WebSearch'], effort: 'low', system: 'Chỉ trả JSON.', user: 'Dùng WebSearch tìm "HULAKO đèn livestream" và trả về số kết quả tìm được.', schema: { type: 'object', required: ['count'], properties: { count: { type: 'number' } } } });
  log(`Claude CLI có tìm kiếm web: OK (${t.count} kết quả)`);
}

async function main() {
  if (!TOKEN) { log('Thiếu HLK_RUNNER_TOKEN (đặt trong file .env.runner).'); process.exitCode = 2; return; }
  if (process.argv.includes('--check')) { await check(); return; }
  const one = process.argv[process.argv.indexOf('--run') + 1];
  if (process.argv.includes('--run')) { if (!JOBS[one]) { log(`Không có việc "${one}". Chọn: ${Object.keys(JOBS).join(', ')}`); return; } await runJob(one); return; }
  log(`SEO Agent bắt đầu · ${API} · model ${MODEL} · tối đa ${DAILY_LIMIT} lượt Claude/ngày`);
  for (;;) {
    try {
      const poll = await api('GET', 'ping'); // nhẹ: cấu hình + lệnh "chạy ngay" từ trang quản trị
      for (const c of poll.commands ?? []) if (JOBS[c.job]) { ctxCache = null; await runJob(c.job); }
      if (poll.config?.enabled) for (const j of dueJobs(poll.config)) await runJob(j);
    } catch (e) {
      if (e instanceof AuthError) { log(`DỪNG: ${e.message}`); process.exitCode = 2; return; }
      log(`Lỗi vòng lặp: ${e.message}`);
    }
    await sleep(60_000); // kiểm tra lịch mỗi phút
  }
}

main().catch((e) => { log(`Lỗi: ${e.message}`); process.exitCode = 1; });
