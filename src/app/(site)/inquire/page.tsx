import type { Metadata } from "next";
import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { inquirePage } from "@/content/site";
import { getFeaturedPhotos } from "@/lib/site-data";
import { InquiryForm } from "./inquiry-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Inquire",
  description: "Inquire about wedding, engagement, senior, portrait or branding photography with Scarlet Estelle.",
};

export default async function InquirePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ type }, featured] = await Promise.all([searchParams, getFeaturedPhotos(12)]);
  const side = featured[1] ?? featured[0] ?? null;
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 pt-32 md:px-10 md:pt-44">
      <Reveal className="text-center">
        <SectionTitle script={inquirePage.script} label={inquirePage.line} center size="xl" />
      </Reveal>
      <div className="mt-14 grid gap-12 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-16">
        <div className="hidden md:block">
          <div className="sticky top-32">
            <div className="relative aspect-[4/5] overflow-hidden bg-linen">
              {side && <Photo photo={side} fill sizes="40vw" />}
            </div>
            <p className="script inked mt-6 text-center text-[2.4rem] text-scarlet">can&rsquo;t wait to meet you</p>
          </div>
        </div>
        <div className="bg-cream/70 px-5 py-8 shadow-[0_20px_50px_-30px_rgb(42_18_19/0.35)] sm:px-8 md:px-12 md:py-12">
          <InquiryForm initialType={type} />
        </div>
      </div>
    </section>
  );
}
