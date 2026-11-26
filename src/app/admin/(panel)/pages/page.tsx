// A02 Quản lý trang công ty (màn 022): Trang chủ, Giới thiệu (thông tin công ty dùng chung), Menu & chân trang (kênh liên hệ), Popup quà tặng.
// Cấu hình lưu là áp dụng ngay (chưa có bước nháp/duyệt cho trang tĩnh — sứ mệnh/tầm nhìn/giá trị chỉ hiện khi tích "Đã duyệt").
import Image from "next/image";
import Link from "next/link";
import { requirePage } from "@/lib/admin-page";
import { getSetting } from "@/lib/settings";
import { ActionForm, SubmitFor } from "@/components/admin/ActionForm";
import { Badge, Field, LinkRow, PageTitle, Panel, Tabs, Toggle } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { saveChannels, saveCompany, saveHome, saveLeadMagnet } from "../../actions/settings";

export const metadata = { title: "Trang công ty" };
const TABS = [{ key: "home", label: "Trang chủ" }, { key: "about", label: "Giới thiệu" }, { key: "footer", label: "Menu và chân trang" }, { key: "popup", label: "Popup quà tặng" }];
const PUBLIC: Record<string, string> = { home: "/", about: "/ve-hulako", footer: "/lien-he", popup: "/kien-thuc" };

