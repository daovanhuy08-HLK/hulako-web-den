// Seed dữ liệu DEMO cho môi trường phát triển. KHÔNG chạy trên production thật
// (thông số, link, nội dung dưới đây là mẫu — đội vận hành thay bằng dữ liệu đã duyệt).
import "./load-env";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth-core";
import { buildSearchText } from "../src/lib/search";
import { stripMarkdown } from "../src/lib/text";
import { DEFAULT_WRITER_GUIDE } from "../src/lib/ai/prompts";
import { checkClaims } from "../src/lib/guardrails";

const PROD = process.env.SEED_MODE === "production";
if (process.env.VERCEL_ENV === "production" && !PROD && !process.argv.includes("--force")) {
  console.error("Từ chối seed dữ liệu demo trên production. Thêm --force nếu thật sự muốn.");
  process.exit(1);
}

const db = await getDb();
const [existing] = await db.select().from(schema.users).limit(1);
if (existing) {
  console.log("Đã có dữ liệu — bỏ qua seed. (Dev: npm run db:reset để làm lại từ đầu)");
  process.exit(0);
}

// ---------- Tài khoản ----------
let pw = process.env.SEED_ADMIN_PASSWORD;
if (!pw && !PROD) {
  pw = randomBytes(9).toString("base64url");
  const line = `\nSEED_ADMIN_PASSWORD=${pw}\n`;
  if (!existsSync(".env.local") || !readFileSync(".env.local", "utf8").includes("SEED_ADMIN_PASSWORD=")) appendFileSync(".env.local", line);
  console.log("→ Đã tạo mật khẩu admin ngẫu nhiên và lưu vào .env.local (SEED_ADMIN_PASSWORD)");
}
const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@hulako.local").toLowerCase();
// Production không có mật khẩu → "unset": admin tự đặt qua /admin/setup?token=SETUP_TOKEN
const hash = PROD && !pw ? "unset" : await hashPassword(pw!);
const [admin] = await db.insert(schema.users).values({ email: adminEmail, name: "Quản trị HULAKO", passwordHash: hash, roles: ["admin", "reviewer"] }).returning();
// Tài khoản demo theo vai trò để thử phân quyền (cùng mật khẩu, chỉ dùng ở dev)
const demoUsers = [
  ["bientap@hulako.local", "Biên tập viên SEO", ["seo_editor"]],
  ["duyet@hulako.local", "Người duyệt nội dung", ["reviewer"]],
  ["vanhanh@hulako.local", "Vận hành sản phẩm", ["product_ops"]],
  ["tuvan@hulako.local", "Tư vấn viên", ["consultant"]],
  ["tuyendung@hulako.local", "Tuyển dụng", ["recruiter"]],
] as const;
if (!PROD) for (const [email, name, roles] of demoUsers) await db.insert(schema.users).values({ email, name, roles: [...roles], passwordHash: hash });

// Dữ liệu minh hoạ (DEMO) khớp bộ 93 ảnh thiết kế. Mọi bản ghi gắn isSample=true → web hiện nhãn "minh họa".
// SEED_DEMO_PUBLIC=1 (người dùng duyệt 2026-11-20): production cũng công khai dữ liệu minh hoạ để web giống ảnh thiết kế;
// đội vận hành thay ảnh/SKU/link thật rồi bỏ cờ minh hoạ trong quản trị.
const DEMO_PUBLIC = !PROD || process.env.SEED_DEMO_PUBLIC === "1";
const PUB = DEMO_PUBLIC ? "public" : "draft";

// ---------- Cụm chủ đề ra mắt (kiến thức) + nhóm tin tức (slug "tin-*") ----------
const topics = await db.insert(schema.topics).values([
  { slug: "setup-phong-nho", name: "Setup phòng nhỏ", sortOrder: 1, intro: "Phòng 10–15 m², live một mình: đặt đèn ở góc bàn, bố trí live ngồi và xử lý mặt bị tối — làm theo từng bước." },
  { slug: "anh-sang-ban-quan-ao", name: "Ánh sáng bán quần áo", sortOrder: 2, intro: "Bố trí cho live đứng, giữ màu sản phẩm và giảm cháy sáng trên áo trắng." },
  { slug: "chon-va-lap-softbox", name: "Chọn và lắp softbox", sortOrder: 3, intro: "So sánh dạng chụp theo nhu cầu, danh sách phụ kiện, hướng dẫn lắp và kiểm tra chân đỡ trước khi dùng." },
  { slug: "tin-hoat-dong", name: "Hoạt động", sortOrder: 11, intro: "Hoạt động của HULAKO." },
  { slug: "tin-huong-dan-moi", name: "Hướng dẫn mới", sortOrder: 12, intro: "Thông báo bài hướng dẫn mới, dẫn về bài chính trong Kiến thức." },
  { slug: "tin-thong-bao", name: "Thông báo", sortOrder: 13, intro: "Thông báo từ HULAKO." },
]).returning();
const T = Object.fromEntries(topics.map((t) => [t.slug, t.id]));

