# CHANGELOG — HULAKO Web Đèn (hulako-web-den)

**Trạng thái hiện tại (2026-11-20):** Đã chạy production tại **https://hulako-web-den.vercel.app** (Vercel Hobby, functions `sin1`, CSDL Neon `hulako-web-den-db` Singapore — chỉ gắn môi trường Production). Toàn bộ dữ liệu đang là **dữ liệu minh họa** (ảnh cắt từ mockup, SKU `DEMO-*`). AI Agent **chưa bật** (chưa có `ANTHROPIC_API_KEY`). Search Console chưa kết nối.

**Cập nhật 2026-11-21:** người dùng đã tạo lại `SETUP_TOKEN`, redeploy, đặt mật khẩu admin rồi xoá biến này (trên Vercel không còn `SETUP_TOKEN`; 2 lần redeploy lúc 21/11). Còn thiếu: `ANTHROPIC_API_KEY`, Search Console, kênh thông báo, dữ liệu thật, git commit.

Lịch sử mã nguồn gốc: dự án được dựng từ `../hulako-website` (commit `77dbba1`, trước đợt CRM) — xem `../hulako-website/CHANGELOG.md` cho các đợt 2026-11-13 → 2026-11-14.

## [2026-11-26] — Công cụ đặt lại mật khẩu quản trị khi quên

### Đã làm
- `tools/set-admin-password.mjs`: đặt lại mật khẩu admin (mặc định `hulakoofficial@gmail.com`, `--email` để chọn tài khoản khác). Người dùng tự gõ mật khẩu ẩn hai lần, tối thiểu 10 ký tự. Mật khẩu được băm scrypt cùng định dạng `src/lib/auth-core.ts`. Công cụ chỉ đổi `password_hash` của đúng một tài khoản đang hoạt động và ghi `audit_logs` (`auth.password_reset_cli`).
- Chạy cho website thật: công cụ lấy `DATABASE_URL` tạm qua `vercel env pull` vào thư mục tạm rồi xoá ngay, không in ra màn hình. Thêm `--local [--dir]` để chạy trên CSDL PGlite của máy.
- Đã thử trên **bản sao** `.local-db`:
  - mật khẩu ngắn bị chặn;
  - hai lần gõ lệch bị chặn;
  - email không tồn tại bị báo lỗi;
  - trường hợp đúng thì cập nhật được.

### Đang làm dở
- **Chưa chạy trên website thật.** Người dùng hỏi tiếp về đăng nhập Marketing OS (dùng `marketing-os/tools/set-password.mjs`).

### Vấn đề / Rủi ro
- Nút "Quên mật khẩu" trên web vẫn không gửi được email vì thiếu `RESEND_API_KEY`.
- Nếu Vercel trả `DATABASE_URL` rỗng (biến để chế độ Sensitive), cần chạy lại kèm `DATABASE_URL` lấy từ Neon.

### Bước tiếp theo
- Khi cần: `node tools/set-admin-password.mjs` (website thật).

## [2026-11-27] — Bot Telegram @ceotopbot_bot hai chiều (trả lời mọi tin + lệnh pipeline)

### Đã làm
- `tools/telegram-bot.mjs` (pm2 `hulako-seo-bot`, lệnh `npm run bot:check|start|stop|logs`): long polling, không dùng webhook.
  - **Lệnh** `/kehoach /baocao /xuhuong /nghiencuu /doithu /chamdiem` (kèm tên tiếng Anh) đưa vào cùng hàng lệnh với nút "Chạy ngay". Bot theo dõi `/api/agent/status` và báo khi việc xong (chờ tối đa 40 phút).
  - `/viet <từ khoá>`: AI viết nháp ngay.
  - `/trangthai`, `/quen`, `/help`. Danh sách lệnh đăng lên Telegram (setMyCommands).
  - **Tin nhắn thường:** Claude CLI (WebSearch/WebFetch) trả lời. Có dữ liệu thật của web (từ khoá, Search Console, bài, đối thủ, phân tích gần đây) và DNA HULAKO, nhớ 12 tin gần nhất. Tin không phải chữ (ảnh, voice, sticker…) được trả lời rằng bot mới đọc được chữ.
  - Chỉ phục vụ `TELEGRAM_ADMIN_CHAT_ID` và `BOT_ALLOWED_CHAT_IDS`. Chat lạ bị từ chối, không tốn AI. Hạn mức `BOT_DAILY_LIMIT` = 80 lượt/ngày.
- API mới (RUNNER_TOKEN): `GET /api/agent/status`, `POST /api/agent/command`, `POST /api/agent/write`. Code trong `src/lib/seo/agent.ts`: `agentStatusSummary`, `queueAgentCommand`, `writeForKeyword`.
- README, HUONG-DAN-CAI-DAT bổ sung phần bot.

### Kiểm thử
- Typecheck, 13/13 test, build đạt, deploy Production. `/api/agent/status` không token trả 401, có token trả 200 (12 bài chờ duyệt, 6 tác vụ lỗi trong 3 ngày).
- `node --check tools/telegram-bot.mjs` đạt.

### Đang làm dở
- Chưa bật bot. Cần file `.env.telegram` (token + chat ID). Quyền trên máy chặn Claude ghi file `.env*`, nên chủ website tự tạo bằng lệnh PowerShell, sau đó chạy `npm run bot:check`, `npm run bot:start`, rồi `pm2 save`.

## [2026-11-26] — Đưa mã nguồn lên GitHub (repo công khai)

