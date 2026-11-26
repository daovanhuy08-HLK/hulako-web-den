"use client";
// Lỗi không lường trước trong trang quản trị: không lộ stack trace, cho thử lại.
import Link from "next/link";
import { Icon } from "@/components/admin/icons";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="card w-full max-w-2xl px-6 py-10 text-center">
        <span className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-[#FDECEC] text-[#B42318]"><Icon name="alert" className="h-10 w-10" /></span>
        <h1 className="mt-5 text-2xl font-extrabold">Không tải được trang</h1>
        <p className="mt-2 text-ink-soft">Có lỗi khi đọc dữ liệu hoặc bạn không có quyền với thao tác này. Dữ liệu chưa bị thay đổi.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="btn-primary" onClick={() => reset()}><Icon name="refresh" /> Thử lại</button>
          <Link href="/admin" className="btn-line"><Icon name="home" /> Về tổng quan</Link>
        </div>
      </div>
    </div>
  );
}