// ---------- Danh mục & thiết bị ----------
const cats = await db.insert(schema.categories).values([
  { slug: "softbox", name: "Softbox", sortOrder: 1 },
  { slug: "den-bang", name: "Đèn bảng", sortOrder: 2 },
  { slug: "chan-do", name: "Chân đỡ", sortOrder: 3 },
  { slug: "phu-kien", name: "Phụ kiện", sortOrder: 4 },
]).returning();
const C = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
const SHOP = "https://shopee.vn/hulakovuadenlive"; // gian hàng công khai — thay bằng link từng phiên bản sau khi đội vận hành duyệt
const D = (f: string) => `/demo/${f}.jpg`;
type Img = { url: string; alt: string; kind?: "full" | "box" | "detail" | "video" };
const img = (f: string, alt: string, kind: Img["kind"] = "full"): Img => ({ url: D(f), alt: `${alt} (ảnh minh họa)`, kind });

type P = { slug: string; cat: string; name: string; summary: string; body?: string; useCases: string[]; featured?: boolean; status?: "public" | "paused"; sort: number;
  variants: { sku: string; name: string; components: string[]; specs: [string, string][]; images: Img[]; shopee?: boolean }[] };
const products: P[] = [
  {
    slug: "combo-softbox-to-ong", cat: "softbox", name: "Combo softbox tổ ong", featured: true, sort: 0,
    summary: "Combo softbox tổ ong HULAKO là lựa chọn phù hợp cho nhu cầu chiếu sáng livestream tại nhà, giúp ánh sáng mềm và tập trung hơn vào chủ thể, cho khung hình rõ nét.",
    body: "Lưới tổ ong gom ánh sáng về phía người live, hạn chế sáng lan ra tường phía sau — hợp phòng nhỏ và live đứng bán quần áo.\n\nThông số chi tiết, nhiệt độ màu (K) và phụ kiện theo từng lô do đội vận hành cập nhật sau khi kiểm hàng.",
    useCases: ["livestream-ban-hang", "quay-video"],
    variants: [
      { sku: "DEMO-OCT90-C", name: "Bộ kèm chân", components: ["1 chụp softbox bát giác", "1 lưới tổ ong", "1 chân đèn", "1 túi đựng"], specs: [["Dạng chụp", "Bát giác"], ["Nhiệt độ màu", "Chưa có dữ liệu (đội vận hành điền theo lô, đơn vị K)"]],
        images: [img("sp-to-ong-main", "Combo softbox tổ ong kèm chân đặt trong góc live"), img("sp-to-ong-studio", "Softbox tổ ong trên chân, nền trắng"), img("sp-to-ong-t2", "Cận cảnh lưới tổ ong", "box"), img("sp-to-ong-t3", "Softbox nhìn nghiêng"), img("sp-to-ong-t4", "Chân đèn ba chân", "box"), img("sp-to-ong-info", "Softbox tổ ong trong phòng live", "detail")], shopee: true },
      { sku: "DEMO-OCT90-G", name: "Bộ kèm tổ ong", components: ["1 chụp softbox bát giác", "1 lưới tổ ong", "1 túi đựng"], specs: [["Dạng chụp", "Bát giác"], ["Chân đèn", "Không kèm"]],
        images: [img("tim-combo", "Hai softbox tổ ong bát giác"), img("sp-to-ong-t2", "Cận cảnh lưới tổ ong", "box"), img("sp-to-ong-info", "Softbox tổ ong trong phòng live", "detail")], shopee: true },
    ],
  },
  { slug: "softbox-bat-giac", cat: "softbox", name: "Softbox bát giác", sort: 1, featured: true, summary: "Chụp bát giác cho ánh sáng tròn đều, hợp live đứng toàn thân.", useCases: ["livestream-ban-hang", "livestream-ca-nhan"],
    variants: [{ sku: "DEMO-SBG-C", name: "Bộ kèm chân", components: ["1 chụp bát giác", "1 đế đèn", "1 chân đèn", "1 túi đựng"], specs: [["Dạng chụp", "Bát giác"]], images: [img("sp-softbox-bat-giac", "Softbox bát giác trên chân trong góc live")], shopee: true }] },
  { slug: "softbox-vuong", cat: "softbox", name: "Softbox vuông", sort: 2, featured: true, summary: "Giải pháp chiếu sáng gọn gàng, phù hợp với không gian phòng nhỏ.", useCases: ["livestream-ban-hang", "quay-video", "livestream-ca-nhan"],
    variants: [
      { sku: "DEMO-SBV-C", name: "Bộ softbox kèm chân", components: ["1 chụp softbox vuông", "1 đế đèn", "1 bóng LED", "1 chân đèn", "1 túi đựng"], specs: [["Dạng chụp", "Vuông"]], images: [img("sp-softbox-vuong", "Softbox vuông kèm chân"), img("sp-softbox-nho", "Softbox vuông nền trắng"), img("sp-softbox-side", "Softbox vuông trong phòng live", "detail")], shopee: true },
      { sku: "DEMO-SBV", name: "Chỉ chụp softbox", components: ["1 chụp softbox vuông", "1 túi đựng"], specs: [["Dạng chụp", "Vuông"], ["Chân đèn", "Không kèm"]], images: [img("sp-softbox-side", "Chụp softbox vuông")] },
    ] },
  { slug: "den-led-bang", cat: "den-bang", name: "Đèn LED bảng", sort: 3, featured: true, summary: "Đèn bảng gọn, đặt được trên bàn, hợp quay mỹ phẩm và review sản phẩm cận cảnh.", useCases: ["quay-video", "chup-san-pham"],
    variants: [{ sku: "DEMO-LED-B", name: "Kèm chân", components: ["1 đèn LED bảng", "1 chân", "Dây nguồn"], specs: [["Chỉnh độ sáng", "Có"]], images: [img("sp-den-led-bang", "Đèn LED bảng trên chân")], shopee: true }] },
  { slug: "softbox-chu-nhat", cat: "softbox", name: "Softbox chữ nhật", sort: 4, featured: true, summary: "Chụp chữ nhật cho mảng sáng dài, hợp live đứng thử đồ.", useCases: ["livestream-ban-hang"],
    variants: [{ sku: "DEMO-SBCN-C", name: "Bộ kèm chân", components: ["1 chụp chữ nhật", "1 đế đèn", "1 chân đèn"], specs: [["Dạng chụp", "Chữ nhật"]], images: [img("sp-softbox-chu-nhat", "Softbox chữ nhật trên chân")], shopee: true }] },
  { slug: "den-led-vuong", cat: "den-bang", name: "Đèn LED vuông", sort: 5, featured: true, summary: "Đèn LED vuông nhỏ gọn cho góc bàn và quay cận.", useCases: ["quay-video", "chup-san-pham", "livestream-ca-nhan"],
    variants: [{ sku: "DEMO-LED-V", name: "Kèm chân", components: ["1 đèn LED vuông", "1 chân"], specs: [], images: [img("sp-den-led-vuong", "Đèn LED vuông trên chân")], shopee: true }] },
  { slug: "chan-do-dien-thoai", cat: "chan-do", name: "Chân đỡ điện thoại", sort: 6, summary: "Chân ba chân kẹp điện thoại, xoay ngang/dọc để live một mình vẫn rảnh hai tay.", useCases: ["livestream-ban-hang", "livestream-ca-nhan", "quay-video"],
    variants: [{ sku: "DEMO-TRIPOD", name: "Tiêu chuẩn", components: ["1 chân ba chân", "1 kẹp điện thoại"], specs: [], images: [img("sp-chan-dien-thoai", "Chân đỡ điện thoại ba chân")], shopee: true }] },
  { slug: "softbox-mini-mau-cu", cat: "softbox", name: "Softbox mini (mẫu cũ)", sort: 9, status: "paused", summary: "Mẫu cũ đang tạm ngừng bán — giữ trang hướng dẫn cho khách đã mua.", useCases: ["livestream-ca-nhan"],
    variants: [{ sku: "DEMO-MINI", name: "Bộ kèm chân", components: ["1 chụp softbox mini", "1 chân"], specs: [], images: [img("sp-softbox-nho", "Softbox mini nền trắng")] }] },
];
const V: Record<string, string> = {};
const P: Record<string, string> = {};
for (const p of products) {
  const [row] = await db.insert(schema.products).values({
    slug: p.slug, categoryId: C[p.cat], name: p.name, summary: p.summary, body: p.body ?? "", useCases: p.useCases, featured: !!p.featured, sortOrder: p.sort,
    status: DEMO_PUBLIC ? p.status ?? "public" : "draft", isSample: true,
    searchText: buildSearchText(p.name, p.summary, p.useCases, p.variants.map((v) => v.sku), p.variants.map((v) => v.name)),
  }).returning();
  P[p.slug] = row.id;
  for (const [i, v] of p.variants.entries()) {
    const [vr] = await db.insert(schema.variants).values({
      productId: row.id, sku: v.sku, name: v.name, components: v.components, specs: v.specs.map(([label, value]) => ({ label, value })), sortOrder: i, images: v.images,
    }).returning();
    V[v.sku] = vr.id;
    if (v.shopee) await db.insert(schema.channelLinks).values({ variantId: vr.id, channel: "shopee", url: SHOP, checkedAt: new Date() });
  }
}