### Đã làm
- Tạo repo công khai **https://github.com/daovanhuy08-HLK/hulako-web-den** (nhánh `main`). Commit đầu `2d62ad0` gồm 265 file, khoảng 3,8 MB.
- Trước khi đẩy:
  - Quét token, khoá và mật khẩu (Telegram, GitHub, Anthropic, private key, chuỗi kết nối Postgres/Neon, Resend, giá trị secret): không có.
  - `.gitignore` chặn `.env*`, `.env.runner`, `.local-db`, `logs/`, `.vercel`, `*.db`. Kiểm tra lại: 0 file nhạy cảm trong commit.
- Riêng repo này dùng email commit ẩn danh `318541253+daovanhuy08-HLK@users.noreply.github.com` (git config cục bộ), để email cá nhân không lộ trên repo công khai.
- Thêm `HUONG-DAN-CAI-DAT.md`: cài sang máy khác, tạo `.env.runner`, chuyển runner/agent sang máy mới (chỉ 1 máy chạy), tự deploy Vercel. README có link tới hướng dẫn.

### Vấn đề / Rủi ro
- Repo công khai: ai cũng xem được mã nguồn và ảnh minh họa. Bí mật vẫn chỉ nằm trên Vercel và trong `.env.runner` trên máy.
- Vercel vẫn deploy bằng CLI từ máy, chưa nối với GitHub. Sửa code xong cần `git push` để repo luôn mới.

## [2026-11-25] — SEO Agent 24/7 chạy trên máy (R&D, xu hướng, decode, spy, kế hoạch, báo cáo)

### Đã làm
- **Agent trên máy** `tools/seo-agent.mjs` (pm2 `hulako-seo-agent`, lệnh `npm run agent:check|run|start|stop|logs`).
  - Dùng Claude CLI của Claude Desktop, chỉ bật WebSearch/WebFetch. Không công cụ chạy lệnh/đọc ghi file, không API key.
  - Tách `tools/lib/claude.mjs` dùng chung với `tools/ai-runner.mjs` (runner viết bài vẫn không có công cụ).
  - Công cụ web `tools/agent/web.mjs`: robots.txt, giãn cách 2 giây/host, đọc CẤU TRÚC bài (không lưu nội dung), sitemap, Google Trends VN RSS, gợi ý tìm kiếm Google.
  - Cài thêm `cheerio`, `robots-parser`, `fast-xml-parser`.
- **Lịch** (giờ VN): xu hướng mỗi 4 giờ · R&D 7 nhóm từ khoá 01:30 · spy đối thủ 02:30 · chấm điểm lại 06:00 · kế hoạch 5–20 bài/ngày lúc `planTime` (07:30) · báo cáo thứ hạng lúc `reportTime` (20:00). Lệnh "Chạy ngay" từ admin được nhận trong 1 phút.
- **Website:**
  - Bảng mới `serp_snapshots`, `competitors`, `competitor_pages`, `agent_insights`; `keywords.note` (migration `drizzle/0004_seo_agent.sql`).
  - `src/lib/seo/agent.ts` (lưu từ khoá, decode, diff sitemap đối thủ, kế hoạch → cơ hội + giao viết nháp theo hạn mức/ngày, báo cáo thứ hạng).
  - API `src/app/api/agent/[...path]/route.ts` (RUNNER_TOKEN).
  - Cấu hình `seoAgent` trong `src/lib/settings.ts`.
- **Viết bài theo decode:** `writeDraft` nhận `evidence.serpStructure`, chỉ học cấu trúc; cấm chép hoặc diễn đạt lại câu chữ của bài khác; lấp khoảng trống nội dung; viết cho người đọc theo chính sách Google. Bài vẫn là NHÁP chờ duyệt.
- **Admin** `/admin/seo/agent`: trạng thái, cấu hình giờ/số bài/từ khoá gốc/khu vực, từ khoá theo 7 nhóm, đối thủ (thêm/duyệt gợi ý/bỏ), trang đối thủ mới/sửa, decode gần đây, nhật ký.
- Cron daily không gửi báo cáo trùng khi agent còn liên lạc trong 3 giờ.
- Sửa: việc do agent tạo không gắn tác giả (trước đây gắn chuỗi không phải uuid).

### Kiểm thử
- Typecheck sạch, 13/13 test, build đạt, deploy Production. `/api/agent/ping` không token → 401.
- `agent:check`: kết nối website OK (183 từ khoá, 14 bài); Claude tìm web OK.
- `--run trends`: 3 xu hướng liên quan, +16 từ khoá (32 giây).
- `--run research`: +63 từ khoá đủ 7 nhóm, dựa trên 109 gợi ý tìm kiếm thật (57 giây).
- Runner viết bài khởi động lại với `tools/lib/claude.mjs`: OK.
- `--run plan` (307 giây): 13 đề xuất; decode 5 từ khoá (2–5 bài top mỗi từ); giao runner viết 5 bản nháp; Telegram đã gửi. Runner đã nhận bài đầu tiên lúc 23:22.
- Bật pm2 `hulako-seo-agent` và `pm2 save`. Đã sao lưu dump cũ `~/.pm2/dump.pm2.truoc-them-seo-agent-2026-11-25`. Dump mới gồm 8 app, đúng 7 app cũ cộng agent.
- Lần chạy đầu trong pm2: spy (chưa đối thủ nào bật; 24 gợi ý từ decode chờ duyệt), refresh OK, báo cáo thứ hạng đã gửi Telegram.

