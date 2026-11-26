// P13 Chọn đèn theo phòng (giai đoạn 2). Chưa kích hoạt bảng quy tắc → API trả needsConsultation → form tư vấn kèm bối cảnh.
import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { SelectorTool } from "@/components/SelectorTool";

export const metadata: Metadata = {
  title: "Chọn đèn livestream theo phòng",
  description: "Chọn diện tích, mặt hàng và kiểu live để xem bố trí đèn tham khảo và bộ thiết bị phù hợp — không cần để lại số điện thoại.",
  alternates: { canonical: "/chon-den" },
};
export const revalidate = 60;

export default async function SelectorPage() {
  const consent = await getSetting("consent");
  return (
    <div className="container-page pb-6 pt-0 sm:pt-6 lg:py-10">
      <SelectorTool consentText={consent.lead} />
    </div>
  );
}