// ---------- Góc livestream ----------
const setupRows = await db.insert(schema.setups).values([
  {
    slug: "live-ban-quan-ao-trong-phong-nho", title: "Live bán quần áo trong phòng nhỏ", space: "phong-nho", industry: "quan-ao", style: "dung", featured: true, status: PUB, isSample: true,
    summary: "Nhìn rõ cả người và sản phẩm trong phòng ngủ hẹp: một softbox chếch phía trước, điện thoại đặt đủ xa để lấy toàn thân.",
    roomConditions: "Phòng ngủ khoảng 12 m², giá treo quần áo phía sau, live buổi tối kéo rèm.",
    cameraAngle: "Điện thoại dọc, cao ngang ngực, cách người khoảng 2 m.",
    lightPosition: "Softbox chếch 45° phía trước, tâm đèn ngang trán, cách người khoảng 1–1,5 m.",
    steps: ["Chọn góc đặt máy: Đặt máy ở vị trí ổn định, bao quát được bạn và sản phẩm.", "Thử vị trí đèn: Bật đèn và điều chỉnh hướng, độ cao để ánh sáng phủ đều, rõ sản phẩm.", "Kiểm tra hình trên camera: Xem lại hình ảnh trên camera để đảm bảo bạn và sản phẩm hiển thị rõ, sáng tự nhiên."],
    demoNote: "Ảnh bố trí là ảnh minh họa; ảnh thật sẽ được đội HULAKO chụp cùng điện thoại, cùng vị trí, buổi tối.",
    variantIds: [V["DEMO-SBV-C"], V["DEMO-TRIPOD"]], coverUrl: D("setup-quan-ao-hero"), coverAlt: "Người bán giới thiệu áo trước điện thoại, softbox đặt chếch phía trước (ảnh minh họa)", diagramUrl: D("so-do-phong-nho"),
    searchText: buildSearchText("Live bán quần áo trong phòng nhỏ softbox live đứng góc livestream phòng nhỏ setup"),
  },
  {
    slug: "quay-my-pham-tren-ban", title: "Quay mỹ phẩm trên bàn", space: "goc-ban", industry: "my-pham", style: "tren-ban", featured: true, status: PUB, isSample: true,
    summary: "Bố trí giảm phản sáng trên bao bì: đèn đặt chếch cao, chỉnh góc theo bề mặt sản phẩm.",
    roomConditions: "Bàn 80 cm sát tường, nền sáng, tắt đèn trần.", cameraAngle: "Điện thoại nhìn chéo xuống 30–45° so với mặt bàn.",
    lightPosition: "Softbox phía trước bên trái, chếch xuống; tránh đặt đèn thẳng trục với máy.",
    steps: ["Sắp sản phẩm: Đặt sản phẩm giữa khung hình, nền trơn phía sau.", "Đặt đèn chếch cao: Đèn cao hơn sản phẩm, chiếu chéo từ một bên.", "Xử lý phản sáng: Bao bì bóng bị loá thì xoay đèn ra ngoài vài độ đến khi hết vệt sáng."],
    variantIds: [V["DEMO-LED-B"]], coverUrl: D("setup-my-pham"), coverAlt: "Người bán cầm chai mỹ phẩm trước điện thoại trên bàn có softbox (ảnh minh họa)",
    searchText: buildSearchText("Quay mỹ phẩm trên bàn đèn bảng phản sáng bao bì"),
  },
  {
    slug: "goc-live-ngoi-tai-nha", title: "Góc live ngồi tại nhà", space: "phong-nho", industry: "khac", style: "ngoi", featured: true, status: PUB, isSample: true,
    summary: "Góc bàn gọn trong phòng nhỏ: một softbox chính chếch 45° và giá đỡ điện thoại trước mặt.",
    roomConditions: "Góc bàn trong phòng khoảng 12 m², tường sáng.", cameraAngle: "Điện thoại ngang tầm mắt, cách mặt khoảng 60–80 cm.",
    lightPosition: "Softbox chính chếch 45° phía trước, cao hơn mắt khoảng 20–30 cm.",
    steps: ["Chọn góc đặt máy: Giá điện thoại giữa bàn, ngang tầm mắt.", "Thử vị trí đèn: Đèn chếch 45° phía trước, cao hơn mắt một chút.", "Kiểm tra hình trên camera: Dưới mũi còn bóng đậm thì hạ đèn xuống một nấc."],
    variantIds: [V["DEMO-SBV-C"], V["DEMO-TRIPOD"]], coverUrl: D("setup-ngoi"), coverAlt: "Người live ngồi bên bàn, softbox phía trước (ảnh minh họa)",
    searchText: buildSearchText("Góc live ngồi tại nhà softbox phòng nhỏ setup góc livestream"),
  },
]).returning();
const S = Object.fromEntries(setupRows.map((s) => [s.slug, s.id]));

