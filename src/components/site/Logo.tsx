// Logo chữ theo ảnh thiết kế: "HULA" đen + "KO" cam. Thay bằng tệp logo gốc đã duyệt khi bàn giao (đặc tả: Quy ước thiết kế).
export function Logo({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-[40px]" : size === "sm" ? "text-[24px]" : "text-[30px] sm:text-[34px]";
  return (
    <span className={`font-black leading-none tracking-[-0.03em] ${cls} ${className}`}>
      <span className="text-ink">HULA</span><span className="text-brand">KO</span>
    </span>
  );
}
