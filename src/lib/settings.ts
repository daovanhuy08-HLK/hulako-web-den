// Cấu hình tập trung: trang công ty, liên hệ, chân trang dùng chung một nguồn (mục P02).
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

export type Company = {
  brand: string;
  slogan: string;
  legalName: string;
  taxCode: string;
  address: string;
  email: string;
  phone?: string;
  founder: string;
  aboutIntro: string;
  aboutWhy: string;
  aboutHeadline?: string;
  aboutImage?: string;
  aboutImageAlt?: string;
  teamImage?: string;
  // Chỉ hiển thị khi đã duyệt (approved = true)
  mission?: { text: string; approved: boolean };
  vision?: { text: string; approved: boolean };
  values?: { items: string[]; approved: boolean };
  trademarkNote: string;
};

export type Channels = { zalo?: string; messenger?: string; tiktok?: string; shopee?: string; tiktokShop?: string };

export type HomeConfig = {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroAlt: string;
  needs: { label: string; href: string; image: string; alt: string }[];
};

export type ConsentNotice = { version: string; lead: string; application: string; retentionDaysLead: number; retentionDaysApplication: number };

export const DEFAULTS = {
  company: {
    brand: "HULAKO — Vua Đèn Lives",
    slogan: "LIVE SÁNG · BÁN ĐỈNH",
    legalName: "Công ty TNHH Thương mại HLK Group",
    taxCode: "0111413563",
    address: "Lô LK05-10 Thôn Chu Trần, Xã Yên Lãng, TP. Hà Nội",
    email: "hulakoofficial@gmail.com",
    phone: "0983836664", // hotline
    founder: "Huy Đào",
    aboutIntro: "HULAKO bán đèn, softbox và chân đỡ để người bán hàng online tự dựng góc live tại nhà.",
    aboutWhy: "Sản phẩm đại trà trên thị trường chất lượng kém, không phù hợp với nhu cầu thật của người bán hàng. HULAKO ra đời để người bán hàng online có thiết bị ánh sáng dùng được thật và có người chỉ cách setup.",
    trademarkNote: "Nhãn hiệu HULAKO — Vua Đèn Lives đã nộp đơn đăng ký nhãn hiệu.",
    aboutHeadline: "Đèn, softbox và chân đỡ cho người bán hàng online tự dựng góc live tại nhà.",
    aboutImage: "/demo/ve-hulako.jpg",
    aboutImageAlt: "Người bán hàng giới thiệu áo trong góc live tại nhà có softbox HULAKO (ảnh minh họa)",
  } as Company,
  // Kênh liên hệ chính thức (chủ website cung cấp 2026-11-21). Kênh để trống trong quản trị thì ẩn trên web.
  channels: {
    shopee: "https://shopee.vn/hulakovuadenlive",
    tiktok: "https://www.tiktok.com/@hulakovuadenlives.i",
    zalo: "https://zalo.me/0983836664",
    messenger: "https://m.me/111284471714922", // fanpage "Hulako - Vua Đèn Lives"
  } as Channels,
  home: {
    heroTitle: "Tự dựng góc livestream tại nhà",
    heroSubtitle: "Giải pháp ánh sáng cho livestream giúp bạn dễ dàng tạo góc quay rõ nét ngay tại nhà — chọn đúng bộ đèn cho phòng và có người chỉ cách setup.",
    heroImage: "/demo/hero-home.jpg",
    heroAlt: "Người bán hàng giới thiệu áo trước điện thoại, softbox đặt chếch phía trước trong góc live tại nhà (ảnh minh họa)",
    needs: [
      { label: "Phòng nhỏ", href: "/goc-livestream?space=phong-nho", image: "/demo/need-phong-nho.jpg", alt: "Góc live gọn trong phòng nhỏ có softbox và bàn làm việc" },
      { label: "Bán quần áo", href: "/goc-livestream?industry=quan-ao", image: "/demo/need-quan-ao.jpg", alt: "Người bán giới thiệu áo len trước điện thoại" },
      { label: "Quay review", href: "/goc-livestream?style=tren-ban", image: "/demo/need-review.jpg", alt: "Người bán quay review mỹ phẩm trên bàn" },
    ],
  } as HomeConfig,
  consent: {
    version: "2026-11-20",
    lead: "HULAKO dùng thông tin bạn gửi chỉ để tư vấn chọn thiết bị và hỗ trợ sau mua. Dữ liệu được lưu tối đa 12 tháng, bạn có thể yêu cầu xem hoặc xoá qua email của công ty.",
    application: "HULAKO dùng hồ sơ của bạn chỉ cho mục đích tuyển dụng vị trí đã ứng tuyển. Hồ sơ được lưu tối đa 6 tháng, bạn có thể yêu cầu xoá qua email của công ty.",
    retentionDaysLead: 365,
    retentionDaysApplication: 180,
  } as ConsentNotice,
  // Popup quà tặng (lead magnet) hiện trong bài viết
  leadMagnet: {
    enabled: true,
    title: "Quà tặng: “Công thức livestream triệu đô”",
    subtitle: "Bộ công thức dựng góc live tại nhà: ánh sáng, khung hình và kịch bản phiên live — viết cho người bán hàng online, làm theo được ngay.",
    bullets: ["Cách đặt đèn cho từng kiểu phòng: phòng nhỏ, phòng ngủ, góc bàn", "Khung hình và góc máy để sản phẩm rõ màu, rõ chất liệu", "Kịch bản mở live, giới thiệu sản phẩm và trả lời bình luận"],
    buttonLabel: "Nhận quà miễn phí",
    businessOptions: ["Thời trang, quần áo", "Mỹ phẩm, làm đẹp", "Đồ gia dụng", "Thực phẩm, đồ ăn", "Mẹ và bé", "Phụ kiện, trang sức", "Điện tử, công nghệ"],
    downloadUrl: "https://drive.google.com/file/d/1h8B0qLpohrKdCIJ4s8KNo9tiGVx4Z_D7/view?usp=sharing", // tệp quà (chủ website gửi 2026-11-25) — chỉ trả cho khách SAU khi đăng ký
    delaySeconds: 25,
    scrollPercent: 50,
  } as LeadMagnetConfig,
  agent: {
    paused: false, // tạm dừng toàn bộ lịch tự động của AI Agent
    autoDraftsPerWeek: 2, // số bản nháp AI tự viết mỗi tuần từ cơ hội điểm cao nhất
    minScoreForAutoDraft: 55,
    suggestKeywordsWeekly: true,
    improvePromptMonthly: true,
  } as AgentConfig,
  // Trọng số chấm điểm cơ hội SEO — vòng học tự điều chỉnh trong biên [0.5, 2] theo kết quả thí nghiệm (src/lib/seo/learning.ts)
  scoringWeights: {
    brandFit: 1, demand: 1, illustratable: 1, learned: 1, launch: 1,
    autoApply: true, locked: false, basedOn: 0, updatedAt: "",
  } as ScoringWeights,
  // Runner Claude CLI trên máy: lần cuối liên lạc (cập nhật qua /api/runner/*)
  runnerStatus: { name: "", lastSeen: "" } as { name: string; lastSeen: string },
  // Khoá IndexNow tự sinh lần đầu (công khai, không phải bí mật — phục vụ ở /indexnow.txt). Biến INDEXNOW_KEY nếu đặt sẽ được ưu tiên.
  indexNow: { key: "" } as { key: string },
  // SEO Agent chạy trên máy (tools/seo-agent.mjs) — chỉnh ở Quản trị › AI SEO › Agent trên máy
  seoAgent: {
    enabled: true,
    planTime: "07:30", // giờ gửi đề xuất công việc hằng ngày qua Telegram (giờ VN)
    reportTime: "20:00", // giờ gửi báo cáo thứ hạng + tối ưu
    proposalsMin: 5, proposalsMax: 20, // số bài đề xuất mỗi ngày
    autoWritePerDay: 5, // số bản nháp AI tự viết mỗi ngày (theo cấu trúc decode) — vẫn chờ người duyệt
    trendsEveryHours: 4,
    regions: ["Hà Nội", "TP.HCM", "Đà Nẵng", "Hải Phòng", "Cần Thơ"],
    seeds: ["đèn livestream", "softbox", "đèn led quay video", "setup phòng livestream", "livestream bán hàng", "chân đèn", "đèn chiếu sáng chụp ảnh sản phẩm"],
    industry: "thiết bị ánh sáng livestream, quay video, chụp ảnh sản phẩm cho người bán hàng online (Shopee, TikTok Shop, Facebook)",
  } as SeoAgentConfig,
  // Trạng thái agent (agent cập nhật qua /api/agent/*): lần liên lạc cuối + lần chạy cuối của từng việc
  seoAgentStatus: { lastSeen: "", host: "", jobs: {} } as { lastSeen: string; host: string; jobs: Record<string, { at: string; ok: boolean; note: string }> },
  // Lệnh "chạy ngay" từ trang quản trị — agent đọc rồi xoá
  seoAgentCommands: { pending: [] } as { pending: { job: string; at: string; by: string }[] },
};