// ---------- Bài viết (đã qua bộ lọc claim) ----------
const OUTRO = "\n\nNhắn HULAKO kèm diện tích phòng để được chỉ cách đặt đèn cho đúng phòng bạn.\n\n> Kết quả ánh sáng thực tế phụ thuộc diện tích phòng, khoảng cách đặt đèn và thiết bị quay của bạn.";
type A = { kind?: "guide" | "news"; slug: string; topic: string; keyword: string; title: string; summary: string; cover: string; coverAlt: string; featured?: boolean; products?: string[]; setups?: string[]; body: string };
const articles: A[] = [
  {
    slug: "cach-dat-den-khi-live-trong-phong-nho", topic: "setup-phong-nho", keyword: "cách đặt đèn khi live phòng nhỏ", featured: true,
    title: "Cách đặt đèn khi live trong phòng nhỏ", cover: "bai-phong-nho-hero", coverAlt: "Người live ngồi bên bàn, softbox đặt chếch phía trước trong phòng nhỏ",
    summary: "Gợi ý cách bố trí softbox và ánh sáng phù hợp để livestream rõ nét, sáng đẹp ngay cả trong không gian nhỏ tại nhà.",
    products: ["softbox-vuong"], setups: ["live-ban-quan-ao-trong-phong-nho", "goc-live-ngoi-tai-nha"],
    body: `Trong phòng nhỏ, phần lớn hình live bị tối là do đèn đặt sai chỗ chứ không do điện thoại. Một đèn chính đặt đúng vị trí thường là đủ.

## Chọn vị trí đặt đèn
Trong phòng nhỏ, bạn nên đặt đèn hơi chếch về phía trước và cao hơn tầm mắt, hướng ánh sáng vào mặt và sản phẩm. Cách đặt này giúp gương mặt sáng đều, giảm bóng đổ và giữ khung hình gọn gàng, dễ nhìn hơn khi livestream.

- Tắt hoặc giảm đèn trần để tránh bóng dưới mắt và mũi.
- Đặt chân đèn phía trước, lệch sang một bên khoảng 45° so với mặt.
- Kéo chân để tâm đèn cao hơn mắt khoảng 20–30 cm, chúc nhẹ xuống.

## Kiểm tra hình trên camera
Mở camera điện thoại ở đúng vị trí live. Nhìn kỹ dưới mũi và cằm: còn bóng đậm thì hạ đèn xuống một nấc; trán bị bóng sáng thì lùi đèn ra xa.

## Điều chỉnh theo sản phẩm
Bán quần áo cần nhìn rõ cả người và đồ: lùi điện thoại xa hơn và kiểm tra màu vải trên màn hình. Quay mỹ phẩm trên bàn thì đặt đèn chếch cao để bao bì không bị loá.${OUTRO}`,
  },
  {
    slug: "cach-lap-softbox", topic: "chon-va-lap-softbox", keyword: "cách lắp softbox", featured: true,
    title: "Cách lắp softbox", cover: "bai-lap-softbox", coverAlt: "Người lắp chụp softbox lên chân đèn",
    summary: "Hướng dẫn các bước lắp softbox đơn giản, nhanh chóng và đúng cách.", products: ["combo-softbox-to-ong", "softbox-vuong"],
    body: `Lắp softbox chỉ mất khoảng 10 phút. Phần quan trọng nhất là kiểm tra chân đèn trước khi kéo cao.

## Kiểm tra đủ phụ kiện
Mở hộp, đếm đủ các món theo danh sách "Trong hộp có gì" của đúng phiên bản bạn mua. Thiếu món nào thì nhắn gian hàng HULAKO kèm mã đơn.

## Dựng chân và gắn chụp
Mở ba chân ra hết cỡ trên sàn phẳng. Gắn đế đèn lên đầu chân, mở các thanh nan của chụp rồi cài vào đế cho đến khi vải căng đều.

## Kiểm tra chân đèn trước khi kéo cao
Siết từng khoá ren, kéo đoạn to trước, đoạn nhỏ nhất kéo sau cùng và lắc nhẹ thử.${OUTRO}`,
  },
  {
    slug: "quay-san-pham-do-phan-sang", topic: "anh-sang-ban-quan-ao", keyword: "quay sản phẩm bị phản sáng", featured: true,
    title: "Quay sản phẩm đỡ phản sáng", cover: "bai-phan-sang", coverAlt: "Điện thoại quay túi xách trên bàn dưới ánh softbox",
    summary: "Mẹo điều chỉnh ánh sáng và góc quay để sản phẩm lên hình rõ nét, hạn chế lóa, phản sáng.", setups: ["quay-my-pham-tren-ban"], products: ["den-led-bang"],
    body: `Bao bì bóng, kính, da bóng dễ bị vệt sáng trắng khi quay cận.

## Đổi góc đèn thay vì giảm sáng
Xoay đèn ra ngoài vài độ hoặc nâng đèn cao hơn cho tới khi vệt sáng biến mất khỏi bề mặt sản phẩm.

## Đổi góc máy
Nghiêng điện thoại nhìn chéo xuống 30–45° thay vì quay thẳng mặt sản phẩm.

## Hắt sáng mặt tối
Dùng tờ giấy trắng đặt phía đối diện đèn để mặt tối của sản phẩm sáng hơn.${OUTRO}`,
  },
  {
    slug: "setup-goc-livestream-don-gian-tai-nha", topic: "setup-phong-nho", keyword: "setup góc livestream tại nhà",
    title: "Setup góc livestream đơn giản tại nhà", cover: "bai-setup-don-gian", coverAlt: "Góc bàn livestream gọn gàng có softbox",
    summary: "Gợi ý bố trí góc live gọn gàng, dễ áp dụng cho nhiều không gian.", setups: ["goc-live-ngoi-tai-nha"], products: ["softbox-vuong", "chan-do-dien-thoai"],
    body: `Góc live tại nhà chỉ cần ba thứ: một nền gọn, một đèn chính đặt đúng chỗ và điện thoại đứng vững.

## Chọn nền
Ngồi quay lưng vào tường hoặc kệ gọn gàng, tránh cửa sổ phía sau lưng.

## Đặt đèn chính
Đèn chếch 45° phía trước, cao hơn mắt một chút.

## Cố định điện thoại
Dùng chân đỡ hoặc giá kẹp, đặt ngang tầm mắt.${OUTRO}`,
  },
  {
    slug: "anh-sang-phu-hop-khi-ban-quan-ao", topic: "anh-sang-ban-quan-ao", keyword: "ánh sáng live bán quần áo",
    title: "Ánh sáng phù hợp khi bán quần áo", cover: "bai-quan-ao", coverAlt: "Giá treo quần áo nhiều màu dưới ánh sáng mềm",
    summary: "Cách chọn và bố trí ánh sáng để màu sắc trang phục lên hình đúng, rõ chi tiết.", setups: ["live-ban-quan-ao-trong-phong-nho"], products: ["combo-softbox-to-ong", "softbox-bat-giac"],
    body: `Muốn màu áo lên hình gần thật, hãy dùng một nguồn sáng chính đủ lớn và tắt các đèn màu vàng trong phòng.

## Thống nhất một nhiệt độ màu
Để các đèn cùng một chế độ màu (đơn vị K), không trộn đèn vàng và đèn trắng.

## Áo trắng bị cháy sáng
Lùi đèn chính ra xa hoặc giảm độ sáng, đừng tăng sáng thêm.

## So màu với hàng thật
Cầm sản phẩm cạnh màn hình, so màu trên máy với màu thật trước khi lên live.${OUTRO}`,
  },
  {
    slug: "setup-anh-sang-khi-livestream-my-pham", topic: "anh-sang-ban-quan-ao", keyword: "ánh sáng livestream mỹ phẩm",
    title: "Setup ánh sáng khi livestream mỹ phẩm", cover: "bai-my-pham", coverAlt: "Người live trang điểm trước softbox",
    summary: "Gợi ý ánh sáng giúp da trông tự nhiên, sản phẩm lên hình đẹp và rõ.", setups: ["quay-my-pham-tren-ban"], products: ["den-led-bang"],
    body: `Live mỹ phẩm cần thấy rõ cả da mặt và bao bì.

## Đèn chính mềm
Dùng softbox hoặc đèn bảng có tản sáng, đặt chếch phía trước.

## Không để da bị bóng
Lùi đèn hoặc giảm sáng khi da bóng dầu trên màn hình.

## Kiểm tra màu son, màu phấn
So màu trên điện thoại với màu thật trước khi live.${OUTRO}`,
  },
  {
    slug: "mot-so-loi-anh-sang-thuong-gap", topic: "setup-phong-nho", keyword: "live bị tối mặt",
    title: "Một số lỗi ánh sáng thường gặp và cách khắc phục", cover: "bai-loi-anh-sang", coverAlt: "Điện thoại trên chân quay góc live",
    summary: "Nhận biết nhanh các lỗi phổ biến khi livestream và gợi ý cách điều chỉnh.", products: ["softbox-vuong"],
    body: `## Mặt bị tối
Đèn chiếu từ trên xuống hoặc đặt sau lưng. Đặt lại đèn chếch 45° phía trước, cao hơn mắt một chút.

## Một bên mặt quá tối
Đặt thêm tờ giấy trắng hoặc đèn phụ yếu hơn ở bên còn lại.

## Nền phía sau quá sáng
Kéo người ra xa tường hoặc giảm đèn chiếu vào nền.${OUTRO}`,
  },
  {
    kind: "news", slug: "bo-sung-huong-dan-lap-softbox", topic: "tin-huong-dan-moi", keyword: "", featured: true,
    title: "Bổ sung hướng dẫn lắp softbox", cover: "tin-lap-softbox-hero", coverAlt: "Thành viên HULAKO lắp chụp softbox",
    summary: "HULAKO bổ sung hướng dẫn lắp softbox theo từng phiên bản thiết bị.", products: ["combo-softbox-to-ong"],
    body: `Bạn có thể tìm hướng dẫn theo đúng phiên bản thiết bị tại mục Hỗ trợ. Bài hướng dẫn chính nằm ở [Cách lắp softbox](/kien-thuc/cach-lap-softbox).`,
  },
  {
    kind: "news", slug: "chuan-bi-goc-quay-noi-dung-tai-nha", topic: "tin-hoat-dong", keyword: "",
    title: "Chuẩn bị góc quay nội dung tại nhà", cover: "tin-goc-quay", coverAlt: "Góc bàn quay nội dung có điện thoại trên chân",
    summary: "Đội nội dung HULAKO chuẩn bị góc quay để làm video hướng dẫn setup.", setups: ["goc-live-ngoi-tai-nha"],
    body: `Đội nội dung HULAKO đang chuẩn bị góc quay tại nhà để làm loạt video hướng dẫn setup. Xem các [góc livestream mẫu](/goc-livestream).`,
  },
  {
    kind: "news", slug: "cap-nhat-tai-lieu-huong-dan-su-dung", topic: "tin-thong-bao", keyword: "",
    title: "Cập nhật tài liệu hướng dẫn sử dụng", cover: "tin-tai-lieu", coverAlt: "Màn hình máy tính mở tài liệu hướng dẫn sử dụng",
    summary: "Tài liệu hướng dẫn sử dụng được cập nhật tại mục Hỗ trợ.",
    body: `Tài liệu hướng dẫn sử dụng đã được cập nhật. Bạn có thể tra theo mã thiết bị tại [Hỏi đáp và hỗ trợ](/ho-tro).`,
  },
];
for (const [i, a] of articles.entries()) {
  const issues = checkClaims({ title: a.title, body: a.body, summary: a.summary });
  if (issues.length) throw new Error(`Seed vi phạm claim: ${a.slug} ${JSON.stringify(issues)}`);
  const at = new Date(Date.now() - (articles.length - i) * 3600_000); // thứ tự đăng ổn định
  const [art] = await db.insert(schema.articles).values({
    kind: a.kind ?? "guide", slug: a.slug, topicId: T[a.topic], targetKeyword: a.keyword, authorId: null, reviewerId: admin.id, status: DEMO_PUBLIC ? "published" : "draft", featured: !!a.featured,
    publishedAt: DEMO_PUBLIC ? at : null, contentUpdatedAt: at, isSample: true,
  }).returning();
  const [rev] = await db.insert(schema.revisions).values({
    articleId: art.id, number: 1, title: a.title, summary: a.summary, body: a.body, seoTitle: a.title.slice(0, 65), seoDescription: a.summary.slice(0, 160),
    coverUrl: D(a.cover), coverAlt: `${a.coverAlt} (ảnh minh họa)`,
    relatedProductIds: (a.products ?? []).map((s) => P[s]), relatedSetupIds: (a.setups ?? []).map((s) => S[s]), createdBy: admin.id,
  }).returning();
  await db.update(schema.articles).set({
    draftRevisionId: rev.id, approvedRevisionId: DEMO_PUBLIC ? rev.id : null, publishedRevisionId: DEMO_PUBLIC ? rev.id : null,
    searchText: DEMO_PUBLIC ? buildSearchText(a.title, a.summary, a.keyword, stripMarkdown(a.body).slice(0, 4000)) : "",
  }).where(eq(schema.articles.id, art.id));
}
// Liên kết ngược: góc live → bài liên quan
const arts = await db.select({ id: schema.articles.id, slug: schema.articles.slug }).from(schema.articles);
const A = Object.fromEntries(arts.map((a) => [a.slug, a.id]));
await db.update(schema.setups).set({ relatedArticleIds: [A["cach-dat-den-khi-live-trong-phong-nho"], A["anh-sang-phu-hop-khi-ban-quan-ao"]] }).where(eq(schema.setups.id, S["live-ban-quan-ao-trong-phong-nho"]));
await db.update(schema.setups).set({ relatedArticleIds: [A["quay-san-pham-do-phan-sang"], A["setup-anh-sang-khi-livestream-my-pham"]] }).where(eq(schema.setups.id, S["quay-my-pham-tren-ban"]));
await db.update(schema.setups).set({ relatedArticleIds: [A["setup-goc-livestream-don-gian-tai-nha"], A["cach-dat-den-khi-live-trong-phong-nho"]] }).where(eq(schema.setups.id, S["goc-live-ngoi-tai-nha"]));

