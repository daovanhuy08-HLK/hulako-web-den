import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { MobileMenu } from "./MobileMenu";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { Icon } from "./Icon";
import { ChannelButtons } from "./Channels";

// Menu chuẩn theo đặc tả (Quy ước thiết kế): giữ cùng thứ tự và cách viết trên mọi trang.
export const MAIN_NAV = [
  { href: "/", label: "Trang chủ" },
  { href: "/ve-hulako", label: "Về HULAKO" },
  { href: "/thiet-bi", label: "Thiết bị" },
  { href: "/goc-livestream", label: "Góc livestream" },
  { href: "/kien-thuc", label: "Kiến thức", also: ["/tin-tuc"] },
  { href: "/ho-tro", label: "Hỗ trợ" },
];

export async function Header() {
  const [ch, c] = await Promise.all([getSetting("channels"), getSetting("company")]);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <a href="#noi-dung" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Bỏ qua tới nội dung
      </a>
      <div className="container-page relative flex h-16 items-center justify-between gap-3 lg:h-[76px]">
        <MobileMenu items={MAIN_NAV} />
        <Link href="/" aria-label="HULAKO — về trang chủ" className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
          <Logo />
        </Link>
        <NavLinks items={MAIN_NAV} />
        <div className="flex items-center gap-2 lg:gap-4">
          <Link href="/tim-kiem" aria-label="Tìm kiếm" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-black/5">
            <Icon name="search" size={26} stroke={2} />
          </Link>
          <Link href="/lien-he?chu-de=tu-van-chon-den" className="btn-primary hidden whitespace-nowrap !min-h-[48px] !px-4 lg:inline-flex xl:!px-5">Nhờ tư vấn</Link>
        </div>
      </div>
      {/* Dải phím tắt liên hệ: hotline + các nền tảng — dính cùng menu khi cuộn; điện thoại vuốt ngang */}
      <nav aria-label="Liên hệ nhanh" className="border-t border-line/70">
        <div className="container-page flex h-11 items-center gap-3">
          <span className="hidden shrink-0 text-[13px] font-semibold text-ink-muted sm:inline">Liên hệ nhanh:</span>
          <ChannelButtons compact ch={ch} phone={c.phone} className="-mx-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />
        </div>
      </nav>
    </header>
  );
}
