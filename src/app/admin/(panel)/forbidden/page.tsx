// Màn 065 — Không có quyền truy cập. requirePage() chuyển tới đây khi thiếu quyền.
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Icon } from "@/components/admin/icons";
import { BackLink } from "@/components/admin/BackLink";

export const metadata = { title: "Không có quyền truy cập" };

export default async function Forbidden({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-3xl px-6 py-12 text-center sm:px-12">
        <span className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-brand-soft text-brand"><Icon name="lock" className="h-12 w-12" /></span>
        <h1 className="mt-6 text-3xl font-extrabold">Bạn chưa có quyền truy cập</h1>
        <p className="mt-3 text-lg text-ink-soft">Liên hệ quản trị viên để được cấp quyền phù hợp.</p>
        {sp.need && <p className="mt-2 text-xs text-ink-muted">Quyền cần có: <code>{sp.need}</code></p>}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/admin" className="btn-primary min-w-[220px]"><Icon name="home" /> Về tổng quan</Link>
          <BackLink />
        </div>
      </div>
    </div>
  );
}