### Bước tiếp theo
- Chủ website duyệt danh sách đối thủ gợi ý ở `/admin/seo/agent`. Nhiều gợi ý là trang tin hoặc blog lớn, chỉ bật các shop/đối thủ thật.
- Duyệt 5 bản nháp AI viết đêm 25/11 (bot sẽ báo từng bài).

### Vấn đề / Rủi ro
- Thứ hạng chuẩn chỉ có từ Search Console (từ khoá đã có hiển thị). Vị trí agent thấy qua tìm kiếm web của Claude chỉ để tham khảo, không phải Google chính xác.
- Gợi ý tìm kiếm Google (suggestqueries) là đầu nối không chính thức: gọi thưa, có thể bị chặn bất cứ lúc nào (agent vẫn chạy tiếp).
- Hạn mức Claude: agent mặc định tối đa 60 lượt/ngày, runner viết bài 40 lượt/ngày (`.env.runner`). Viết 20 bài/ngày cần tăng `AI_DAILY_LIMIT`, và dùng chung gói Claude với các agent khác trên máy.
- Chưa có đối thủ nào được bật theo dõi. Agent tự gợi ý từ kết quả decode, chủ website duyệt trong admin.

## [2026-11-25] — Bot "CEO TOP GOOGLE" báo cáo AI SEO tự động

### Đã làm
- `src/lib/notify.ts`: thêm `notifyAdmin(event, html)`, tôn trọng bật/tắt ở Cài đặt › Thông báo và không bao giờ ném lỗi. Hỗ trợ gửi im lặng.
- `src/lib/ai/jobs.ts`:
  - AI viết xong bản nháp/cập nhật: báo "📝 chờ bạn duyệt" kèm từ khoá, số dữ kiện cần kiểm chứng, số câu bị bộ lọc DNA chặn, link duyệt.
  - Tác vụ AI thất bại hẳn (kể cả runner lỗi 3 lần): báo "⚠️" kèm link chạy lại.
- `src/lib/seo/report.ts` (mới): báo cáo gồm
  - Google 7 ngày: hiển thị, nhấp, CTR, vị trí trung bình, so với tuần trước.
  - Index: số bài Google đã index.
  - Chuyển đổi 7 ngày: đăng ký quà, liên hệ, bấm sàn, bấm tư vấn, lượt xem.
  - Số bài chờ duyệt, top 3 cơ hội từ khoá, trạng thái runner trên máy.
- Gửi báo cáo:
  - Cron daily: 03:00 VN, gửi im lặng, bỏ qua thứ Hai.
  - Cron weekly: thứ Hai 04:00 VN, kèm tóm tắt vòng SEO tuần.
- Thông báo "Bài chờ duyệt", "Tác vụ AI thất bại", "Báo cáo AI SEO" bật mặc định. `getAdminSetting` gộp sâu `events` để cấu hình đã lưu vẫn nhận loại mới.
- Nút "Gửi báo cáo SEO ngay": ở Cài đặt › Thông báo và ở trang AI SEO ("Báo cáo về Telegram").

### Kiểm thử
- Typecheck sạch, 13/13 test, build đạt, deploy Production. `/admin/seo` 307 (đăng nhập), cron 401.
- Dựng thử báo cáo trên dữ liệu local: đúng định dạng.
- Chưa gửi báo cáo thật từ production. Cần chủ website bấm nút (đăng nhập admin), hoặc chờ cron 03:00.

## [2026-11-25] — Kết nối bot Telegram nhận thông báo

### Đã làm
- Bot `@ceotopbot_bot`. Đặt `TELEGRAM_BOT_TOKEN` (Secret) và `TELEGRAM_ADMIN_CHAT_ID` (chat riêng của chủ website, lấy qua getUpdates sau khi chủ website gửi /start) trên Vercel Production.
- Deploy lại. Lần deploy này cũng áp dụng 3 biến `GSC_*` chủ website đã đặt trước đó.
- Gửi tin thử qua bot: thành công.

### Vấn đề / Rủi ro
- Token đã được dán vào khung chat. Khuyên chủ website `/revoke` ở @BotFather và tự đặt token mới trên Vercel, nếu bot không dùng ở hệ thống khác.
- Chưa thử luồng thật từ web (gửi một đăng ký và nhận tin). Có nút "Kiểm tra gửi thử" ở Admin › Cài đặt › Thông báo.

## [2026-11-25] — Link dính dấu câu ở cuối không còn báo 404

### Đã làm
- Chủ website mở link `…/phong-nho.` (dấu chấm dính vào khi copy từ tin nhắn) và gặp trang 404.
- `src/middleware.ts`: với các trang `/kien-thuc`, `/tin-tuc`, `/thiet-bi`, `/goc-livestream`, `/tuyen-dung`, `/ho-tro`, web tự bỏ dấu câu thừa ở cuối link (`. , ; : ! ? ) ] " ' ” ’ » …`) rồi chuyển hướng 301 về link đúng. Phần chặn đăng nhập `/admin` giữ nguyên.

### Kiểm thử
- Production: link có `.`, `),` hoặc `”` ở cuối đều chuyển về đúng bài (200). `/admin` vẫn 307 sang trang đăng nhập. `/thiet-bi` vẫn 200.

## [2026-11-25] — Gắn link tải quà “Công thức livestream triệu đô”

### Đã làm
- Đặt `leadMagnet.downloadUrl` mặc định trong `src/lib/settings.ts` thành link Google Drive chủ website gửi. Production chưa có bản ghi `leadMagnet` trong DB nên giá trị mặc định có hiệu lực ngay.
- Link chỉ trả về cho khách SAU khi gửi form (API `/api/leads`). Đã kiểm tra: HTML bài viết production không chứa link.
- Đã deploy Production.

