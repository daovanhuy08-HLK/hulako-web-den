# HULAKO Web Đèn — website + AI SEO Agent + vòng học

Website HULAKO (Vua Đèn Lives) dựng lại từ gói **HULAKO_Claude_Vibe_Coding_10_Lo** (đặc tả v1.1 ngày 19/11/2026, 93 ảnh giao diện).

- Next.js 15 (App Router) + TypeScript + Tailwind + Drizzle.
- Dev: PGlite (CSDL Postgres chạy trong máy, thư mục `.local-db`). Production: **Vercel + Neon Postgres** (Singapore).
- Ảnh trong `public/demo/` được cắt từ ảnh thiết kế (ảnh AI) — chỉ là **ảnh minh họa**; mọi bản ghi seed có cờ `isSample` để web hiện nhãn "minh họa". Thay bằng ảnh thật rồi bỏ cờ trong quản trị.

> **Cài sang máy khác:** xem [HUONG-DAN-CAI-DAT.md](HUONG-DAN-CAI-DAT.md) (file bí mật không có trong repo).

## Chạy trên máy

```
npm install
npm run db:migrate      # tạo bảng trong .local-db
npm run db:seed         # dữ liệu minh họa + tài khoản admin (mật khẩu ghi vào .env.local)
npx next dev -p 3200    # http://localhost:3200 — quản trị: /admin/login
npm run typecheck
npm test
```

## Biến môi trường (Vercel → Production)

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Neon (tự gắn qua tích hợp Vercel) |
| `SESSION_SECRET`, `CRON_SECRET`, `SETUP_TOKEN` | Bí mật sinh ngẫu nhiên (sensitive) |
| `NEXT_PUBLIC_SITE_URL` | URL website |
| `SEED_ADMIN_EMAIL` | Email admin đầu tiên — đặt mật khẩu tại `/admin/setup?token=SETUP_TOKEN` |
| `SEED_DEMO_PUBLIC=1` | Lần build đầu công khai dữ liệu minh họa để web giống ảnh thiết kế |
| `RUNNER_TOKEN` | Bật AI Agent qua **Claude CLI của Claude Desktop** (không dùng API key). Cùng giá trị nằm trong `.env.runner` trên máy |
| `GSC_*` | Search Console (service account) — nguồn số liệu tìm kiếm cho vòng học |

## AI chạy qua Claude CLI trên máy (runner)

Website (Vercel) không gọi API AI. Bước cần AI được xếp hàng ("Chờ runner"); runner trên máy nhận việc, gọi `claude.exe` đi kèm app Claude Desktop (tài khoản đã đăng nhập), gửi kết quả về `/api/runner/*`, website kiểm schema + bộ lọc DNA rồi lưu **bản nháp**.

```
npm run ai:check    # kiểm Claude CLI + kết nối website
npm run ai:start    # bật runner chạy ngầm (pm2, không hiện cửa sổ)
npm run ai:logs     # xem log
npm run ai:stop     # tắt
```

Cấu hình ở `.env.runner` (không commit): `HLK_WEB_API`, `HLK_RUNNER_TOKEN`, `AI_MODEL` (mặc định sonnet), `AI_DAILY_LIMIT` (mặc định 40 lượt/ngày). Máy tắt → tác vụ nằm chờ; runner nhận việc quá 20 phút không trả → trả lại hàng chờ; lỗi 3 lần → "Thất bại" ở A09.

## SEO Agent 24/7 trên máy (`tools/seo-agent.mjs`, pm2 `hulako-seo-agent`)

Claude CLI của Claude Desktop **có tìm kiếm + đọc web** (không API key). Kết quả gửi về `/api/agent/*` (token `RUNNER_TOKEN`), website báo Telegram.

| Giờ (VN) | Việc |
|---|---|
| mỗi 4 giờ | Xu hướng 24–72h: Google Trends VN (RSS) + tin ngành → từ khoá `trend`; xu hướng ≥ 75 điểm → Telegram |
| 01:30 | R&D từ khoá 7 nhóm (siêu rộng, dài, ngành, sản phẩm, ngắn, địa lý, trend) + gợi ý tìm kiếm thật của Google |
| 02:30 | Spy đối thủ: sitemap → trang mới/sửa → đọc cấu trúc → đề xuất viết/sửa/kéo traffic → Telegram |
| 06:00 | Gom + chấm điểm lại từ khoá theo Search Console |
| giờ đề xuất (07:30) | Chọn 5–20 bài → decode cấu trúc bài top → AI viết N bản nháp (nội dung mới, **chờ duyệt**) → Telegram |
| giờ báo cáo (20:00) | Báo cáo thứ hạng (Search Console) + tối ưu đề xuất → Telegram |

Đổi giờ, số bài, từ khoá gốc, khu vực, đối thủ: **Quản trị › AI SEO › Agent SEO trên máy** (có nút "Chạy ngay").

```
npm run agent:check          # kiểm tra Claude CLI (có tìm web) + website
npm run agent:run -- plan    # chạy 1 việc: trends | research | spy | refresh | plan | report
npm run agent:start          # bật chạy ngầm 24/7 (pm2)   ·   npm run agent:logs   ·   npm run agent:stop
```
Biến trong `.env.runner`: `AGENT_DAILY_LIMIT` (lượt Claude/ngày của agent, mặc định 60), `AGENT_MODEL` (mặc định theo `AI_MODEL`).
Thư viện: `cheerio` (đọc cấu trúc bài), `robots-parser` (tôn trọng robots.txt), `fast-xml-parser` (sitemap, Google Trends RSS).

## Bot Telegram hai chiều (`tools/telegram-bot.mjs`, pm2 `hulako-seo-bot`)

@ceotopbot_bot: **lệnh** chạy pipeline SEO Agent; **nhắn thường** thì AI (Claude CLI, có tìm web) trả lời dựa trên số liệu thật của web. Chỉ trả lời chat của chủ website.

| Lệnh | Việc |
|---|---|
| `/kehoach` (`/plan`) | Kế hoạch 5–20 bài hôm nay + decode + AI viết nháp |
| `/baocao` (`/report`) | Báo cáo thứ hạng & tối ưu |
| `/xuhuong` `/nghiencuu` `/doithu` `/chamdiem` | Xu hướng 24–72h · R&D từ khoá · spy đối thủ · chấm điểm lại |
| `/viet <từ khoá>` | AI viết bản nháp cho 1 từ khoá |
| `/trangthai` · `/quen` · `/help` | Trạng thái · xoá trí nhớ hội thoại · danh sách lệnh |

Cấu hình `.env.telegram` (không commit): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `BOT_ALLOWED_CHAT_IDS`, `BOT_DAILY_LIMIT` (mặc định 80).
`npm run bot:check` · `npm run bot:start` · `npm run bot:logs` · `npm run bot:stop`

## AI SEO Agent & vòng phản hồi

Hằng ngày: thu Search Console, dọn dữ liệu quá hạn. Hằng tuần: **vòng học** (đánh giá thí nghiệm 28 ngày → học lại trọng số chấm điểm) → gom từ khoá → AI đề xuất từ khoá → chấm điểm cơ hội → AI viết nháp các cơ hội điểm cao. Hằng tháng: AI đề xuất phiên bản hướng dẫn viết mới dựa trên tỷ lệ thắng.

AI **chỉ viết nháp/đề xuất**; người duyệt xuất bản. Không tự sửa mã nguồn, không tự đăng. Xem `/admin/seo/learning`.
