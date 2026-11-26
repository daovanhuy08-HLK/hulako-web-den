// Kênh liên hệ dùng chung (chân trang, Liên hệ, Về HULAKO). Kênh nào để trống trong quản trị (A02) thì tự ẩn.
import type { Channels } from "@/lib/settings";
import { Icon } from "./Icon";

/** Chuẩn hoá số hotline để gọi: "0983 836 664" → "0983836664" */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
/** Hiển thị dễ đọc: 0983836664 → 0983 836 664 */
export const prettyPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : phone;
};

function Glyph({ k }: { k: keyof Channels }) {
  if (k === "tiktok" || k === "tiktokShop")
    return <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.4 2 1.7 3.4 3.9 3.6v3a7.2 7.2 0 0 1-3.9-1.2v6.4A5.8 5.8 0 1 1 10.8 9v3.1a2.8 2.8 0 1 0 2 2.7V3h3.8Z" /></svg>;
  if (k === "zalo") return <span aria-hidden className="text-[11px] font-black tracking-tight text-[#0068FF]">Zalo</span>;
  if (k === "messenger") return <Icon name="chat" size={18} className="text-[#0866FF]" />;
  return <Icon name="bag" size={18} className="text-brand" />;
}

const LABEL: Record<keyof Channels, string> = {
  shopee: "Gian hàng Shopee", tiktokShop: "TikTok Shop", tiktok: "Kênh TikTok", zalo: "Chat Zalo", messenger: "Messenger",
};
const ORDER: (keyof Channels)[] = ["shopee", "tiktokShop", "tiktok", "zalo", "messenger"];

/** Hàng nút các nền tảng (ảnh mẫu chân trang: nút viền trắng "Gian hàng Shopee").
 *  compact: bản nhỏ cho dải liên hệ dưới menu — một hàng, vuốt ngang trên điện thoại. */
export function ChannelButtons({ ch, className = "", compact = false, phone }: { ch: Channels; className?: string; compact?: boolean; phone?: string }) {
  const items = ORDER.filter((k) => ch[k]?.startsWith("https://"));
  if (!items.length && !phone) return null;
  const btn = compact
    ? "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3 text-[13px] font-semibold text-ink transition hover:border-brand hover:text-brand-dark"
    : "btn-line btn-sm gap-2";
  return (
    <ul className={`flex gap-2 ${compact ? "flex-nowrap" : "flex-wrap"} ${className}`} aria-label="Kênh liên hệ của HULAKO">
      {compact && phone && (
        <li className="shrink-0">
          <a href={telHref(phone)} className={`${btn} !border-brand !bg-brand !text-white hover:!bg-brand-dark`}>
            <Icon name="phone" size={15} />Hotline {prettyPhone(phone)}
          </a>
        </li>
      )}
      {items.map((k) => (
        <li key={k} className="shrink-0">
          <a href={ch[k]} target="_blank" rel="noopener" className={btn}>
            <Glyph k={k} />{LABEL[k]}<span className="sr-only"> (mở tab mới)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Dòng hotline bấm gọi được */
export function HotlineLink({ phone, className = "" }: { phone?: string; className?: string }) {
  if (!phone) return null;
  return (
    <a href={telHref(phone)} className={`inline-flex items-center gap-2.5 hover:text-brand ${className}`}>
      <Icon name="phone" size={20} className="shrink-0 text-brand" />
      <span>Hotline: <b className="font-semibold text-ink">{prettyPhone(phone)}</b></span>
    </a>
  );
}