### Vấn đề / Rủi ro
- Lúc deploy, tệp Drive **chưa chia sẻ công khai**: mở không đăng nhập trả 401. Khách sẽ phải "Yêu cầu quyền truy cập" cho đến khi chủ website đổi sang "Bất kỳ ai có đường liên kết – Người xem".
- ✅ Đã xử lý cùng ngày 2026-11-25: chủ website đã mở quyền. Mở không đăng nhập trả 200, tệp `Cong_Thuc_Livestream_Trieu_Do_HULAKO.pdf`.

### Bước tiếp theo
- Chủ website mở quyền chia sẻ tệp Drive, sau đó gửi thử một đăng ký trên điện thoại.

## [2026-11-25] — Popup quà tặng “Công thức livestream triệu đô” trong bài viết

### Đã làm
- `src/components/LeadMagnet.tsx` (mới): thẻ "Quà tặng" trong mọi bài Kiến thức/Tin tức và popup.
  - Popup tự hiện sau 25 giây hoặc khi đọc tới 50% bài.
  - Khách đóng popup thì 3 ngày sau mới tự hiện lại. Đăng ký xong thì không hiện nữa (lưu trong trình duyệt, có try/catch).
  - Có Esc để đóng, giữ phím Tab trong hộp thoại, khoá cuộn trang. Trên điện thoại hiện dạng bảng trượt từ dưới lên.
  - Gắn vào `src/components/ArticleView.tsx` (đổi thành async để đọc cấu hình).
- Form bắt buộc đủ 5 trường: họ tên, số điện thoại, email, lĩnh vực kinh doanh (danh sách và "Khác…"), địa chỉ nhận hàng. Kèm ô đồng ý và ô bẫy bot.
  - Schema `magnetLeadSchema` trong `src/lib/validators.ts`.
  - `src/app/api/leads/route.ts` tách luồng `source=lead_magnet`.
- Bảng `leads` thêm 2 cột `business_field`, `shipping_address` (migration `drizzle/0003_lead_magnet_fields.sql`). Dữ liệu tự xoá theo hạn lưu 12 tháng như các trường khác.
- Admin:
  - Danh sách và chi tiết yêu cầu hiện nguồn "Đăng ký quà tặng", lĩnh vực, địa chỉ.
  - CSV có thêm 2 cột.
  - Telegram báo đủ thông tin; email chỉ báo có đăng ký mới.
  - Form cấu hình popup (Trang công ty › Popup) sửa được danh sách lĩnh vực.
- Mặc định mới trong `src/lib/settings.ts`: tiêu đề “Công thức livestream triệu đô”, mô tả, 3 lợi ích, nút "Nhận quà miễn phí". Mô tả viết theo DNA, không hứa doanh số/thu nhập.

### Kiểm thử
- Typecheck sạch, 13/13 test đạt, build đạt.
- Local:
  - Popup tự hiện khi cuộn.
  - Gửi form trống báo đủ 6 lỗi.
  - Gửi dữ liệu thử → mã TV-EQWL9R; DB lưu đúng lĩnh vực, địa chỉ, bài viết nguồn.
- Production: bài viết trả 200, có thẻ và tiêu đề quà mới.
- Chưa gửi đăng ký thử trên production (tránh tạo khách giả).
- Chưa xem được giao diện điện thoại: trình duyệt trong app giả lập sai kích thước.

### Vấn đề / Rủi ro
- Chưa có tệp quà để tải: `downloadUrl` đang trống, nên khách thấy "nhân viên sẽ liên hệ gửi quà". Thêm link ở Quản trị › Trang công ty › Popup.
- Thông báo Telegram/email chỉ chạy khi đã cấu hình kênh thông báo.

## [2026-11-25] — Hỗ trợ index bài viết khi đăng xong

### Đã làm
- `src/lib/indexing.ts` viết lại. Khi xuất bản/cập nhật bài, hệ thống tự làm 3 việc:
  - Báo **IndexNow** (cho Bing, Cốc Cốc, Yandex…), gửi kèm trang danh sách.
  - **Gửi lại sitemap** cho Google qua Search Console API.
  - Ghi trạng thái vào bảng mới `index_status`.
- Khi gỡ bài: báo IndexNow và đánh dấu `removed`.
- **Khoá IndexNow tự sinh** (32 hex) lần đầu cần dùng, lưu ở `settings.indexNow`. Phục vụ tại `/indexnow.txt`. Biến `INDEXNOW_KEY` nếu đặt sẽ được ưu tiên. Trước đây biến này chưa đặt nên `/indexnow.txt` trả 404 và IndexNow chưa từng chạy.
- `indexMaintenance()` chạy trong cron hằng ngày (`src/app/api/cron/daily/route.ts`):
  - Đồng bộ danh sách bài đang công khai.
  - Bài chưa index: gửi lại, cách nhau 3 ngày, tối đa 8 lần.
  - Nếu có Search Console: kiểm tra từng URL bằng URL Inspection API (tối đa 40 bài/ngày). Bài đã index thì kiểm tra lại sau 14 ngày.
