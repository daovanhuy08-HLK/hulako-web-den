// Đặt lại mật khẩu tài khoản quản trị khi quên (website chưa cấu hình gửi email "Quên mật khẩu").
//   node tools/set-admin-password.mjs                         → website thật (Neon), tài khoản hulakoofficial@gmail.com
//   node tools/set-admin-password.mjs --email ai@do.vn        → tài khoản khác
//   node tools/set-admin-password.mjs --local [--dir .local-db] → CSDL thử trên máy (PGlite; tắt web dev trước)
// An toàn:
//   - Mật khẩu gõ ẩn (không hiện chữ), không ghi ra file, không in ra màn hình.
//   - DATABASE_URL lấy tạm từ Vercel vào file trong thư mục tạm, đọc xong XOÁ NGAY, không in ra.
//   - Chỉ đổi cột password_hash của đúng 1 tài khoản đang hoạt động + ghi 1 dòng nhật ký audit_logs.
// Mật khẩu băm scrypt đúng định dạng của src/lib/auth-core.ts: scrypt$<salt hex>$<hash hex>.
import { scrypt as _scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const has = (k) => process.argv.includes(k);
const email = (arg('--email') || 'hulakoofficial@gmail.com').trim().toLowerCase();
const LOCAL = has('--local');
const MIN_LEN = 10;

const scrypt = promisify(_scrypt);
async function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

// ---- Gõ mật khẩu ẩn ----
let piped = null; // khi chạy không có bàn phím (thử tự động): đọc các dòng từ stdin
async function readPipedLines() {
  if (piped) return piped;
  let data = '';
  for await (const c of process.stdin) data += c;
  piped = data.split(/\r?\n/);
  return piped;
}
async function askHidden(label) {
  if (!process.stdin.isTTY) { const lines = await readPipedLines(); return (lines.shift() ?? '').trim(); }
  process.stdout.write(label);
  return new Promise((resolve) => {
    let s = '';
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { done(); return; }
        if (c === '\u0003') { process.stdout.write('\nĐã huỷ.\n'); process.exit(1); }
        if (c === '\u0008' || c === '\u007f') { if (s.length) { s = s.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if (c >= ' ') { s += c; process.stdout.write('•'); }
      }
    };
    const done = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', onData); process.stdout.write('\n'); resolve(s); };
    process.stdin.on('data', onData);
  });
}

// ---- Kết nối CSDL ----
function productionUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dir = mkdtempSync(join(tmpdir(), 'hlk-env-'));
  const file = join(dir, 'prod.env');
  try {
    console.log('… Đang lấy địa chỉ CSDL production từ Vercel (không in ra màn hình)');
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['vercel', 'env', 'pull', file, '--environment=production', '--yes'],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], shell: process.platform === 'win32', encoding: 'utf8' });
    if (r.status !== 0 || !existsSync(file)) { console.error('✘ Không lấy được biến môi trường từ Vercel. Đã đăng nhập Vercel CLI chưa (npx vercel login)?'); process.exit(1); }
    const text = readFileSync(file, 'utf8');
    const pick = (k) => { const m = text.match(new RegExp(`^${k}="?([^"\\r\\n]*)"?`, 'm')); return m ? m[1].trim() : ''; };
    const url = pick('DATABASE_URL') || pick('POSTGRES_URL');
    if (!url) { console.error('✘ Vercel không trả giá trị DATABASE_URL (biến có thể để chế độ Sensitive). Chạy lại kèm DATABASE_URL lấy từ Neon.'); process.exit(1); }
    return url;
  } finally {
    rmSync(dir, { recursive: true, force: true }); // xoá ngay file chứa bí mật
  }
}

async function openDb() {
  if (LOCAL) {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(arg('--dir') || join(ROOT, '.local-db'));
    return { query: async (sql, params) => (await db.query(sql, params)).rows, close: () => db.close(), where: 'CSDL thử trên máy' };
  }
  const { default: postgres } = await import('postgres');
  const sql = postgres(productionUrl(), { prepare: false, max: 1 });
  return { query: (q, params) => sql.unsafe(q, params), close: () => sql.end(), where: 'WEBSITE THẬT (Neon)' };
}

// ---- Chạy ----
console.log(`Đặt lại mật khẩu quản trị — tài khoản: ${email}`);
const db = await openDb();
try {
  const [u] = await db.query('select id, status, roles from users where email = $1', [email]);
  if (!u) { console.error(`✘ Không có tài khoản ${email} trong ${db.where}.`); process.exit(1); }
  if (u.status !== 'active') { console.error(`✘ Tài khoản ${email} đang bị khoá (status=${u.status}).`); process.exit(1); }
  console.log(`✔ Tìm thấy tài khoản trên ${db.where}.`);
  console.log(`Mật khẩu mới: ít nhất ${MIN_LEN} ký tự. Khi gõ chỉ hiện dấu •.`);

  const pw = await askHidden('Mật khẩu mới: ');
  if (pw.length < MIN_LEN) { console.error(`✘ Mật khẩu quá ngắn (cần ≥ ${MIN_LEN} ký tự). Chưa đổi gì.`); process.exit(1); }
  const pw2 = await askHidden('Gõ lại lần nữa: ');
  if (pw !== pw2) { console.error('✘ Hai lần gõ không khớp. Chưa đổi gì.'); process.exit(1); }

  const hash = await hashPassword(pw);
  const done = await db.query("update users set password_hash = $1 where id = $2 and status = 'active' returning id", [hash, u.id]);
  if (!done.length) { console.error('✘ Không cập nhật được. Chưa đổi gì.'); process.exit(1); }
  await db.query("insert into audit_logs (user_id, action, entity_type, entity_id, changes) values ($1, 'auth.password_reset_cli', 'user', $2, $3)",
    [u.id, u.id, JSON.stringify({ via: 'tools/set-admin-password.mjs' })]);
  console.log(`✔ Đã đặt mật khẩu mới cho ${email} trên ${db.where}.`);
  console.log(LOCAL ? 'Đăng nhập thử: http://localhost:3200/admin/login' : 'Đăng nhập: https://hulako-web-den.vercel.app/admin/login');
} finally {
  await db.close();
}
