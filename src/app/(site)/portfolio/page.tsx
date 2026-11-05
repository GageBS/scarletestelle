import type { Metadata } from "next";
import Link from "next/link";
import { Photo, PhotoPlaceholder } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { InquireBand } from "@/components/site/cta";
import { portfolioIntro } from "@/content/site";
import { getCategories } from "@/lib/site-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Portfolio",
  description: "Weddings, couples, seniors and branding — a curated portfolio on film and digital.",
};

export default async function PortfolioPage() {
  const cats = await getCategories();
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-32 md:px-10 md:pb-24 md:pt-44">
        <Reveal>
          <SectionTitle script={portfolioIntro.script} label={portfolioIntro.line} center size="xl" />
        </Reveal>
        <p className="label mt-10 text-center text-muted">Choose a collection</p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:mt-10 md:gap-6">
          {cats.map((c, i) => (
            <Reveal key={c.id} delay={i * 90}>
              <Link href={`/portfolio/${c.slug}`} className="group relative block overflow-hidden bg-noir">
                <div className="relative aspect-[3/4] md:aspect-[4/5]">
                  {c.cover ? (
                    <Photo
                      photo={c.cover}
                      fill
                      sizes="(min-width: 768px) 45vw, 50vw"
                      className="opacity-90 transition duration-[1.2s] group-hover:scale-105 group-hover:opacity-100"
                    />
                  ) : (
                    <PhotoPlaceholder className="absolute inset-0" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-noir/70 via-noir/5 to-transparent" />
                  <div className="absolute inset-2 border border-cream/30 md:inset-4" />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-2 pb-5 text-center text-cream md:pb-10">
                  <span className="label text-cream/75">{String(i + 1).padStart(2, "0")}</span>
                  <span className="display mt-1 text-[1.35rem] uppercase tracking-[0.14em] md:text-[2.6rem]">
                    {c.name}
                  </span>
                  {c.tagline && (
                    <span className="script inked -mt-0.5 text-[1.35rem] text-blush md:text-[2rem]">{c.tagline}</span>
                  )}
                  <span className="label mt-2 hidden text-cream/70 md:block">
                    {c.count} images · view →
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
      <InquireBand photo={cats[0]?.cover} />
    </>
  );
}