// ---------- FAQ ----------
await db.insert(schema.faqs).values([
  { question: "Đặt đèn ở đâu khi live trong phòng nhỏ?", answer: "Đặt thử đèn chếch trước mặt, mở camera và chỉnh theo hình thực tế.", topic: "lap-dat", deviceType: "softbox", articleSlug: "cach-dat-den-khi-live-trong-phong-nho", sortOrder: 1 },
  { question: "Cách lắp softbox như thế nào?", answer: "1. Dựng chân đèn trên sàn phẳng.\n2. Gắn đế đèn, mở các thanh nan và cài vào đế.\n3. Lắp bóng, dán lớp vải tản sáng và kéo căng.", topic: "lap-dat", deviceType: "softbox", articleSlug: "cach-lap-softbox", productId: P["combo-softbox-to-ong"], sortOrder: 2 },
  { question: "Cần kiểm tra gì trước khi kéo cao chân đèn?", answer: "1. Mở rộng ba chân ra hết cỡ.\n2. Siết lại từng khoá ren từ dưới lên.\n3. Kéo đoạn to trước, đoạn nhỏ nhất kéo sau cùng.", topic: "chan-do", deviceType: "chan-do", articleSlug: "cach-lap-softbox", sortOrder: 3 },
  { question: "Live vẫn tối dù đã bật đèn?", answer: "Kiểm tra đèn có đang chiếu thẳng từ trên xuống không. Đặt đèn chếch 45° phía trước mặt, cao hơn mắt một chút và tắt bớt đèn trần.", topic: "anh-sang", deviceType: "softbox", articleSlug: "mot-so-loi-anh-sang-thuong-gap", sortOrder: 4 },
  { question: "Áo trắng bị cháy sáng khi live?", answer: "Lùi đèn chính ra xa hoặc giảm độ sáng, không tăng sáng thêm. Để các đèn cùng chế độ màu.", topic: "anh-sang", deviceType: "softbox", articleSlug: "anh-sang-phu-hop-khi-ban-quan-ao", sortOrder: 5 },
  { question: "Chân đèn bị lung lay khi kéo cao thì làm sao?", answer: "Mở rộng ba chân hơn, siết lại khoá ren. Nếu thiếu ốc hãm, nhắn gian hàng HULAKO kèm mã đơn để được hỗ trợ.", topic: "chan-do", deviceType: "chan-do", sortOrder: 6 },
  { question: "Đổi trả hàng như thế nào?", answer: "Đổi trả theo chính sách của sàn nơi bạn mua (Shopee hoặc TikTok Shop). Nhắn gian hàng HULAKO trên sàn kèm mã đơn để được hỗ trợ.", topic: "mua-hang", sortOrder: 7 },
]);

