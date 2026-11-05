import type { Metadata } from "next";
import { Monogram } from "@/components/brand";
import { Photo } from "@/components/site/photo";
import { Print } from "@/components/site/print";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { ScriptLink } from "@/components/site/script-link";
import { InquireBand } from "@/components/site/cta";
import { aboutPage as A, approachQuote, brand } from "@/content/site";
import { aboutPortrait } from "@/lib/portrait";
import { getFeaturedPhotos } from "@/lib/site-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "About Scarlet",
  description: "Meet Scarlet Summers — the film & digital photographer behind Scarlet Estelle.",
};

export default async function AboutPage() {
  const featured = await getFeaturedPhotos(12);
  const portrait = aboutPortrait();
  return (
    <>
      <section className="grain woven relative overflow-hidden bg-moss text-cream">
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-32 md:grid-cols-[1fr_1.1fr] md:gap-20 md:px-10 md:pb-28 md:pt-44">
          <Reveal className="relative mx-auto w-full max-w-sm">
            <Print photo={portrait} tilt={-2} tape aspect="aspect-[4/5]" sizes="(min-width: 768px) 24rem, 85vw" />
            <span className="absolute -bottom-7 -right-3 rotate-6 rounded-full bg-moss p-1 text-cream">
              <Monogram size={78} />
            </span>
          </Reveal>
          <Reveal delay={120}>
            <SectionTitle script={A.script} label={A.kicker} light />
            <h1 className="display mt-8 text-[2.4rem] md:text-[3.2rem]">{A.hello}</h1>
            <div className="mt-5 space-y-4 text-[1.15rem] leading-relaxed text-cream/90">
              {A.body.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
            <p className="script inked mt-6 text-[2.6rem] text-blush">{brand.photographer}</p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <div className="grid gap-6 sm:grid-cols-3">
          {A.favorites.map((f, i) => (
            <Reveal key={f.k} delay={i * 80} className="border-t border-rule pt-5 text-center">
              <p className="label text-muted">{f.k}</p>
              <p className="display mt-2 text-[1.35rem]">{f.v}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="grain relative bg-blush">
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center md:py-28">
          <Reveal>
            <p className="label text-ink-soft">My approach</p>
            <p className="display mt-6 text-[1.45rem] leading-relaxed md:text-[1.8rem]">“{approachQuote}”</p>
            <ScriptLink href="/approach" className="mt-8">
              more on how I work
            </ScriptLink>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-3 py-16 md:grid-cols-4 md:gap-5 md:px-10">
        {featured.slice(0, 4).map((p, i) => (
          <Reveal key={p.id} delay={i * 70} className="relative aspect-[3/4] overflow-hidden bg-linen">
            <Photo photo={p} fill sizes="(min-width: 768px) 25vw, 50vw" />
          </Reveal>
        ))}
      </section>

      <InquireBand photo={featured[5]} />
    </>
  );
}
