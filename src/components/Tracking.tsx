"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track, type TrackEvent } from "./track";

/** Ghi lượt xem trang (không cookie, không định danh người dùng) — dùng làm mẫu số cho tỷ lệ chuyển đổi */
export function PageViewTracker() {
  const path = usePathname();
  useEffect(() => {
    if (path.startsWith("/admin")) return;
    track({ type: "page_view", pageType: path.split("/")[1] || "home" });
  }, [path]);
  return null;
}

/** Link nội bộ có ghi sự kiện (vd nút "Nhờ tư vấn") */
export function TrackedLink({ href, event, className, children, ...rest }: {
  href: string; event: TrackEvent; className?: string; children: React.ReactNode; "aria-label"?: string;
}) {
  return (
    <Link href={href} className={className} onClick={() => track(event)} {...rest}>
      {children}
    </Link>
  );
}

/** Nút sang sàn: mở link công khai ở tab mới + ghi marketplace_click đúng sàn và phiên bản */
export function MarketplaceButton({ url, channel, productId, variantId, pageType }: {
  url: string; channel: "shopee" | "tiktok"; productId: string; variantId: string; pageType: string;
}) {
  const label = channel === "shopee" ? "Xem giá trên Shopee" : "Xem giá trên TikTok Shop";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener nofollow sponsored"
      className={channel === "shopee" ? "btn-primary w-full" : "btn-dark w-full"}
      onClick={() => track({ type: "marketplace_click", channel, entityId: productId, variantId, pageType, ctaType: "buy" })}
    >
      {label}
      <span aria-hidden>↗</span>
      <span className="sr-only">(mở tab mới)</span>
    </a>
  );
}
