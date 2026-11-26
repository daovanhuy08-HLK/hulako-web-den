// 404 (ảnh 043): HTTP 404 kèm đường về trang chủ, ô tìm kiếm và lối vào thiết bị / kiến thức.
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Cover } from "@/components/ui";
import { Icon } from "@/components/site/Icon";

export const metadata = { title: "Không tìm thấy trang", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="noi-dung" className="container-page max-w-[640px] py-10 text-center">
        <p className="relative mx-auto w-fit text-[110px] font-black leading-none tracking-tight text-brand sm:text-[140px]">404<Icon name="spark" size={44} stroke={2.6} className="absolute -right-10 -top-2" /></p>
        <h1 className="mt-3 text-[28px] font-extrabold sm:text-[36px]">Trang bạn tìm chưa có</h1>
        <p className="mt-2 text-[16px] text-ink-soft sm:text-[18px]">Bạn có thể tìm thiết bị hoặc bài hướng dẫn bên dưới.</p>
        <form action="/tim-kiem" role="search" className="relative mt-6">
          <label htmlFor="q404" className="sr-only">Tìm thiết bị, cách setup</label>
          <Icon name="search" size={24} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input id="q404" name="q" type="search" placeholder="Tìm thiết bị, cách setup..." className="input !min-h-[56px] pl-14" />
        </form>
        <div className="mt-5 space-y-3 text-left">
          {[{ href: "/thiet-bi", label: "Thiết bị livestream", img: "/demo/sp-softbox-vuong.jpg" }, { href: "/kien-thuc", label: "Kiến thức setup", img: "/demo/bai-setup-don-gian.jpg" }].map((x) => (
            <Link key={x.href} href={x.href} className="card flex items-center gap-4 p-2 hover:border-brand">
              <div className="w-[40%] max-w-[160px] shrink-0 overflow-hidden rounded-lg"><Cover src={x.img} alt="" ratio="aspect-[16/10]" sizes="160px" /></div>
              <span className="flex-1 text-[20px] font-bold">{x.label}</span><Icon name="chevron" size={24} className="mr-2 text-brand" />
            </Link>
          ))}
        </div>
        <Link href="/" className="btn-primary mt-6 w-full !min-h-[56px] !text-[18px]">Về trang chủ <Icon name="chevron" size={20} /></Link>
        <Link href="/lien-he" className="mt-5 inline-block text-[16px] underline underline-offset-4">Liên hệ HULAKO</Link>
      </main>
      <Footer />
    </>
  );
}