- Trang quản trị mới **AI SEO › Index bài viết** (`src/app/admin/(panel)/seo/indexing/page.tsx`, actions ở `src/app/admin/actions/indexing.ts`):
  - Thống kê đã index / chưa index.
  - Mỗi bài có các nút "Gửi lại", "Kiểm tra" và "Yêu cầu Google" (mở công cụ Kiểm tra URL của Search Console để bấm *Yêu cầu lập chỉ mục*; Google chỉ cho bấm tay).
  - Nút "Gửi & kiểm tra ngay".
- Không dùng Google Indexing API cho bài viết, vì Google chỉ cho phép API này với JobPosting/BroadcastEvent. Không cài thêm thư viện (chỉ dùng fetch + jose sẵn có).
- Migration `drizzle/0002_index_status.sql`.

### Kiểm thử
- Typecheck sạch, 13/13 test đạt, build đạt.
- Local: cron daily theo dõi 10 bài; bỏ qua lần gửi thật khi chạy local.
- Deploy Production: `/indexnow.txt` trả 200 (khoá 32 ký tự). Gửi thử 1 bài qua api.indexnow.org → **202 (đã nhận)**. `/admin/seo/indexing` → chuyển sang trang đăng nhập (đúng).
- Chưa xem được giao diện trang admin mới vì cần mật khẩu admin (không đọc `.env.local`).

### Vấn đề / Rủi ro
- Phần Google (tự gửi sitemap, biết bài nào đã index) chỉ chạy khi có 3 biến `GSC_*`. Gửi sitemap cần quyền Toàn quyền.

### Bước tiếp theo
- Chủ website: hoàn tất service account Search Console. Mở **Index bài viết** để xem trạng thái.

## [2026-11-25] — Chuẩn bị kết nối Google Search Console

### Đã làm
- `src/app/layout.tsx`: thêm thẻ xác minh Google qua biến `GOOGLE_SITE_VERIFICATION` (phương thức "Thẻ HTML", vì tên miền `*.vercel.app` không xác minh bằng DNS được). Đã deploy; trang chủ 200.
- Kiểm tra lại: runner online, đã xử lý 11 việc (bài nháp mới nhất 23/11); 1 lần "fetch failed" lúc khởi động máy 25/11 rồi tự kết nối lại.

- Chủ website đã tạo property URL prefix `https://hulako-web-den.vercel.app/`. Dùng phương thức **Tệp HTML**: thêm `public/google2ffde7bbc8db4dba.html` (nội dung chuẩn Google), đã deploy, URL trả 200. **Không xoá tệp này** (Google cần để giữ xác minh).

- ✅ 2026-11-25: Search Console đã xác minh xong (chủ website gửi ảnh trang Tổng quan của property).

### Đang làm dở (chờ chủ website)
- Gửi `sitemap.xml` trong Search Console.
- Tạo service account (Google Cloud, bật Search Console API), thêm email service account vào Search Console với quyền **Toàn quyền** (cần để tự gửi sitemap), đặt `GSC_SITE_URL`, `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` (Sensitive) → Redeploy → "Kiểm tra kết nối" ở A09 › Nguồn dữ liệu.

## [2026-11-21] — Dải "Liên hệ nhanh" dưới menu

### Đã làm
- Theo yêu cầu (vị trí bôi vàng dưới logo/menu): thêm dải phím tắt trong `src/components/site/Header.tsx` — "Liên hệ nhanh:" + nút cam Hotline 0983 836 664 (bấm gọi) + Gian hàng Shopee, Kênh TikTok, Chat Zalo, Messenger. Dính cùng menu khi cuộn, mọi trang công khai; điện thoại vuốt ngang (không tràn trang). `ChannelButtons` thêm chế độ `compact`.
- Header cao thêm 44px → chỉnh khối dính (`top-36`) và neo tiêu đề bài (`scroll-mt-36`).
- Sửa 2 nút đầu trang chủ bị xuống dòng ở màn 375px.

### Kiểm thử
- Máy: 1024px và 375px — dải hiện đúng, không tràn ngang. `tsc` 0 lỗi, test 13/13, build OK.
- Production: đã deploy; `/thiet-bi` có "Liên hệ nhanh" + link Zalo/Messenger.

## [2026-11-21] — Kênh liên hệ chính thức + hotline

### Đã làm
- Dữ liệu chủ website cung cấp: hotline `0983836664`; Shopee `https://shopee.vn/hulakovuadenlive`; TikTok `https://www.tiktok.com/@hulakovuadenlives.i`; Zalo `https://zalo.me/0983836664`; Messenger `https://m.me/111284471714922` (đã kiểm: cả `111284471714922` và `100085633833276` đều trỏ về fanpage "Hulako - Vua Đèn Lives" → dùng mã đầu).
- Giá trị mặc định trong `src/lib/settings.ts` (`channels`, `company.phone`). `scripts/vercel-build.ts`: mỗi lần deploy chỉ điền vào ô đang TRỐNG — giá trị đã nhập trong quản trị được giữ.
- Component `src/components/site/Channels.tsx` (nút nền tảng + hotline bấm gọi); gắn vào chân trang, trang Liên hệ, Về HULAKO; JSON-LD Organization có `telephone` + `sameAs`.
- Sửa menu trên cùng bị xuống dòng ở màn 1024–1200px (`NavLinks.tsx`, `Header.tsx`).

### Kiểm thử
- Máy (1024px): chân trang đủ Hotline + Gian hàng Shopee + Kênh TikTok + Chat Zalo + Messenger, menu một dòng. `tsc` 0 lỗi, test 13/13, build OK.
- Production: log build "Đã điền channels: zalo, messenger" (Shopee, TikTok đã có sẵn do chủ website nhập). `/`, `/lien-he`, `/ve-hulako` có đủ 5 link; JSON-LD `telephone: 0983836664`.