// ---------- Tuyển dụng ----------
await db.insert(schema.jobs).values([
  { slug: "nhan-vien-noi-dung-video", title: "Nhân viên nội dung video", department: "noi-dung", location: "Hà Nội", employmentType: "Toàn thời gian", isSample: true,
    status: DEMO_PUBLIC ? "open" : "draft", publishedAt: DEMO_PUBLIC ? new Date() : null,
    description: "Chuẩn bị nội dung và quay video hướng dẫn setup.", requirements: "Giao tiếp rõ ràng, thích tìm hiểu thiết bị.", benefits: "Cập nhật theo tin tuyển dụng được duyệt." },
  { slug: "nhan-vien-van-hanh-san", title: "Nhân viên vận hành sàn", department: "van-hanh", location: "Hà Nội", employmentType: "Toàn thời gian", isSample: true,
    status: DEMO_PUBLIC ? "open" : "draft", publishedAt: DEMO_PUBLIC ? new Date() : null,
    description: "Cập nhật sản phẩm, link mua và hình ảnh trên Shopee, TikTok Shop.", requirements: "Cẩn thận, quen dùng máy tính.", benefits: "Cập nhật theo tin tuyển dụng được duyệt." },
  { slug: "nhan-vien-tu-van-da-dong", title: "Nhân viên tư vấn", department: "tu-van", location: "Hà Nội", employmentType: "Toàn thời gian", isSample: true,
    status: DEMO_PUBLIC ? "closed" : "draft", publishedAt: DEMO_PUBLIC ? new Date() : null,
    description: "Tư vấn khách chọn đèn theo phòng qua chat.", requirements: "Giao tiếp rõ ràng, kiên nhẫn.", benefits: "Cập nhật theo tin tuyển dụng được duyệt." },
]);

