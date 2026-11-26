import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { SITE_URL } from "@/lib/settings";
import "./globals.css";

const font = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "HULAKO — Vua Đèn Lives | Đèn livestream, softbox cho người bán hàng online", template: "%s | HULAKO" },
  description: "Hướng dẫn tự dựng góc livestream tại nhà, chọn đèn theo phòng và mua đúng bộ softbox, đèn bảng, chân đỡ trên Shopee hoặc TikTok Shop.",
  openGraph: { type: "website", locale: "vi_VN", siteName: "HULAKO — Vua Đèn Lives", images: ["/images/hero-softbox.jpg"] },
  alternates: { canonical: "/" },
  // Mã xác minh Google Search Console (phương thức "Thẻ HTML"): đặt biến GOOGLE_SITE_VERIFICATION trên Vercel. Mã này công khai, không phải bí mật.
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = { themeColor: "#FA6803", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