### Ghi chú
- Link Shopee đang lưu trong quản trị có đuôi theo dõi `?entryPoint=ShopBySearch&searchKeyword=…` — vẫn mở đúng gian hàng; có thể xoá đuôi trong Trang công ty → Kênh liên hệ cho gọn.

## [2026-11-21] — AI qua Claude CLI Desktop (bỏ API key) + đối chiếu DNA + rà soát admin

### Đã làm
- **AI không dùng API key nữa** (yêu cầu người dùng): `src/lib/ai/claude.ts` viết lại — bước cần AI ném `AiPendingError` kèm yêu cầu (system, user, JSON schema từ zod); `src/lib/ai/jobs.ts` chuyển tác vụ sang `waiting_runner`, runner gửi kết quả → chạy lại bước với kết quả (AsyncLocalStorage `aiContext`), kiểm bằng zod + bộ lọc claim. Thêm `claimForRunner` (nguyên tử, `for update skip locked`), `completeFromRunner`, `failFromRunner` (thử 3 lần), trả việc treo > 20 phút.
- Migration `drizzle/0001_ai_runner.sql`: `ai_jobs.ai_request, ai_response, runner, claimed_at`.
- API `src/app/api/runner/[...path]/route.ts` (Bearer `RUNNER_TOKEN`, so sánh thời gian hằng): ping, claim, jobs/{id}/complete|fail; ghi `runnerStatus` (lần cuối liên lạc).
- Runner `tools/ai-runner.mjs` (dựa trên runner của ai-channel-empire-os): tự tìm `claude.exe` của Claude Desktop, `--tools ""`, `--strict-mcp-config`, `--no-session-persistence`, thư mục tạm trống, `windowsHide`. `ecosystem.config.cjs` pm2 `hulako-web-runner` chạy ngầm; script `ai:check|once|start|stop|logs`. Gỡ `@anthropic-ai/sdk`.
- Admin: nhãn "ANTHROPIC_API_KEY" → trạng thái runner (trang nguồn SEO tab AI hiện runner đang hoạt động/lần cuối liên lạc/số việc chờ).
- **Đối chiếu `HULAKO_DNA.md` v0.1:** bộ lọc `src/lib/guardrails.ts` thêm: giàu nhanh, bảo hành trọn đời/theo năm, siêu sáng/sáng gấp N lần/chắc chắn tuyệt đối, chê đối thủ (hàng dỏm, shop kia), phần trăm tự đặt, số năm làm nghề chưa duyệt. Prompt `src/lib/ai/prompts.ts` thêm cam kết được phép, từ nên dùng, thông điệp gốc, quy tắc spa/làm đẹp, mẫu giọng và checklist 7 câu của DNA. Câu ghi chú "Kết quả ánh sáng thực tế…" luôn hiện trên trang sản phẩm. Nội dung trang công khai không chứa từ cấm.
- **Rà soát admin bằng trình duyệt** (agent con, ~45 màn 1672×941 + 390px): sửa ID sai → 404 thay vì 500 (12 trang), icon phình to, đếm bài theo chủ đề luôn 0, nút FAQ không chạy, tràn ngang điện thoại (11 trang); làm lại lịch xuất bản 030 dạng cột tuần như mockup; nhãn tiếng Việt cho nhóm từ khoá và nhật ký; trạng thái runner trong bảng STATUS.

### Kiểm thử
- Trên máy (thật, Claude CLI 2.1.326, model sonnet): `--check` trả `{"ok":true}`; tác vụ "AI đề xuất từ khoá" → runner xử lý 20 giây → **thêm 25 từ khoá**; "AI viết brief + bản nháp" → 66 giây → bài nháp 1.127 từ đúng template + giọng DNA, 0 claim bị chặn, 9 dữ kiện cần kiểm chứng.
- `tsc` 0 lỗi · `npm test` 13/13 (thêm test luật DNA) · `next build` thành công.
- Production: deploy xong; runner `--check` → "Website https://hulako-web-den.vercel.app: OK"; `/api/runner/ping` không token → 401; trang chính 200. Runner đang chạy ngầm qua pm2.

### Vấn đề / Rủi ro
- `pm2 save` đã lỡ ghi đè danh sách pm2 lưu sẵn (marketing-os, aceo, hulako-agent, hulako-video-agent) → đã khôi phục bằng cách gộp bản `.bak` + runner mới (sao lưu `~/.pm2/dump.pm2.truoc-gop-2026-11-21`); các app đó không bị bật/tắt. Đã bỏ `pm2 save` khỏi `ai:start`.
- Runner chỉ chạy khi máy bật + Claude Desktop đăng nhập; pm2 chưa tự khởi động cùng Windows → sau khi khởi động lại máy cần `npm run ai:start`.
- Chưa thử trọn vòng AI trên production (cần phiên admin của chủ website); cron tuần (Chủ nhật 04:00 giờ VN) sẽ tự xếp việc AI.
- Gói Claude có giới hạn lượt dùng; runner giới hạn 40 lượt/ngày (`AI_DAILY_LIMIT`).

### Bước tiếp theo
- Chủ website vào `/admin/seo` bấm "AI đề xuất từ khoá" hoặc "Viết bài" để thử trên production; xem runner ở `/admin/seo/sources?tab=ai`.
- Kết nối Search Console; thay dữ liệu thật; tạo điểm lưu git.