export type ScoringWeights = {
  brandFit: number; demand: number; illustratable: number; learned: number; launch: number;
  autoApply: boolean; locked: boolean; basedOn: number; updatedAt: string;
};
export const WEIGHT_KEYS = ["brandFit", "demand", "illustratable", "learned", "launch"] as const;

export type LeadMagnetConfig = {
  enabled: boolean; title: string; subtitle: string; bullets: string[]; buttonLabel: string;
  downloadUrl: string; delaySeconds: number; scrollPercent: number;
  businessOptions: string[]; // lựa chọn "Lĩnh vực kinh doanh" (luôn có thêm "Khác")
};

export type SeoAgentConfig = {
  enabled: boolean; planTime: string; reportTime: string; proposalsMin: number; proposalsMax: number; autoWritePerDay: number;
  trendsEveryHours: number; regions: string[]; seeds: string[]; industry: string;
};

export type AgentConfig = { paused: boolean; autoDraftsPerWeek: number; minScoreForAutoDraft: number; suggestKeywordsWeekly: boolean; improvePromptMonthly: boolean };

type Key = keyof typeof DEFAULTS;
type ValueOf<K extends Key> = (typeof DEFAULTS)[K];

export async function getSetting<K extends Key>(key: K): Promise<ValueOf<K>> {
  try {
    const db = await getDb();
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
    return { ...DEFAULTS[key], ...((row?.value as object) ?? {}) } as ValueOf<K>;
  } catch {
    return DEFAULTS[key]; // site vẫn hiển thị khi DB tạm lỗi
  }
}

export async function setSetting<K extends Key>(key: K, value: ValueOf<K>) {
  const db = await getDb();
  await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({
    target: schema.settings.key, set: { value, updatedAt: new Date() },
  });
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const ALLOWED_MARKET_HOSTS = ["shopee.vn", "s.shopee.vn", "shp.ee", "tiktok.com", "www.tiktok.com", "vt.tiktok.com", "shop.tiktok.com"];

/** Liên kết mua phải HTTPS và thuộc danh sách tên miền công khai cho phép (mục 09) */
export function isAllowedMarketUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_MARKET_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
