# Hướng dẫn cài dự án HULAKO Web Đèn sang máy khác

Repo này chứa **toàn bộ mã nguồn** website + runner AI + SEO Agent. Các file **bí mật không có trong repo** (chủ ý, để an toàn khi repo công khai):

| File / dữ liệu | Có trong repo? | Lấy ở đâu |
|---|---|---|
| Mã nguồn, ảnh minh họa, migration CSDL | ✅ | repo này |
| `.env.local` (mật khẩu admin khi chạy thử trên máy) | ❌ | tự sinh khi chạy `npm run db:seed` |
| `.env.runner` (token để runner/agent nói chuyện với website) | ❌ | chép từ máy cũ bằng USB, **hoặc** tạo token mới (mục 3) |
| `.env.telegram` (token bot Telegram hai chiều) | ❌ | chép từ máy cũ, hoặc lấy token ở @BotFather |
| CSDL thật (Neon), biến bí mật trên Vercel | ❌ | nằm trên Vercel/Neon, không cần chép |
| `node_modules`, `.next`, `logs/`, `.local-db` | ❌ | tự tạo lại |

> ⚠️ Không bao giờ commit `.env.local`, `.env.runner`, khoá Search Console, token Telegram. `.gitignore` đã chặn sẵn.

## 1. Cài phần mềm cần có (máy Windows)

1. **Node.js 22 trở lên** (khuyên dùng 24): https://nodejs.org → bản LTS.
2. **Git**: https://git-scm.com.
3. **Claude Desktop** đã đăng nhập tài khoản Claude: chỉ cần nếu máy này chạy AI (runner viết bài + SEO Agent).

## 2. Tải dự án và chạy thử trên máy

```powershell
git clone https://github.com/daovanhuy08-HLK/hulako-web-den.git
cd hulako-web-den
npm install
npm run db:migrate      # tạo CSDL thử trong thư mục .local-db
npm run db:seed         # dữ liệu minh họa + tài khoản admin (mật khẩu ghi vào .env.local)
npx next dev -p 3200    # mở http://localhost:3200 — quản trị: http://localhost:3200/admin/login
```

Bản chạy thử này dùng CSDL riêng trên máy, **không đụng** website thật.

## 3. Cho máy này chạy AI của website thật (runner + SEO Agent 24/7)

Website thật (Vercel) không gọi AI. Một máy có Claude Desktop sẽ nhận việc và làm. **Chỉ nên có 1 máy làm việc này**: chuyển sang máy mới thì tắt ở máy cũ trước (`npm run ai:stop` và `npm run agent:stop`), tránh gửi báo cáo Telegram 2 lần.

Tạo file `.env.runner` trong thư mục dự án:

```
HLK_WEB_API=https://hulako-web-den.vercel.app
HLK_RUNNER_TOKEN=<giá trị RUNNER_TOKEN>
AI_MODEL=sonnet
AI_DAILY_LIMIT=40
AGENT_DAILY_LIMIT=60
```

`RUNNER_TOKEN` trên Vercel là biến bí mật, không xem lại được. Có 2 cách lấy:
- **Cách 1:** mở file `.env.runner` ở máy cũ, chép dòng `HLK_RUNNER_TOKEN` (chuyển bằng USB hoặc tin nhắn tự gửi cho mình, không đăng lên đâu).
- **Cách 2:** tạo token mới.
  1. Mở PowerShell, chạy `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` để lấy một chuỗi ngẫu nhiên.
  2. Vào Vercel → project `hulako-web-den` → Settings → Environment Variables, sửa `RUNNER_TOKEN` (Production) thành chuỗi đó.
  3. Bấm **Redeploy**.
  4. Dán cùng chuỗi đó vào `.env.runner`. Máy cũ sẽ tự mất quyền.

Kiểm tra rồi bật chạy ngầm:

```powershell
npm run ai:check        # Claude CLI + kết nối website
npm run agent:check     # Claude CLI có tìm kiếm web + website
npm run ai:start        # runner viết bài (pm2, chạy ngầm)
npm run agent:start     # SEO Agent 24/7 (pm2, chạy ngầm)
npx pm2 save            # lưu danh sách để tự bật lại
```

Bot Telegram hai chiều: tạo file `.env.telegram` gồm `TELEGRAM_BOT_TOKEN=...` và `TELEGRAM_ADMIN_CHAT_ID=...`, rồi chạy `npm run bot:check` và `npm run bot:start`. Chỉ 1 máy được chạy bot, vì Telegram không cho 2 nơi cùng nhận tin.

Để pm2 **tự chạy lại khi bật máy**:
1. Tạo một tác vụ trong Task Scheduler, chạy lúc đăng nhập Windows.
2. Lệnh chạy: `npx pm2 resurrect`, đặt trong thư mục dự án.
3. Chọn chế độ ẩn cửa sổ.

Xem log: `npm run ai:logs`, `npm run agent:logs`.

## 4. (Tuỳ chọn) Tự deploy một bản website riêng

1. Tạo project trên Vercel, import repo này.
2. Build Command: `npm run vercel-build`.
3. Gắn **Neon Postgres** (tích hợp Vercel, tự có `DATABASE_URL`).
4. Đặt các biến trên Vercel, môi trường Production. Các biến đánh dấu (bí mật) đặt dạng Sensitive:

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL website, vd `https://ten-ban.vercel.app` |
| `SESSION_SECRET`, `CRON_SECRET`, `RUNNER_TOKEN` | Chuỗi ngẫu nhiên ≥ 32 ký tự (bí mật) |
| `SETUP_TOKEN` | Chuỗi ngẫu nhiên, dùng 1 lần để đặt mật khẩu admin ở `/admin/setup?token=...`, xong thì xoá |
| `SEED_ADMIN_EMAIL` | Email tài khoản admin đầu tiên |
| `SEED_DEMO_PUBLIC=1` | Lần build đầu công khai dữ liệu minh họa |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` | Bot báo cáo (bí mật) |
| `GSC_SITE_URL`, `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` | Search Console bằng service account (khoá: bí mật) |
| `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM` | Email thông báo (tuỳ chọn) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob cho ảnh tải lên (tuỳ chọn) |
| `INDEXNOW_KEY` | Tuỳ chọn; không đặt thì website tự sinh |

Lịch cron đã khai báo trong `vercel.json`. Đọc thêm `README.md` (kiến trúc) và `CHANGELOG.md` (đã làm tới đâu).