## [2026-11-20] — Làm lại website theo gói "web đèn" (đặc tả v1.1, 93 ảnh) + vòng học AI + deploy Vercel

### Quyết định của người dùng
- **Làm dự án mới** (không nâng cấp `hulako-website`): thư mục `hulako-web-den/`, project Vercel `hulako-web-den`, CSDL Neon mới.
- **Vercel + Neon** theo yêu cầu "đưa hết lên vercel" (ngoại lệ quy tắc Cloudflare, như hulako-website).
- **Dùng tạm ảnh cắt từ mockup, gắn nhãn minh họa**; **deploy thẳng production**.

### Đã làm
- **Nguồn:** `HULAKO_Claude_Vibe_Coding_web den.zip` → đặc tả `Dac_ta_hien_hanh.md` v1.1, `Quy_uoc_thiet_ke.md`, `HULAKO_DNA.md`, 93 ảnh (Lo_01–Lo_10). Bỏ khỏi bản gốc: CRM/landing (`/api/mos`), API agent máy (`/api/agent`), popup ebook.
- **Thiết kế:** token màu lấy từ ảnh (`tailwind.config.ts`: nền `#F9F8F6`, cam `#FA6803`, viền `#E6E3DF`), khung 1600px, nút cam chữ trắng, thẻ bo 14px (`src/app/globals.css`). Logo chữ "HULA"+"KO" cam (`src/components/site/Logo.tsx`), bộ icon nét (`src/components/site/Icon.tsx`).
- **Trang công khai** (điện thoại + máy tính), khớp ảnh:
  - Trang chủ 001/074; thiết bị 002/075; chi tiết 003/076 và tạm ngừng 070 (`VariantPicker`, `Tabs`).
  - Góc livestream 004/077 và chi tiết 005/078, có sơ đồ bố trí và các bước; kiến thức 006/079; bài viết 007/080.
  - Tin tức 091/092 (nhóm tin = chủ đề `tin-*`); tìm kiếm 025/089, rỗng 042/090; Về HULAKO 011/081; hỏi đáp 012/082.
  - Liên hệ 013/083, gồm các trạng thái thành công 041, lỗi nhập 053, lỗi gửi 063.
  - Tuyển dụng 014/084, chi tiết 015/085, đã đóng 061, sai định dạng CV 069, thành công 052/093, chưa có vị trí 073.
  - Chọn đèn 021/086, kết quả 026/087, cần tư vấn 062/088; 404 043.
- **Ảnh minh họa:** 50 ảnh cắt từ mockup trong `public/demo/`. Cờ `isSample` trên products/setups/articles/jobs → web hiện "Sản phẩm minh họa", "Bài mẫu", "Vị trí mẫu"…
- **Seed mới** (`scripts/seed.ts`), khớp nội dung ảnh: 8 sản phẩm (1 tạm ngừng), 3 góc live, 7 bài kiến thức, 3 tin, 7 FAQ, 3 tin tuyển dụng (1 đã đóng), quy tắc chọn đèn v1. Có `SEED_DEMO_PUBLIC=1` để production công khai dữ liệu minh họa.
- **Form tư vấn:**
  - Ô "Số điện thoại hoặc email" gộp một trường.
  - Thêm phần "thông tin góc live" tuỳ chọn (món hàng, kiểu quay, diện tích) và **ảnh phòng**. Ảnh lưu trong `private_files`, chỉ xem qua `/api/admin/lead-photo/[id]` khi có quyền `lead.view`, có ghi audit; trang chi tiết tư vấn hiện ảnh này.
- **Quản trị** (agent con làm): khung sidebar + ~45 màn A01–A10 theo ảnh. Bảng đối chiếu ảnh → route nằm trong báo cáo của đợt này. Thêm:
  - `actions/extra.ts`, `lib/admin-page.ts`, `lib/admin-settings.ts` (`admin.notify`, `admin.schedule`).
  - `lib/admin-password.ts`: luồng đặt lại mật khẩu bằng token 30 phút.
  - Ô DEMO cho sản phẩm, góc live, bài viết, tin tuyển dụng; ô bộ phận cho tin tuyển dụng.
- **Thông báo nội bộ (068) đã nối thật:** `src/lib/notify.ts` lấy người nhận từ cấu hình quản trị (trống thì dùng biến môi trường) và tôn trọng bật/tắt từng loại.
- **Vòng học AI (feedback loop v2)** — `src/lib/seo/learning.ts`, `learning-core.ts`, trang `/admin/seo/learning`, actions `actions/learning.ts`:
  - Bảng mới `experiments`, `learning_log`; cột `opportunities.factors`.
  - Mỗi lần xuất bản → mở thí nghiệm (chụp số liệu nền). Sau 28 ngày kết luận Thắng/Thua/Hoà/Chưa đủ dữ liệu, theo loại: bài mới, viết lại tiêu đề/mô tả, cập nhật.
  - Học lại trọng số chấm điểm cơ hội (5 yếu tố). Mỗi lần chỉnh tối đa ±20%, kẹp trong 0.5–2. Có thể khoá, tắt tự áp dụng, hoàn tác; ghi nhật ký kèm căn cứ.
  - AI đề xuất hướng dẫn viết hằng tháng, có thêm dữ liệu tỷ lệ thắng theo phiên bản.
  - Phễu 28 ngày: hiển thị → nhấp → xem → bấm sàn / tư vấn / gửi form.
  - Cron tuần chạy `learning_cycle` trước khi chấm điểm.
