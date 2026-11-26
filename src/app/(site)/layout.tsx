import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageViewTracker } from "@/components/Tracking";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="noi-dung" className="min-h-[60vh]">{children}</main>
      <Footer />
      <PageViewTracker />
    </>
  );
}
