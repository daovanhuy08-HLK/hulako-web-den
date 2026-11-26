"use client";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

/** Nút "Quay lại" theo lịch sử trình duyệt */
export function BackLink({ label = "Quay lại", className = "btn-line min-w-[180px]" }: { label?: string; className?: string }) {
  const router = useRouter();
  return <button type="button" className={className} onClick={() => router.back()}><Icon name="arrowLeft" /> {label}</button>;
}
