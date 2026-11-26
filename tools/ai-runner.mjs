#!/usr/bin/env node
// HULAKO Web Đèn — Runner AI chạy TRÊN MÁY bạn, dùng Claude CLI đi kèm app Claude Desktop (tài khoản Claude đã đăng nhập).
// KHÔNG dùng Anthropic API key.
//
// Vòng lặp: nhận việc (POST /api/runner/claim) → `claude.exe -p --json-schema ...` → gửi kết quả (/complete) hoặc lỗi (/fail).
// Website kiểm lại kết quả bằng schema + bộ lọc claim DNA rồi mới lưu thành BẢN NHÁP (người duyệt xuất bản).
//
// An toàn:
// - Claude chạy với --tools "" (không công cụ), --strict-mcp-config, --no-session-persistence, trong thư mục tạm trống
//   → AI chỉ trả lời văn bản, không đọc/ghi file, không chạy lệnh trên máy.
// - Token runner chỉ gọi được /api/runner/* (không xem/sửa được dữ liệu khác của website).
//
// Cấu hình (file .env.runner cạnh package.json, hoặc biến môi trường):
//   HLK_WEB_API        URL website (mặc định https://hulako-web-den.vercel.app)
//   HLK_RUNNER_TOKEN   = RUNNER_TOKEN đặt trên Vercel
//   CLAUDE_BIN         đường dẫn claude.exe (bỏ trống = tự tìm bản mới nhất trong app Claude Desktop)
//   AI_MODEL           model Claude CLI (mặc định sonnet)
//   AI_POLL_SEC        chu kỳ hỏi việc khi hết việc (mặc định 30)
//   AI_DAILY_LIMIT     số lượt gọi Claude tối đa/ngày (mặc định 40)
// Tham số: --once (xử lý hết hàng đợi rồi thoát) · --check (kiểm tra Claude CLI + kết nối website)

import { hostname } from 'node:os';
import { askClaude as ask, AuthError, findClaudeBin, LimitError, loadEnvRunner } from './lib/claude.mjs';

loadEnvRunner();

const API = (process.env.HLK_WEB_API ?? 'https://hulako-web-den.vercel.app').replace(/\/$/, '');
const TOKEN = process.env.HLK_RUNNER_TOKEN ?? '';
const MODEL = process.env.AI_MODEL ?? 'sonnet';
const POLL_MS = Math.max(10, Number(process.env.AI_POLL_SEC ?? 30)) * 1000;
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 40);
const RUNNER = `${hostname()}-claude-cli`.replace(/[^\w.:-]/g, '');
const ONCE = process.argv.includes('--once');
const CHECK = process.argv.includes('--check');
const log = (...a) => console.log(new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), '·', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runner viết bài: KHÔNG cho Claude dùng công cụ nào (chỉ trả lời văn bản). Thời gian chờ < 20 phút website trả việc lại hàng đợi.
const askClaude = (o) => ask({ ...o, model: MODEL, tools: [], timeoutMs: 15 * 60_000, entry: 'hulako-web-ai-runner' });

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, 'x-runner-name': RUNNER },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

let callsToday = 0, day = new Date().toDateString(), onceErrors = 0;

async function processOne() {
  if (new Date().toDateString() !== day) { day = new Date().toDateString(); callsToday = 0; }
  if (callsToday >= DAILY_LIMIT) { log(`Đã đủ ${DAILY_LIMIT} lượt gọi Claude hôm nay (AI_DAILY_LIMIT)`); return 'limit'; }
  const c = await api('POST', '/api/runner/claim', {});
  if (c.status === 204) return 'empty';
  if (c.status === 401) throw new AuthError('Website từ chối runner token (401) — kiểm tra HLK_RUNNER_TOKEN trong .env.runner');
  if (c.status !== 200) throw new Error(`Nhận việc lỗi ${c.status}: ${JSON.stringify(c.json).slice(0, 200)}`);
  const job = c.json;
  log(`Nhận việc ${job.id} — ${job.label}`);
  const t0 = Date.now();
  try {
    callsToday++;
    const output = await askClaude({ system: job.system, user: job.user, schema: job.schema, effort: job.effort });
    const done = await api('POST', `/api/runner/jobs/${job.id}/complete`, { output, model: `claude-cli:${MODEL}` });
    if (done.status !== 200) log(`✗ ${job.id}: website không lưu được kết quả (${done.status}) ${done.json?.message ?? ''}`);
    else log(`✓ ${job.id} xong sau ${Math.round((Date.now() - t0) / 1000)}s — ${done.json.summary}`);
    return 'done';
  } catch (e) {
    await api('POST', `/api/runner/jobs/${job.id}/fail`, { error: e.message }).catch(() => {});
    log(`✗ ${job.id}: ${e.message}`);
    if (e instanceof LimitError) return 'limit';
    if (e instanceof AuthError) throw e;
    return 'error';
  }
}

async function check() {
  log(`Claude CLI: ${findClaudeBin()} · model ${MODEL}`);
  const output = await askClaude({ system: 'Chỉ trả về JSON.', user: 'Trả về {"ok": true}', schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } }, effort: 'low' });
  log(`Claude CLI trả lời: ${JSON.stringify(output)}`);
  const s = await api('GET', '/api/runner/ping');
  if (s.status !== 200) throw new Error(`Website ${API} trả ${s.status} — kiểm tra HLK_WEB_API / HLK_RUNNER_TOKEN`);
  log(`Website ${API}: OK, ${s.json.waiting} việc đang chờ runner`);
}

async function main() {
  if (!TOKEN) { log('Thiếu HLK_RUNNER_TOKEN (đặt trong file .env.runner).'); process.exitCode = 2; return; }
  if (CHECK) { await check(); return; }
  log(`AI Runner bắt đầu · website ${API} · Claude CLI ${findClaudeBin()} · model ${MODEL}${ONCE ? ' · --once' : ''}`);
  for (;;) {
    let r;
    try { r = await processOne(); }
    catch (e) {
      if (e instanceof AuthError) { log(`DỪNG: ${e.message}`); process.exitCode = 2; return; }
      log(`Lỗi kết nối: ${e.message}`); r = 'error';
    }
    if (r === 'done') continue;
    if (ONCE && (r === 'empty' || r === 'limit')) { log('Hết việc — thoát (--once)'); return; }
    if (ONCE && r === 'error') { if (++onceErrors > 5) { log('Quá nhiều lỗi — thoát'); process.exitCode = 1; return; } await sleep(3000); continue; }
    await sleep(r === 'limit' ? 60 * 60_000 : r === 'error' ? 60_000 : POLL_MS);
  }
}

main().catch((e) => { log(`Lỗi: ${e.message}`); process.exitCode = 1; });
