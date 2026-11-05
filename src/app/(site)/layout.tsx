import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { getFeaturedPhotos } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const strip = await getFeaturedPhotos(6);
  return (
    <>
      <SiteHeader />
      <main className="min-h-dvh">{children}</main>
      <SiteFooter strip={strip} />
    </>
  );
}
