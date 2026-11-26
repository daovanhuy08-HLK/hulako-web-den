"use client";
// Màn 047: ô Tiêu đề SEO / Mô tả tìm kiếm / Đường dẫn + xem trước kết quả Google cập nhật khi gõ.
import { useState } from "react";
import { Icon } from "./icons";

const count = (s: string, lo: number, hi: number) => (
  <span className={s.length > hi || (s.length > 0 && s.length < lo) ? "text-[#B42318]" : "text-ink-muted"}>{s.length}/{hi} ký tự</span>
);

export function SeoEditor({ seoTitle, seoDescription, slug, base, site, canonical, indexNote, coverUrl, coverAlt }: {
  seoTitle: string; seoDescription: string; slug: string; base: string; site: string; canonical: string; indexNote: string; coverUrl: string; coverAlt: string;
}) {
  const [t, setT] = useState(seoTitle);
  const [d, setD] = useState(seoDescription);
  const [s, setS] = useState(slug);
  const [img, setImg] = useState(coverUrl);
  const host = site.replace(/^https?:\/\//, "");
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <label htmlFor="seoTitle" className="mb-1.5 flex justify-between text-[15px] font-semibold">Tiêu đề SEO {count(t, 20, 65)}</label>
          <input id="seoTitle" name="seoTitle" value={t} onChange={(e) => setT(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="seoDescription" className="mb-1.5 flex justify-between text-[15px] font-semibold">Mô tả tìm kiếm {count(d, 140, 160)}</label>
          <textarea id="seoDescription" name="seoDescription" rows={3} value={d} onChange={(e) => setD(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="slug" className="mb-1.5 block text-[15px] font-semibold">Đường dẫn</label>
          <input id="slug" name="slug" value={s} onChange={(e) => setS(e.target.value)} className="input" />
          <p className="mt-1 text-xs text-ink-muted">Đổi đường dẫn bài đã công khai sẽ tự tạo chuyển hướng 301 từ URL cũ.</p>
        </div>
        <div>
          <p className="mb-1.5 text-[15px] font-semibold">URL chuẩn (canonical)</p>
          <input readOnly value={canonical} className="input bg-[#FBFAF8] text-ink-muted" aria-label="URL chuẩn" />
          <p className="mt-1 text-xs text-ink-muted">Tự sinh từ tên miền + đường dẫn công khai.</p>
        </div>
        <div>
          <p className="mb-1.5 text-[15px] font-semibold">Lập chỉ mục</p>
          <input readOnly value={indexNote} className="input bg-[#FBFAF8] text-ink-muted" aria-label="Lập chỉ mục" />
        </div>
      </section>
      <div className="space-y-5">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Xem trước tìm kiếm</h2><span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark">Bản xem trước</span></div>
          <div className="rounded-card border border-line p-4">
            <p className="truncate text-[20px] text-[#1a0dab]">{t || "(chưa có tiêu đề SEO)"} | HULAKO</p>
            <p className="truncate text-sm text-[#006621]">{host}{base}/{s}</p>
            <p className="mt-1 line-clamp-2 text-[15px] text-ink-soft">{d || "(chưa có mô tả tìm kiếm — Google sẽ tự lấy đoạn trong bài)"}</p>
          </div>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-xl font-bold">Ảnh chia sẻ</h2>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={coverAlt} className="mb-3 aspect-[1200/630] w-full rounded-card border border-line object-cover" />
          ) : (
            <div className="mb-3 flex aspect-[1200/630] flex-col items-center justify-center rounded-card border-2 border-dashed border-line text-center text-ink-muted">
              <Icon name="image" className="h-10 w-10" /><p className="mt-2 font-semibold text-ink">Chưa có ảnh</p><p className="text-sm">Dán URL ảnh đã duyệt từ Thư viện ảnh</p>
            </div>
          )}
          <label htmlFor="coverUrl" className="mb-1.5 block text-sm font-semibold">URL ảnh (dùng làm ảnh đại diện + ảnh chia sẻ)</label>
          <input id="coverUrl" name="coverUrl" value={img} onChange={(e) => setImg(e.target.value)} className="input" placeholder="https://…" />
          <label htmlFor="coverAlt" className="mb-1.5 mt-3 block text-sm font-semibold">Alt ảnh</label>
          <input id="coverAlt" name="coverAlt" defaultValue={coverAlt} className="input" />
        </section>
      </div>
    </div>
  );
}
