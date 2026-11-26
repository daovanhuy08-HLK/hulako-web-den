"use client";
// P04 khối đầu trang thiết bị (ảnh 003, 076, 070): chọn phiên bản → đổi đúng ảnh, thành phần, thông số và link mua (T02).
// Link thiếu thì ẩn; chưa có link nào → mời tư vấn kèm đúng mã biến thể; sản phẩm tạm ngừng → nhãn + lối tư vấn.
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { track } from "./track";
import { Icon } from "./site/Icon";

export type VariantView = {
  id: string; sku: string; name: string; status: string;
  components: string[]; specs: { label: string; value: string }[];
  images: { url: string; alt: string; kind?: string }[];
  links: { channel: "shopee" | "tiktok"; url: string }[];
};

function TikTokGlyph() {
  return <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.4 2 1.7 3.4 3.9 3.6v3a7.2 7.2 0 0 1-3.9-1.2v6.4A5.8 5.8 0 1 1 10.8 9v3.1a2.8 2.8 0 1 0 2 2.7V3h3.8Z" /></svg>;
}

function BuyButton({ link, productId, variantId }: { link: { channel: "shopee" | "tiktok"; url: string }; productId: string; variantId: string }) {
  const shopee = link.channel === "shopee";
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener nofollow sponsored"
      className={shopee ? "btn-primary !min-h-[54px] w-full lg:w-auto" : "btn !min-h-[54px] w-full bg-ink text-white hover:bg-black lg:w-auto lg:border lg:border-line lg:bg-white lg:text-ink lg:hover:border-ink/40 lg:hover:bg-white"}
      onClick={() => track({ type: "marketplace_click", channel: link.channel, entityId: productId, variantId, pageType: "product", ctaType: "buy" })}
    >
      {shopee ? <Icon name="bag" size={24} /> : <TikTokGlyph />}
      {shopee ? "Xem giá trên Shopee" : "Xem giá trên TikTok Shop"}
      <Icon name="chevron" size={20} className="ml-auto lg:hidden" />
      <span className="sr-only">(mở tab mới)</span>
    </a>
  );
}