export default async function PagesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("pages.edit");
  const want = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === want)?.key ?? "about";
  const [c, home, ch, lm] = await Promise.all([getSetting("company"), getSetting("home"), getSetting("channels"), getSetting("leadMagnet")]);
  const formId = `${tab}-form`;
  const blocks: Record<string, { href: string; icon: "file" | "building" | "mail" | "image" | "link" | "sparkles"; label: string }[]> = {
    about: [{ href: "#gioi-thieu", icon: "file", label: "Giới thiệu" }, { href: "#phap-nhan", icon: "building", label: "Thông tin công ty" }, { href: "#su-menh", icon: "sparkles", label: "Sứ mệnh · tầm nhìn · giá trị" }],
    home: [{ href: "#hero", icon: "image", label: "Ảnh & tiêu đề hero" }, { href: "#nhu-cau", icon: "link", label: "Lối vào theo nhu cầu" }],
    footer: [{ href: "#kenh", icon: "mail", label: "Kênh liên hệ & gian hàng" }],
    popup: [{ href: "#popup", icon: "sparkles", label: "Popup quà tặng" }],
  };

  return (
    <>
      <PageTitle title="Quản lý trang công ty">
        <Link href={PUBLIC[tab]} target="_blank" className="btn-line"><Icon name="eye" /> Xem trước</Link>
        <SubmitFor form={formId} label="Lưu & áp dụng" icon="send" />
      </PageTitle>
      <Tabs base="/admin/pages" current={tab} tabs={TABS} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          {tab === "about" && (
            <ActionForm action={saveCompany} id={formId} toast buttons={null}>
              <Panel className="!mb-5">
                <div id="gioi-thieu" className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-4">
                    <Field label="Tên thương hiệu (tiêu đề trang)" name="brand" defaultValue={c.brand} required />
                    <Field label="Giới thiệu thương hiệu" name="aboutIntro" defaultValue={c.aboutIntro} rows={4} required />
                    <Field label="Lý do ra đời" name="aboutWhy" defaultValue={c.aboutWhy} rows={4} />
                    <Field label="Slogan" name="slogan" defaultValue={c.slogan} />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[15px] font-semibold">Ảnh giới thiệu</p>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-[#F1F0EE]">{home.heroImage && <Image src={home.heroImage} alt={home.heroAlt} fill sizes="320px" className="object-cover" unoptimized />}<span className="absolute right-2 top-2 rounded-lg bg-white/90 px-2.5 py-1 text-xs">Ảnh minh họa</span></div>
                    <Link href="/admin/pages?tab=home#hero" className="btn-line mt-3 w-full"><Icon name="upload" /> Đổi ảnh (thẻ Trang chủ)</Link>
                  </div>
                </div>
                <h3 id="phap-nhan" className="mb-4 mt-6 border-t border-[#EFECE8] pt-5 text-xl font-bold">Thông tin pháp nhân</h3>
                <div className="space-y-3">
                  <Field inline label="Tên công ty" name="legalName" defaultValue={c.legalName} required />
                  <Field inline label="Mã số thuế" name="taxCode" defaultValue={c.taxCode} />
                  <Field inline label="Địa chỉ" name="address" defaultValue={c.address} />
                  <Field inline label="Email" name="email" defaultValue={c.email} required />
                  <Field inline label="Điện thoại / hotline" name="phone" defaultValue={c.phone} />
                  <Field inline label="Người sáng lập" name="founder" defaultValue={c.founder} />
                  <Field inline label="Ghi chú nhãn hiệu" name="trademarkNote" defaultValue={c.trademarkNote} hint="Chỉ ghi “đã nộp đơn đăng ký nhãn hiệu”, không dùng ® hay “đã được bảo hộ”." />
                </div>
                <h3 id="su-menh" className="mb-4 mt-6 border-t border-[#EFECE8] pt-5 text-xl font-bold">Sứ mệnh · tầm nhìn · giá trị <span className="text-sm font-normal text-ink-muted">(chỉ hiện khi đã duyệt)</span></h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div><Field label="Sứ mệnh" name="mission" defaultValue={c.mission?.text} rows={3} /><label className="mt-1.5 flex gap-2 text-sm"><input type="checkbox" name="missionApproved" defaultChecked={c.mission?.approved} /> Đã duyệt — hiển thị</label></div>
                  <div><Field label="Tầm nhìn" name="vision" defaultValue={c.vision?.text} rows={3} /><label className="mt-1.5 flex gap-2 text-sm"><input type="checkbox" name="visionApproved" defaultChecked={c.vision?.approved} /> Đã duyệt — hiển thị</label></div>
                  <div><Field label="Giá trị (mỗi dòng 1 ý)" name="values" defaultValue={c.values?.items.join("\n")} rows={3} /><label className="mt-1.5 flex gap-2 text-sm"><input type="checkbox" name="valuesApproved" defaultChecked={c.values?.approved} /> Đã duyệt — hiển thị</label></div>
                </div>
              </Panel>
            </ActionForm>
          )}
          {tab === "home" && (
            <ActionForm action={saveHome} id={formId} toast buttons={null}>
              <Panel>
                <div id="hero" className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-4">
                    <Field label="Tiêu đề hero" name="heroTitle" defaultValue={home.heroTitle} required />
                    <Field label="Mô tả hero" name="heroSubtitle" defaultValue={home.heroSubtitle} rows={3} />
                    <Field label="Ảnh hero (URL)" name="heroImage" defaultValue={home.heroImage} hint="Ảnh đã duyệt trong Thư viện ảnh" />
                    <Field label="Alt ảnh hero" name="heroAlt" defaultValue={home.heroAlt} rows={2} />
                  </div>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-[#F1F0EE]">{home.heroImage && <Image src={home.heroImage} alt={home.heroAlt} fill sizes="320px" className="object-cover" unoptimized />}</div>
                </div>
                <div id="nhu-cau" className="mt-6 border-t border-[#EFECE8] pt-5"><Field label="Lối vào theo nhu cầu (mỗi dòng: Nhãn | /duong-dan | ảnh | alt)" name="needs" rows={6} defaultValue={home.needs.map((n) => [n.label, n.href, n.image, n.alt].join(" | ")).join("\n")} /></div>
              </Panel>
            </ActionForm>
          )}
          {tab === "footer" && (
            <ActionForm action={saveChannels} id={formId} toast buttons={null}>
              <Panel title="Kênh liên hệ & gian hàng (menu, chân trang, nút tư vấn)" id="kenh">
                <div className="space-y-3">
                  <Field inline label="Zalo" name="zalo" defaultValue={ch.zalo} placeholder="https://zalo.me/…" />
                  <Field inline label="Messenger" name="messenger" defaultValue={ch.messenger} placeholder="https://m.me/…" />
                  <Field inline label="TikTok kênh" name="tiktok" defaultValue={ch.tiktok} />
                  <Field inline label="Gian hàng Shopee" name="shopee" defaultValue={ch.shopee} />
                  <Field inline label="TikTok Shop" name="tiktokShop" defaultValue={ch.tiktokShop} />
                </div>
                <p className="mt-3 text-sm text-ink-muted">Kênh nào để trống sẽ tự ẩn. Menu công khai cố định theo đặc tả: Trang chủ · Về HULAKO · Thiết bị · Góc livestream · Kiến thức · Hỗ trợ; Tuyển dụng & Liên hệ ở chân trang. Pháp nhân/email/địa chỉ chân trang lấy từ thẻ Giới thiệu.</p>
              </Panel>
            </ActionForm>
          )}
          {tab === "popup" && (
            <ActionForm action={saveLeadMagnet} id={formId} toast buttons={null}>
              <Panel title="Popup quà tặng trong bài viết (lead magnet)" id="popup">
                <Toggle name="enabled" defaultChecked={lm.enabled} label={<b>Bật popup trong các bài Kiến thức / Tin tức</b>} />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Tiêu đề" name="title" defaultValue={lm.title} />
                  <Field label="Chữ trên nút" name="buttonLabel" defaultValue={lm.buttonLabel} />
                  <Field label="Mô tả ngắn" name="subtitle" defaultValue={lm.subtitle} rows={3} />
                  <Field label="Lợi ích (mỗi dòng 1 ý, tối đa 6)" name="bullets" defaultValue={lm.bullets.join("\n")} rows={3} />
                  <Field label="Link tải quà (https://…, tuỳ chọn)" name="downloadUrl" defaultValue={lm.downloadUrl} hint="Link chỉ hiện SAU khi khách gửi đủ thông tin. Để trống: popup báo HULAKO sẽ gửi quà qua email/địa chỉ khách điền." />
                  <Field label="Lựa chọn “Lĩnh vực kinh doanh” (mỗi dòng 1 mục, luôn có thêm “Khác”)" name="businessOptions" defaultValue={lm.businessOptions.join("\n")} rows={4} />
                  <div className="grid grid-cols-2 gap-3"><Field label="Hiện sau (giây)" name="delaySeconds" type="number" defaultValue={lm.delaySeconds} /><Field label="Hoặc khi đọc tới (%)" name="scrollPercent" type="number" defaultValue={lm.scrollPercent} /></div>
                </div>
                <p className="mt-3 text-sm text-ink-muted">Khách phải điền đủ: họ tên, số điện thoại, email, lĩnh vực kinh doanh, địa chỉ nhận hàng. Người đăng ký vào Tư vấn & Hỏi đáp (nguồn “Đăng ký quà tặng”), báo Telegram/email nếu đã bật, có nút tải CSV.</p>
              </Panel>
            </ActionForm>
          )}
        </div>
        <aside>
          <Panel title="Trạng thái">
            <Badge status="public" label="Đang áp dụng trên website" />
            <p className="mt-3 text-sm text-ink-muted">Lưu là cập nhật ngay trang Về HULAKO, Liên hệ và chân trang (một nguồn dữ liệu). Kiểm tra claim theo quy tắc biên tập trước khi lưu.</p>
          </Panel>
          <Panel title="Khối nội dung">
            {blocks[tab].map((b) => <LinkRow key={b.href} href={b.href} icon={b.icon}>{b.label}</LinkRow>)}
          </Panel>
          <Panel>
            <LinkRow href="/admin/settings/audit?type=settings." icon="history">Lịch sử thay đổi</LinkRow>
          </Panel>
        </aside>
      </div>
    </>
  );
}
