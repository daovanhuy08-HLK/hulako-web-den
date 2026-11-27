#!/usr/bin/env node
// Bot Telegram HAI CHIỀU cho @ceotopbot_bot (BT AI AGENT CEO TOP GOOGLE) — chạy 24/7 trên máy (pm2 "hulako-seo-bot").
//
//   • Gõ LỆNH  → chạy đúng pipeline SEO Agent (cùng hàng lệnh với nút "Chạy ngay" trong quản trị), bot báo lại khi xong.
//   • Nhắn THƯỜNG (bất kỳ câu gì) → AI trả lời bằng Claude CLI của Claude Desktop (không API key), có số liệu SEO thật
//     của website + DNA HULAKO, được phép tìm/đọc web khi cần. Nhớ 12 tin gần nhất của cuộc trò chuyện.
//   • Chỉ phục vụ chat của chủ website (TELEGRAM_ADMIN_CHAT_ID + BOT_ALLOWED_CHAT_IDS). Người lạ: từ chối, không tốn AI.
//
// Cấu hình: file .env.telegram (không commit) hoặc biến môi trường:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, BOT_ALLOWED_CHAT_IDS (tuỳ chọn, cách nhau dấu phẩy), BOT_DAILY_LIMIT (mặc định 80)
// Dùng chung .env.runner (HLK_WEB_API, HLK_RUNNER_TOKEN) để gọi /api/agent/*.
// Tham số: --check (kiểm tra token + website rồi thoát)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { askClaude, AuthError, LimitError, loadEnvRunner } from './lib/claude.mjs';