export function VariantPicker({ productId, productName, variants, paused, isSample }: { productId: string; productName: string; variants: VariantView[]; paused: boolean; isSample?: boolean }) {
  const [vid, setVid] = useState(variants[0]?.id);
  const [img, setImg] = useState(0);
  const [openBox, setOpenBox] = useState(false);
  const v = variants.find((x) => x.id === vid) ?? variants[0];
  const image = v?.images[img] ?? v?.images[0];
  const consultHref = `/lien-he?chu-de=tu-van-chon-den&san-pham=${encodeURIComponent(v ? `${productName} (${v.sku})` : productName)}`;
  const onConsult = () => track({ type: "consult_click", entityId: productId, variantId: v?.id, pageType: "product", ctaType: "product_consult" });
  const order: ("shopee" | "tiktok")[] = ["shopee", "tiktok"];

  const title = (
    <>
      <h1 className="text-[30px] font-extrabold leading-tight tracking-tight sm:text-[40px] lg:text-[46px]">{productName}</h1>
      {isSample && <p className="mt-1 text-sm text-ink-muted lg:hidden">Sản phẩm minh họa</p>}
      {isSample && <span className="tag-sample mt-3 hidden lg:inline-flex">Sản phẩm minh họa</span>}
    </>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
      <div className="lg:hidden">{title}</div>

      {/* Thư viện ảnh: điện thoại ảnh lớn + hàng thumbnail; máy tính thumbnail dọc bên trái */}
      <div className="flex flex-col gap-3 lg:flex-row-reverse lg:gap-5">
        <div className="relative aspect-[4/3] flex-1 overflow-hidden rounded-card bg-[#F1EEEA] lg:aspect-[636/514]">
          {image ? <Image key={image.url} src={image.url} alt={image.alt} fill priority sizes="(max-width: 1024px) 100vw, 640px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-ink-muted">Chưa có ảnh</div>}
          {paused && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-brand-dark">Tạm ngừng bán</span>}
        </div>
        {v && v.images.length > 1 && (
          <ul className="grid grid-cols-3 gap-3 max-lg:[&>li:nth-child(n+4)]:hidden lg:flex lg:w-[112px] lg:flex-col" aria-label="Ảnh khác của phiên bản">
            {v.images.slice(0, 5).map((im, n) => (
              <li key={im.url + n}>
                <button type="button" onClick={() => setImg(n)} aria-label={`Xem ảnh: ${im.alt}`} aria-pressed={n === img}
                  className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl border-2 bg-white lg:aspect-square ${n === img ? "border-brand" : "border-line hover:border-ink/30"}`}>
                  <Image src={im.url} alt="" fill sizes="120px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0">
        <div className="hidden lg:block">{title}</div>

        {paused ? (
          <div className="mt-2 text-center lg:mt-6 lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 font-semibold text-brand-dark"><Icon name="alert" size={20} />Tạm ngừng bán</span>
            <p className="mx-auto mt-4 max-w-md text-[17px] text-ink-soft lg:mx-0">Bạn vẫn có thể xem hướng dẫn và nhờ tư vấn thiết bị phù hợp.</p>
            <div className="mt-5 grid gap-3 sm:flex">
              <Link href={consultHref} onClick={onConsult} className="btn-primary !min-h-[52px]">Nhờ tư vấn <Icon name="chevron" size={18} /></Link>
              <Link href="/thiet-bi" className="btn-outline !min-h-[52px] !text-ink">Xem thiết bị khác <Icon name="chevron" size={18} /></Link>
            </div>
          </div>
        ) : v ? (
          <>
            {variants.length > 1 && (
              <fieldset className="mt-1 lg:mt-7">
                <legend className="text-[19px] font-semibold lg:text-[21px]"><span className="lg:hidden">Chọn phiên bản</span><span className="hidden lg:inline">Phiên bản</span></legend>
                <div className="mt-3 grid grid-cols-2 gap-3 lg:flex lg:flex-wrap">
                  {variants.map((x) => {
                    const on = x.id === v.id;
                    return (
                      <label key={x.id} className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border px-4 text-[16px] font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand lg:min-w-[270px] lg:text-[19px] ${on ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white hover:border-ink/30"}`}>
                        <input type="radio" name="variant" value={x.id} checked={on} onChange={() => { setVid(x.id); setImg(0); }} className="h-5 w-5 accent-[#FA6803] lg:sr-only" />
                        {x.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Thành phần bộ: điện thoại hiện sẵn danh sách; máy tính là dòng mở rộng (ảnh 076) */}
            {v.components.length > 0 && (
              <div className="card mt-5 lg:mt-7 lg:rounded-none lg:border-x-0 lg:bg-transparent">
                <button type="button" onClick={() => setOpenBox((o) => !o)} aria-expanded={openBox} className="hidden w-full items-center justify-between py-4 text-left lg:flex">
                  <span><span className="block text-[21px] font-semibold">Thành phần bộ</span><span className="mt-1 block text-[17px] text-ink-muted">Xem cấu hình theo phiên bản đã chọn</span></span>
                  <Icon name="chevron" size={24} className={`transition ${openBox ? "rotate-90" : ""}`} />
                </button>
                <div className={`p-4 lg:px-0 lg:pt-0 ${openBox ? "" : "lg:hidden"}`} aria-live="polite">
                  <h2 className="text-[17px] font-bold lg:hidden">Trong hộp có gì</h2>
                  <ul className="mt-2 space-y-1 text-[15px] text-ink-soft lg:mt-0 lg:text-[16px]">
                    {v.components.map((c) => <li key={c} className="flex gap-2.5"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{c}</li>)}
                  </ul>
                  <p className="mt-3 text-sm text-ink-muted">Mã phiên bản: <span className="font-mono font-semibold text-ink">{v.sku}</span></p>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-3 lg:mt-7 lg:flex lg:flex-wrap" aria-live="polite">
              {order.map((ch) => { const l = v.links.find((x) => x.channel === ch); return l ? <BuyButton key={ch} link={l} productId={productId} variantId={v.id} /> : null; })}
              {v.links.length === 0 && (
                <p className="rounded-xl bg-white p-4 text-[15px] text-ink-soft ring-1 ring-line lg:w-full">Phiên bản <b>{v.sku}</b> chưa có link mua công khai. Gửi tư vấn kèm mã này để HULAKO hỗ trợ.</p>
              )}
              <Link href={consultHref} onClick={onConsult}
                className={v.links.length ? "inline-flex items-center justify-center gap-2 py-1 font-semibold text-brand-dark lg:btn-line lg:!min-h-[54px] lg:!text-ink" : "btn-primary !min-h-[54px]"}>
                <Icon name="chat" size={22} />{v.links.length ? <><span className="lg:hidden">Nhờ tư vấn chọn đèn</span><span className="hidden lg:inline">Nhờ tư vấn</span></> : `Nhờ tư vấn mã ${v.sku}`}
              </Link>
            </div>

            {v.specs.length > 0 && (
              <section className="mt-7">
                <h2 className="text-lg font-bold">Thông số đã kiểm</h2>
                <dl className="card mt-3 divide-y divide-line">
                  {v.specs.map((s) => (
                    <div key={s.label} className="grid grid-cols-[42%_1fr] gap-3 px-4 py-2.5 text-[15px]"><dt className="text-ink-muted">{s.label}</dt><dd className="font-medium">{s.value}</dd></div>
                  ))}
                </dl>
              </section>
            )}
            {/* Câu ghi chú bắt buộc theo DNA mục 9 — luôn hiện trên trang sản phẩm */}
            <p className="mt-3 text-xs text-ink-muted">Kết quả ánh sáng thực tế phụ thuộc diện tích phòng, khoảng cách đặt đèn và thiết bị quay của bạn.</p>
          </>
        ) : (
          <div className="mt-6"><Link href={consultHref} className="btn-primary">Nhờ tư vấn</Link></div>
        )}
      </div>
    </div>
  );
}
