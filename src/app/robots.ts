import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/settings";

export default function robots(): MetadataRoute.Robots {
  // Môi trường preview/staging của Vercel: chặn lập chỉ mục toàn bộ
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/tim-kiem"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
