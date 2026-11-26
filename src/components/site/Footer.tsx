import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { ChannelButtons, HotlineLink } from "./Channels";

// Chân trang: Tuyển dụng và Liên hệ đặt ở đây theo đặc tả; thông tin pháp nhân lấy từ cấu hình tập trung (A02).
export async function Footer() {
  const [c, ch] = await Promise.all([getSetting("company"), getSetting("channels")]);
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.4fr]">
        <div>
          <Logo size="sm" />
          <p className="mt-3 text-sm font-bold tracking-[0.14em] text-brand-dark">{c.slogan}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{c.aboutIntro}</p>
        </div>
        <nav aria-label="Khám phá">
          <h2 className="text-[15px] font-bold">Khám phá</h2>
          <ul className="mt-4 space-y-2.5 text-[15px] text-ink-soft">
            <li><Link href="/thiet-bi" className="hover:text-brand">Thiết bị</Link></li>
            <li><Link href="/goc-livestream" className="hover:text-brand">Góc livestream</Link></li>
            <li><Link href="/chon-den" className="hover:text-brand">Chọn đèn theo phòng</Link></li>
            <li><Link href="/kien-thuc" className="hover:text-brand">Kiến thức</Link></li>
            <li><Link href="/tin-tuc" className="hover:text-brand">Tin tức</Link></li>
          </ul>
        </nav>
        <nav aria-label="Công ty">
          <h2 className="text-[15px] font-bold">Công ty</h2>
          <ul className="mt-4 space-y-2.5 text-[15px] text-ink-soft">
            <li><Link href="/ve-hulako" className="hover:text-brand">Về HULAKO</Link></li>
            <li><Link href="/ho-tro" className="hover:text-brand">Hỏi đáp & hỗ trợ</Link></li>
            <li><Link href="/tuyen-dung" className="hover:text-brand">Tuyển dụng</Link></li>
            <li><Link href="/lien-he" className="hover:text-brand">Liên hệ</Link></li>
          </ul>
        </nav>
        <div className="text-[15px] text-ink-soft">
          <h2 className="font-bold text-ink">Thông tin</h2>
          <p className="mt-4 flex gap-2.5"><Icon name="building" size={20} className="mt-0.5 shrink-0 text-brand" /><span><span className="font-semibold text-ink">{c.legalName}</span><br />MST: {c.taxCode}</span></p>
          <p className="mt-2.5 flex gap-2.5"><Icon name="pin" size={20} className="mt-0.5 shrink-0 text-brand" />{c.address}</p>
          {c.phone && <p className="mt-2.5"><HotlineLink phone={c.phone} /></p>}
          <p className="mt-2.5 flex gap-2.5"><Icon name="mail" size={20} className="mt-0.5 shrink-0 text-brand" /><a href={`mailto:${c.email}`} className="hover:text-brand">{c.email}</a></p>
          <ChannelButtons ch={ch} className="mt-4" />
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-[13px] text-ink-muted">
        © {new Date().getFullYear()} {c.legalName}. {c.trademarkNote}
      </div>
    </footer>
  );
}