- **Hạ tầng:** `vercel.json` (`framework: nextjs`, build `npm run vercel-build`, region `sin1`, 3 cron).
  - Biến production: `SESSION_SECRET`, `CRON_SECRET`, `SETUP_TOKEN` (sensitive, sinh ngẫu nhiên), `NEXT_PUBLIC_SITE_URL`, `SEED_ADMIN_EMAIL=hulakoofficial@gmail.com`, `SEED_DEMO_PUBLIC=1`, `AI_MONTHLY_BUDGET_USD=20`.
  - Cấu hình preview local `hulako-web-den` cổng 3200 trong `../.claude/launch.json`.

### Kiểm thử
- `npx tsc --noEmit`: 0 lỗi.
- `npm test`: 12/12, thêm `tests/learning.test.ts` (chấm kết luận, tương quan).
- `next build` trên máy: thành công.
- **Trên máy (PGlite, cổng 3200), so với ảnh mockup** ở 1672×941 và 375×812: trang chủ, thiết bị, chi tiết, góc live, bài viết, hỗ trợ, liên hệ, Về HULAKO, tuyển dụng, chọn đèn, tìm kiếm.
  - Luồng chọn đèn: phòng nhỏ + quần áo + live đứng → gợi ý đúng quy tắc v1 → gửi tư vấn. Form trống báo lỗi đúng trường; gửi hợp lệ → mã TV-EBSXRR. Trong admin thấy câu trả lời + "Phiên bản quy tắc: v1" + SKU gợi ý.
  - Gỡ → gửi duyệt → duyệt → xuất bản qua `/api/admin/content/{id}/transitions` → thí nghiệm tự xuất hiện ở Vòng học. Nút "Chạy vòng học ngay" chạy được, báo chưa đủ dữ liệu để học trọng số.
- **Production:**
  - Log build: "Migration xong", "Seed xong".
  - 18 URL công khai trả 200; trang lạ 404; `/api/cron/daily` không khoá 401; `/admin` → 307 về đăng nhập; ảnh `/demo/*` và `_next/image` 200.
  - API chọn đèn ngoài mẫu trả `needsConsultation: true`.
- Lần deploy đầu bị 404 toàn site vì project tạo bằng CLI chưa nhận framework → thêm `"framework": "nextjs"` rồi deploy lại.

### Đang làm dở
- **Chủ website chưa đặt mật khẩu admin:** vào `/admin/setup?token=<SETUP_TOKEN>`, lấy giá trị trong Vercel → Settings → Environment Variables. Đặt xong nên xoá `SETUP_TOKEN`.
- **AI Agent chưa chạy thật:** cần `ANTHROPIC_API_KEY` trên Vercel (Production) rồi Redeploy.
- **Search Console chưa kết nối** (`GSC_SITE_URL`, `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`): chưa có dữ liệu hiển thị/nhấp cho vòng học.
- **Kênh nhận thông báo chưa có:** chưa đặt `TELEGRAM_BOT_TOKEN`/`RESEND_API_KEY` → yêu cầu tư vấn chỉ nằm trong hộp thư admin.
- **Còn thiếu trong admin** (theo báo cáo agent):
  - Lịch tự động 057 mới lưu cấu hình; cron vẫn chạy theo giờ cố định trong `vercel.json`.
  - Phiên hết hạn 060 đoán qua `?next=` + localStorage.
  - Trang công ty chưa có bước nháp/duyệt.
  - Chưa có cột "người phụ trách" cho tuyển dụng.
  - Trang `/admin/setup` chưa làm lại giao diện.
- **Chưa có git commit** cho dự án mới (đã `git init`). Nên tạo điểm lưu (`/luu`).

### Vấn đề / Rủi ro
- **Ảnh, SKU, link đều là minh họa.** Ảnh mockup là ảnh AI có chữ HULAKO. Nút Shopee trỏ trang gian hàng chung; chưa có link TikTok Shop nên nút TikTok ẩn (đúng đặc tả). Phải thay ảnh thật, SKU, link từng phiên bản và bỏ cờ minh họa trước khi chạy quảng cáo.
- **Bộ chọn đèn đang bật với quy tắc minh họa v1** (đặc tả để giai đoạn 2). Đội tư vấn nên thử lại và kích hoạt bản thật, hoặc tạm tắt.
- **Độ tương phản:** nút cam chữ trắng theo đúng mockup chỉ đạt khoảng 2.9:1, dưới mức AA cho chữ nhỏ. Nếu ưu tiên chuẩn tiếp cận thì đổi sang chữ đen hoặc cam đậm hơn.
- **Không thể cam kết "top Google".** Vòng học chỉ tối ưu theo số liệu; thứ hạng do Google quyết định.
- **Giới hạn gói Hobby:** cron 1 lần/ngày, bài lên lịch đăng lúc 08:00 giờ VN.
- Trong CSDL dev có lead "[TEST] Khách thử chọn đèn" và một bài mẫu đã được gỡ rồi xuất bản lại để thử thí nghiệm.

### Bước tiếp theo
- Đặt mật khẩu admin → thêm `ANTHROPIC_API_KEY` → Redeploy → bấm "AI đề xuất từ khoá" ở AI SEO để thử.
- Xác minh Search Console cho `hulako-web-den.vercel.app` (hoặc tên miền riêng) và nhập service account.
- Nhập ảnh/SKU/link thật, bỏ cờ minh họa; đội tư vấn duyệt bảng quy tắc chọn đèn.
- Tạo repo GitHub và nối vào project để có lịch sử deploy theo commit.