// ---------- Quy tắc chọn đèn v1 (ví dụ trong đặc tả — đội tư vấn hoàn thiện) ----------
await db.insert(schema.ruleSets).values(DEMO_PUBLIC
  ? { version: 1, status: "active", note: "Bản minh họa từ ví dụ đặc tả — đội tư vấn thử, sửa và kích hoạt bản thật", activatedAt: new Date(), activatedBy: admin.id }
  : { version: 1, status: "draft", note: "Bản mẫu từ ví dụ đặc tả — đội tư vấn thử & kích hoạt" });
await db.insert(schema.recommendationRules).values([
  { ruleSetVersion: 1, name: "Phòng nhỏ, live quần áo đứng", priority: 10, conditions: { area: ["duoi-10", "10-20"], industry: ["quan-ao"], style: ["dung"] }, setupId: S["live-ban-quan-ao-trong-phong-nho"], variantIds: [V["DEMO-SBV-C"]], advice: "Thử vị trí đèn và kiểm tra lại trên camera.", articleSlug: "cach-dat-den-khi-live-trong-phong-nho" },
  { ruleSetVersion: 1, name: "Quay mỹ phẩm trên bàn", priority: 10, conditions: { industry: ["my-pham"], style: ["tren-ban"] }, setupId: S["quay-my-pham-tren-ban"], variantIds: [V["DEMO-LED-B"]], advice: "Đặt đèn chếch cao để giảm phản sáng trên bao bì; chỉnh góc theo bề mặt sản phẩm.", articleSlug: "quay-san-pham-do-phan-sang" },
  { ruleSetVersion: 1, name: "Phòng nhỏ, live ngồi", priority: 5, conditions: { area: ["duoi-10", "10-20"], style: ["ngoi"] }, setupId: S["goc-live-ngoi-tai-nha"], variantIds: [V["DEMO-SBV-C"], V["DEMO-TRIPOD"]], advice: "Một softbox chính chếch 45° và giá đỡ điện thoại trước mặt là đủ cho live ngồi.", articleSlug: "setup-goc-livestream-don-gian-tai-nha" },
]);

