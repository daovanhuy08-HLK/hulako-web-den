// Dùng chung cho runner viết bài (tools/ai-runner.mjs) và SEO Agent (tools/seo-agent.mjs):
// gọi Claude CLI đi kèm app Claude Desktop (tài khoản đã đăng nhập) — KHÔNG dùng Anthropic API key.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/** Đọc .env.runner (KEY=VALUE mỗi dòng) cạnh package.json — không ghi đè biến môi trường đã có */
export function loadEnvRunner() {
  try {
    const t = readFileSync(new URL('../../.env.runner', import.meta.url), 'utf8');
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* không có file */ }
}

/** Tìm claude.exe: CLAUDE_BIN → bản đi kèm app Claude Desktop (mới nhất) → bản npm → "claude" trong PATH */
export function findClaudeBin() {
  if (process.env.CLAUDE_BIN && existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const home = homedir();
  const dataDir = join(home, 'AppData/Local/Claude-Data');
  try {
    const found = [];
    for (const a of readdirSync(dataDir)) {
      const cc = join(dataDir, a, 'claude-code');
      if (!existsSync(cc)) continue;
      for (const ver of readdirSync(cc)) for (const h of readdirSync(join(cc, ver))) {
        const exe = join(cc, ver, h, 'claude.exe');
        if (existsSync(exe)) found.push({ path: exe, mtime: statSync(exe).mtimeMs });
      }
    }
    found.sort((x, y) => y.mtime - x.mtime);
    if (found[0]) return found[0].path;
  } catch { /* không có app desktop */ }
  const npmExe = join(home, 'AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe');
  if (existsSync(npmExe)) return npmExe;
  return 'claude';
}

export class LimitError extends Error {}
export class AuthError extends Error {}

function runCli(args, stdin, { cwd, timeoutMs, entry }) {
  const bin = findClaudeBin();
  return new Promise((resolve, reject) => {
    // windowsHide: không bật cửa sổ console đen trên Windows
    const p = spawn(bin, args, { cwd, windowsHide: true, env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: entry } });
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill(); reject(new Error(`Claude CLI quá ${Math.round(timeoutMs / 60000)} phút không trả lời`)); }, timeoutMs);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => { clearTimeout(timer); reject(new Error(`Không chạy được Claude CLI (${bin}): ${e.message}`)); });
    p.on('close', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(out)); } catch { reject(new Error(`Claude CLI trả về không phải JSON: ${(err || out).slice(0, 300)}`)); }
    });
    p.stdin.end(stdin);
  });
}

/**
 * Hỏi Claude, nhận JSON theo schema.
 * tools: [] = không công cụ (mặc định, an toàn nhất) · ['WebSearch','WebFetch'] = cho phép tìm/đọc web (SEO Agent).
 * Không bao giờ bật công cụ chạy lệnh/đọc ghi file. Chạy trong thư mục tạm trống, không lưu phiên.
 */
export async function askClaude({ system, user, schema, effort = 'medium', model = process.env.AI_MODEL ?? 'sonnet', tools = [], timeoutMs = 15 * 60_000, entry = 'hulako-web-ai' }) {
  const safeTools = tools.filter((t) => t === 'WebSearch' || t === 'WebFetch');
  const cwd = join(tmpdir(), entry);
  mkdirSync(cwd, { recursive: true });
  const args = [
    '-p', '--output-format', 'json', '--json-schema', JSON.stringify(schema),
    '--model', model, '--effort', effort,
    '--system-prompt', system, '--tools', safeTools.join(','), '--strict-mcp-config', '--no-session-persistence',
  ];
  if (safeTools.length) args.push('--allowedTools', safeTools.join(','));
  const r = await runCli(args, user, { cwd, timeoutMs, entry });
  const msg = String(r.result ?? '');
  if (r.is_error) {
    if (/authenticat|oauth|login|401/i.test(msg)) throw new AuthError('Claude Desktop CLI chưa đăng nhập hoặc phiên hết hạn — mở app Claude Desktop và đăng nhập lại');
    if (/limit|quota|rate|429|overloaded|529/i.test(msg) || r.api_error_status === 429) throw new LimitError(`Chạm giới hạn gói Claude: ${msg.slice(0, 200)}`);
    throw new Error(`Claude CLI lỗi: ${msg.slice(0, 300)}`);
  }
  let output = r.structured_output;
  if (output === undefined) {
    try { output = JSON.parse(msg.replace(/^```(json)?|```$/g, '').trim()); } catch { throw new Error('Claude CLI không trả về JSON đúng cấu trúc'); }
  }
  return output;
}
