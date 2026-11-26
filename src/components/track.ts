"use client";
// Gửi sự kiện đo lường. Dùng sendBeacon để không chặn việc chuyển trang sang sàn.
export type TrackEvent = {
  type: "marketplace_click" | "consult_click" | "selector_complete" | "page_view";
  pageType?: string;
  entityId?: string;
  variantId?: string;
  channel?: "shopee" | "tiktok";
  ctaType?: string;
};

export function track(e: TrackEvent) {
  try {
    const body = JSON.stringify({ eventId: crypto.randomUUID(), pagePath: location.pathname, pageType: "", ...e });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch { /* đo lường không bao giờ được làm hỏng trải nghiệm */ }
}