loadEnvRunner();
try {
  for (const line of readFileSync(new URL('../.env.telegram', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* không có file */ }

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TG = `https://api.telegram.org/bot${TOKEN}`;
const API = (process.env.HLK_WEB_API ?? 'https://hulako-web-den.vercel.app').replace(/\/$/, '');
const RUNNER_TOKEN = process.env.HLK_RUNNER_TOKEN ?? '';
const ALLOWED = new Set([process.env.TELEGRAM_ADMIN_CHAT_ID, ...(process.env.BOT_ALLOWED_CHAT_IDS ?? '').split(',')].map((x) => String(x ?? '').trim()).filter(Boolean));
const DAILY_LIMIT = Number(process.env.BOT_DAILY_LIMIT ?? 80);
const MODEL = process.env.BOT_MODEL ?? process.env.AI_MODEL ?? 'sonnet';
const STATE_FILE = new URL('../logs/telegram-bot-state.json', import.meta.url);
mkdirSync(new URL('../logs/', import.meta.url), { recursive: true });

const log = (...a) => console.log(new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), '·', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const vnDay = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

let state = { offset: 0, history: {}, calls: { day: '', n: 0 } };
try { state = { ...state, ...JSON.parse(readFileSync(STATE_FILE, 'utf8')) }; } catch { /* lần đầu */ }
const save = () => { try { writeFileSync(STATE_FILE, JSON.stringify(state)); } catch { /* bỏ qua */ } };

// ───────── Telegram ─────────
async function tg(method, body, timeoutMs = 20_000) {
  const res = await fetch(`${TG}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description ?? res.status}`);
  return j.result;
}
/** Gửi tin (HTML), tự cắt nhỏ nếu quá 4000 ký tự; HTML lỗi thì gửi lại dạng chữ thường */
async function send(chatId, html, replyTo) {
  const parts = [];
  for (let s = String(html); s.length; ) { let cut = s.length > 3900 ? s.lastIndexOf('\n', 3900) : s.length; if (cut < 1000) cut = Math.min(3900, s.length); parts.push(s.slice(0, cut)); s = s.slice(cut); }
  for (const [i, p] of parts.entries()) {
    const base = { chat_id: chatId, link_preview_options: { is_disabled: true }, ...(i === 0 && replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}) };
    try { await tg('sendMessage', { ...base, text: p, parse_mode: 'HTML' }); }
    catch { await tg('sendMessage', { ...base, text: p.replace(/<[^>]+>/g, '') }).catch((e) => log('Gửi lỗi:', e.message)); }
  }
}
const typing = (chatId) => tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => null);

// ───────── Website ─────────
async function api(method, path, body) {
  const res = await fetch(`${API}/api/agent/${path}`, {
    method, headers: { 'content-type': 'application/json', authorization: `Bearer ${RUNNER_TOKEN}`, 'x-agent-host': 'telegram-bot' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message ?? `Website ${res.status}`);
  return j;
}

// ───────── Lệnh (pipeline SEO Agent) ─────────
const JOB_CMDS = {
  kehoach: ['plan', 'Lập kế hoạch bài hôm nay (chọn 5–20 bài, decode bài top, AI viết nháp)', '3–8 phút'],
  baocao: ['report', 'Báo cáo thứ hạng từ khoá & tối ưu', 'vài giây'],
  xuhuong: ['trends', 'Quét xu hướng tìm kiếm 24–72h', '1 phút'],
  nghiencuu: ['research', 'R&D từ khoá 7 nhóm', '1–2 phút'],
  doithu: ['spy', 'Spy đối thủ (trang mới/sửa)', 'vài phút'],
  chamdiem: ['refresh', 'Gom + chấm điểm lại từ khoá theo Search Console', 'vài giây'],
};
const ALIASES = { plan: 'kehoach', report: 'baocao', trends: 'xuhuong', research: 'nghiencuu', spy: 'doithu', refresh: 'chamdiem', status: 'trangthai', write: 'viet', help: 'help', start: 'help', tro_giup: 'help', reset: 'quen', moi: 'quen' };

const HELP = [
  '🤖 <b>BT AI AGENT CEO TOP GOOGLE</b>',
  'Nhắn bất kỳ câu gì: hỏi về SEO, từ khoá, bài viết, số liệu website, ý tưởng nội dung… AI trả lời dựa trên số liệu thật của web HULAKO.',
  '',
  '<b>Lệnh chạy pipeline</b>',
  ...Object.entries(JOB_CMDS).map(([c, [, d, t]]) => `/${c} — ${d} (~${t})`),
  '/viet &lt;từ khoá&gt; — AI viết bản nháp cho 1 từ khoá (vd: /viet đèn livestream cho phòng nhỏ)',
  '/trangthai — Agent, runner, hàng đợi, bài chờ duyệt',
  '/quen — Xoá trí nhớ cuộc trò chuyện',
  '/help — Danh sách lệnh',
  '',
  'Lệnh tiếng Anh cũng được: /plan /report /trends /research /spy /refresh /status /write',
].join('\n');

/** Chờ agent chạy xong lệnh rồi báo kết quả (agent kiểm tra lệnh mỗi phút; máy phải đang bật) */
async function waitJob(chatId, job, label, sinceIso, replyTo) {
  const deadline = Date.now() + 40 * 60_000;
  while (Date.now() < deadline) {
    await sleep(20_000);
    try {
      const st = await api('GET', 'status');
      const j = st.agent?.jobs?.[job];
      if (j && j.at > sinceIso) {
        const extra = job === 'plan' || job === 'report' ? '\n(Nội dung chi tiết đã gửi ở tin nhắn riêng.)' : '';
        return send(chatId, `${j.ok ? '✅' : '⚠️'} <b>${esc(label)}</b> ${j.ok ? 'xong' : 'lỗi'}:\n${esc(j.note)}${extra}`, replyTo);
      }
    } catch { /* thử lại */ }
  }
  return send(chatId, `⏳ <b>${esc(label)}</b> chưa xong sau 40 phút. Kiểm tra máy có bật và agent đang chạy (/trangthai).`, replyTo);
}

function ago(iso) {
  if (!iso) return 'chưa từng';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'vừa xong' : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`;
}

async function statusText() {
  const s = await api('GET', 'status');
  const jobs = Object.entries(s.agent?.jobs ?? {}).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 6);
  return [
    '📊 <b>Trạng thái</b>',
    `🧠 SEO Agent: ${s.agent?.lastSeen && Date.now() - new Date(s.agent.lastSeen).getTime() < 5 * 60_000 ? '🟢 đang chạy' : `🔴 liên lạc ${ago(s.agent?.lastSeen)}`}`,
    `✍️ Runner viết bài: liên lạc ${ago(s.runner?.lastSeen)} · ${s.queue.waiting} việc đang chờ${s.queue.failed ? ` · ${s.queue.failed} lỗi (3 ngày)` : ''}`,
    `📝 Bài chờ duyệt: <b>${s.draftsToReview}</b>`,
    `⏰ Đề xuất lúc ${s.config.planTime} · báo cáo lúc ${s.config.reportTime} · tự viết ${s.config.autoWritePerDay} bài/ngày`,
    s.pendingCommands?.length ? `📥 Lệnh đang chờ agent: ${s.pendingCommands.map((c) => c.job).join(', ')}` : '',
    '', '<b>Lần chạy gần nhất</b>',
    ...jobs.map(([k, j]) => `${j.ok ? '✓' : '✗'} ${k} — ${ago(j.at)}: ${esc(j.note.slice(0, 120))}`),
    '', `<a href="${API}/admin/seo/agent">Mở Agent SEO</a>`,
  ].filter((x) => x !== '').join('\n');
}

async function handleCommand(chatId, msgId, cmd, arg) {
  const c = ALIASES[cmd] ?? cmd;
  if (c === 'help') return send(chatId, HELP);
  if (c === 'quen') { delete state.history[chatId]; save(); return send(chatId, '🧹 Đã xoá trí nhớ cuộc trò chuyện.', msgId); }
  if (c === 'trangthai') return send(chatId, await statusText(), msgId);
  if (c === 'viet') {
    if (!arg) return send(chatId, 'Gõ kèm từ khoá, vd: <code>/viet cách setup đèn livestream phòng 10m2</code>', msgId);
    const r = await api('POST', 'write', { keyword: arg });
    return send(chatId, r.already
      ? `ℹ️ Từ khoá này đã có bản nháp. <a href="${API}/admin/content/${r.articleId}">Mở bài</a>`
      : `✍️ Đã giao AI viết bản nháp cho “${esc(arg)}”. Runner trên máy sẽ viết trong vài phút, xong bot báo kèm link duyệt (AI không tự đăng).`, msgId);
  }
  const job = JOB_CMDS[c];
  if (!job) return send(chatId, `Không có lệnh /${esc(cmd)}. Gõ /help để xem danh sách.`, msgId);
  const since = new Date().toISOString();
  await api('POST', 'command', { job: job[0], by: `telegram:${chatId}` });
  await send(chatId, `🚀 Đã giao agent: <b>${esc(job[1])}</b> (~${job[2]}). Bot sẽ báo khi xong.`, msgId);
  void waitJob(chatId, job[0], job[1], since, msgId);
}

// ───────── Trả lời tự do bằng AI ─────────
let ctxCache = null;
async function siteBrief() {
  if (ctxCache && Date.now() - ctxCache.at < 15 * 60_000) return ctxCache.data;
  const [ctx, st] = await Promise.all([api('GET', 'context'), api('GET', 'status').catch(() => null)]);
  const byKind = {};
  for (const k of ctx.keywords) if (k.kind) byKind[k.kind] = (byKind[k.kind] ?? 0) + 1;
  const data = {
    brand: ctx.brand,
    data: {
      website: ctx.site, ngay: ctx.today, cauHinhAgent: ctx.config, tuKhoaTheoNhom: byKind, tongTuKhoa: ctx.keywords.length,
      tuKhoaMoiNhat: ctx.keywords.slice(0, 60).map((k) => `${k.q} [${k.kind || '-'}${k.pos ? ` · hạng ${k.pos.toFixed(1)}` : ''}]`),
      searchConsole28Ngay: ctx.gsc.slice(0, 50),
      baiViet: ctx.articles.map((a) => ({ title: a.title, url: a.url, keyword: a.keyword, trangThai: a.published ? 'đã đăng' : a.status })),
      doiThu: ctx.competitors, phanTichGanDay: ctx.recentInsights,
      trangThai: st ? { baiChoDuyet: st.draftsToReview, hangDoi: st.queue, agentLienLac: st.agent?.lastSeen, runnerLienLac: st.runner?.lastSeen } : null,
    },
  };
  ctxCache = { at: Date.now(), data };
  return data;
}

async function aiReply(chatId, text, who) {
  if (state.calls.day !== vnDay()) state.calls = { day: vnDay(), n: 0 };
  if (state.calls.n >= DAILY_LIMIT) return `Hôm nay đã dùng hết ${DAILY_LIMIT} lượt trả lời AI (BOT_DAILY_LIMIT). Các lệnh /kehoach, /baocao… vẫn dùng được.`;
  state.calls.n++; save();
  const b = await siteBrief();
  const hist = (state.history[chatId] ?? []).slice(-12);
  const out = await askClaude({
    model: MODEL, entry: 'hulako-seo-bot', timeoutMs: 6 * 60_000, effort: 'medium', tools: ['WebSearch', 'WebFetch'],
    system: `${b.brand}

VAI TRÒ: Bạn là "BT AI AGENT CEO TOP GOOGLE" — trợ lý SEO & nội dung của HULAKO, trò chuyện với chủ website (${who}) qua Telegram.
- Trả lời mọi câu hỏi/tin nhắn bằng tiếng Việt, ngắn gọn, thực dụng, xưng "em", gọi "anh/chị".
- Câu hỏi về website/SEO: dựa trên DỮ LIỆU THẬT bên dưới; không bịa số liệu (không có thì nói chưa có dữ liệu).
- Cần thông tin bên ngoài (tin tức, đối thủ, xu hướng, kiến thức) thì dùng WebSearch/WebFetch và nêu nguồn ngắn.
- Không có quyền đăng bài, sửa web hay tiêu tiền. Muốn chạy việc thì gợi ý lệnh: /kehoach /baocao /xuhuong /nghiencuu /doithu /chamdiem /viet <từ khoá> /trangthai.
- Nội dung đề xuất cho khách phải theo DNA và luật cấm ở trên (không hứa tăng đơn, doanh số…).
- Định dạng Telegram HTML đơn giản: chỉ dùng <b>, <i>, <code>, <a href="...">; không dùng Markdown, không dùng bảng.

DỮ LIỆU WEBSITE (JSON):
${JSON.stringify(b.data).slice(0, 60_000)}`,
    user: [...hist.map((h) => `${h.role === 'user' ? 'Chủ website' : 'Trợ lý'}: ${h.text}`), `Chủ website: ${text}`].join('\n\n'),
    schema: { type: 'object', required: ['reply'], properties: { reply: { type: 'string', description: 'Câu trả lời gửi Telegram (HTML đơn giản)' } } },
  });
  const reply = String(out.reply ?? '').trim() || 'Em chưa có câu trả lời, anh/chị hỏi lại giúp em nhé.';
  state.history[chatId] = [...hist, { role: 'user', text: text.slice(0, 2000) }, { role: 'bot', text: reply.replace(/<[^>]+>/g, '').slice(0, 2000) }].slice(-12);
  save();
  return reply;
}

// ───────── Xử lý 1 tin nhắn ─────────
async function handle(update) {
  const m = update.message ?? update.edited_message ?? update.channel_post;
  if (!m?.chat) return;
  const chatId = String(m.chat.id);
  const who = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || 'chủ website';
  if (!ALLOWED.has(chatId)) {
    log(`Từ chối chat lạ ${chatId}`);
    return send(chatId, 'Đây là bot nội bộ của HULAKO. Liên hệ hotline 0983 836 664 hoặc https://hulako-web-den.vercel.app để được hỗ trợ.');
  }
  const text = (m.text ?? m.caption ?? '').trim();
  if (!text) {
    const kind = m.photo ? 'ảnh' : m.voice ? 'tin nhắn thoại' : m.sticker ? 'sticker' : m.document ? 'tệp' : m.video ? 'video' : 'tin này';
    return send(chatId, `Em đã nhận ${kind} 👍 nhưng hiện mới đọc được chữ. Anh/chị gõ nội dung (hoặc gửi kèm chú thích) để em trả lời nhé.`, m.message_id);
  }
  const cm = text.match(/^\/([a-z_]+)(?:@\w+)?\s*([\s\S]*)$/i);
  if (cm) return handleCommand(chatId, m.message_id, cm[1].toLowerCase(), cm[2].trim());
  await typing(chatId);
  const keep = setInterval(() => typing(chatId), 4500); // giữ trạng thái "đang soạn tin" trong lúc AI nghĩ
  try { await send(chatId, await aiReply(chatId, text, who), m.message_id); }
  finally { clearInterval(keep); }
}

async function main() {
  if (!TOKEN) { log('Thiếu TELEGRAM_BOT_TOKEN (đặt trong file .env.telegram).'); process.exitCode = 2; return; }
  if (!ALLOWED.size) { log('Thiếu TELEGRAM_ADMIN_CHAT_ID (.env.telegram) — bot sẽ không trả lời ai.'); process.exitCode = 2; return; }
  const me = await tg('getMe', {});
  if (process.argv.includes('--check')) {
    const st = await api('GET', 'status');
    log(`Bot @${me.username} OK · website OK (${st.draftsToReview} bài chờ duyệt) · cho phép ${ALLOWED.size} chat`);
    return;
  }
  await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => null); // dùng long polling, không webhook
  await tg('setMyCommands', { commands: [
    ...Object.entries(JOB_CMDS).map(([c, [, d]]) => ({ command: c, description: d.slice(0, 60) })),
    { command: 'viet', description: 'AI viết bản nháp cho 1 từ khoá' },
    { command: 'trangthai', description: 'Trạng thái agent, runner, bài chờ duyệt' },
    { command: 'quen', description: 'Xoá trí nhớ cuộc trò chuyện' },
    { command: 'help', description: 'Danh sách lệnh' },
  ] }).catch((e) => log('setMyCommands:', e.message));
  log(`Bot @${me.username} bắt đầu nhận tin (long polling) · cho phép ${ALLOWED.size} chat · tối đa ${DAILY_LIMIT} lượt AI/ngày`);
  const busy = new Map(); // mỗi chat xử lý tuần tự, các chat khác không phải chờ
  for (;;) {
    let updates = [];
    try { updates = await tg('getUpdates', { offset: state.offset, timeout: 50, allowed_updates: ['message', 'edited_message'] }, 65_000); }
    catch (e) { log(`getUpdates lỗi: ${e.message}`); await sleep(5000); continue; }
    for (const u of updates) {
      state.offset = u.update_id + 1; save();
      const chat = String((u.message ?? u.edited_message)?.chat?.id ?? '');
      const prev = busy.get(chat) ?? Promise.resolve();
      const next = prev.then(() => handle(u)).catch(async (e) => {
        log(`Lỗi xử lý: ${e.message}`);
        const msg = e instanceof LimitError ? 'Gói Claude đang chạm giới hạn, anh/chị thử lại sau ít phút nhé.'
          : e instanceof AuthError ? 'Claude Desktop trên máy cần đăng nhập lại.' : `Em gặp lỗi: ${esc(e.message.slice(0, 200))}`;
        if (chat) await send(chat, `⚠️ ${msg}`).catch(() => null);
      });
      busy.set(chat, next);
    }
  }
}

main().catch((e) => { log(`Lỗi: ${e.message}`); process.exitCode = 1; });