// ---------- Hướng dẫn viết v1 & từ khoá khởi động ----------
await db.insert(schema.promptVersions).values({ key: "article_writer", version: 1, content: DEFAULT_WRITER_GUIDE, status: "active", origin: "human", rationale: "Bản khởi tạo theo đặc tả", activatedAt: new Date() });
const seedKw = [
  ["live bị tối mặt", "setup-phong-nho", "xu-ly-loi"], ["cách đặt đèn livestream phòng nhỏ", "setup-phong-nho", "sau"],
  ["đèn live bán quần áo", "anh-sang-ban-quan-ao", "san-pham"], ["live áo trắng bị cháy sáng", "anh-sang-ban-quan-ao", "xu-ly-loi"],
  ["cách lắp softbox", "chon-va-lap-softbox", "sau"], ["softbox bát giác hay chữ nhật", "chon-va-lap-softbox", "sau"],
  ["chân đèn livestream bị lung lay", "chon-va-lap-softbox", "xu-ly-loi"], ["setup góc live tại nhà", "setup-phong-nho", "rong"], ["phòng ngủ hẹp đặt máy ở đâu để live toàn thân", "anh-sang-ban-quan-ao", "sau"], ["quay mỹ phẩm bị lóa", "anh-sang-ban-quan-ao", "xu-ly-loi"],
] as const;
const { normalizeVi } = await import("../src/lib/text");
for (const [q, cluster, intent] of seedKw) {
  await db.insert(schema.keywords).values({ query: q, normalized: normalizeVi(q), cluster, intent, source: "manual", variantsSeen: [q] }).onConflictDoNothing();
}

console.log(`✔ Seed xong. Đăng nhập /admin/login bằng ${adminEmail} (mật khẩu trong .env.local: SEED_ADMIN_PASSWORD).`);
process.exit(0);
