import type { Metadata } from "next";
import Link from "next/link";
import { Photo, PhotoPlaceholder } from "@/components/site/photo";
import { FilmFrame } from "@/components/site/print";
import { Reveal } from "@/components/site/reveal";
import { ScriptLink } from "@/components/site/script-link";
import { InquireBand } from "@/components/site/cta";
import { FilmDigitalCompare } from "@/components/site/film-digital";
import { approachPage as A, brand } from "@/content/site";
import { getFeaturedPhotos, getMediumPhotos } from "@/lib/site-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Approach",
  description:
    "Documenting moments as they naturally unfold, with gentle direction — and how I use film and digital together.",
};

export default async function ApproachPage() {
  const [featured, film, digital] = await Promise.all([
    getFeaturedPhotos(12),
    getMediumPhotos("film", 3),
    getMediumPhotos("digital", 3),
  ]);
  const p = (i: number) => featured[i % Math.max(featured.length, 1)] ?? null;

  return (
    <>
      {/* centered still-life image, like a book plate */}
      <section className="mx-auto max-w-4xl px-6 pt-28 md:pt-40">
        <Reveal className="mx-auto max-w-[26rem]">
          <div className="relative aspect-square overflow-hidden bg-linen">
            {p(3) ? <Photo photo={p(3)!} fill preload sizes="(min-width: 768px) 26rem, 90vw" /> : <PhotoPlaceholder className="absolute inset-0" />}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <Reveal>
          <h1 className="display text-[2.8rem] uppercase leading-none tracking-[0.04em] md:text-[4.4rem]">
            My Approach
          </h1>
          <p className="mt-4 text-[1.25rem] md:text-[1.45rem]">{A.intro}</p>
          <p className="mt-8 text-[1.25rem] md:text-[1.45rem]">{A.vowLead}</p>
          <p className="script inked mt-1 text-[2.8rem] leading-[1.1] text-scarlet md:text-[4.4rem]">{A.vowScript}</p>
          <div className="mt-8 space-y-5 text-[1.2rem] leading-relaxed md:text-[1.35rem]">
            {A.body.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
          <p className="display mt-12 text-[1.5rem] uppercase tracking-[0.06em] md:text-[2rem]">{A.closing}</p>
          <p className="script inked text-[2.6rem] text-scarlet md:text-[3.2rem]">{brand.photographer}</p>
        </Reveal>
      </section>

      {/* image pair */}
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-3 md:gap-10 md:px-10">
        {[p(0), p(5)].map((ph, i) => (
          <Reveal key={i} delay={i * 120} className="relative aspect-square overflow-hidden bg-linen">
            {ph && <Photo photo={ph} fill sizes="(min-width: 768px) 45vw, 50vw" />}
          </Reveal>
        ))}
      </section>

      {/* FILM & DIGITAL */}
      <section id="film-digital" className="scroll-mt-24 px-6 py-20 md:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="script inked text-[3.6rem] leading-none text-scarlet md:text-[5.4rem]">{A.filmDigital.script}</h2>
          <p className="mt-6 text-left text-[1.2rem] leading-relaxed md:text-center md:text-[1.3rem]">{A.filmDigital.lead}</p>
        </Reveal>
        <div className="mx-auto mt-14 max-w-6xl">
          <FilmDigitalCompare
            film={A.filmDigital.film}
            digital={A.filmDigital.digital}
            both={A.filmDigital.both}
            filmVisual={<FilmFrame photo={film[0] ?? p(1)} label="Kodak Portra 400" aspect="aspect-[4/5]" sizes="(min-width: 768px) 40vw, 90vw" />}
            digitalVisual={
              <div className="relative aspect-[4/5] overflow-hidden bg-linen">
                {(digital[0] ?? p(2)) && <Photo photo={(digital[0] ?? p(2))!} fill sizes="(min-width: 768px) 40vw, 90vw" />}
              </div>
            }
          />
        </div>
      </section>

      {/* image pair, offset */}
      <section className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-6 md:gap-10">
        <Reveal className="relative aspect-[3/4] overflow-hidden bg-linen">
          {(film[1] ?? p(6)) && <Photo photo={(film[1] ?? p(6))!} fill sizes="45vw" />}
        </Reveal>
        <Reveal delay={120} className="relative mt-16 aspect-[3/4] overflow-hidden bg-linen md:mt-28">
          {(digital[1] ?? p(7)) && <Photo photo={(digital[1] ?? p(7))!} fill sizes="45vw" className="grayscale" />}
        </Reveal>
      </section>

      {/* A DAY FULLY TAILORED TO YOU */}
      <section className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <Reveal>
          <h2 className="display text-[2.3rem] uppercase leading-[1.05] tracking-[0.03em] md:text-[3.8rem]">
            {A.tailored.title}
          </h2>
          <p className="script inked -mt-1 text-[2.6rem] text-scarlet md:text-[3.6rem]">{A.tailored.script}</p>
          <div className="mt-6 space-y-5 text-[1.2rem] leading-relaxed md:text-[1.3rem]">
            {A.tailored.body.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </Reveal>
      </section>

      {/* process steps */}
      <section className="grain woven relative bg-blush">
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <p className="label text-center text-ink-soft">How it works</p>
          <ol className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {A.steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 70} className="border-t border-ink/20 pt-5">
                <p className="display text-[2.4rem] leading-none text-scarlet">{s.n}</p>
                <p className="display mt-3 text-[1.5rem] uppercase tracking-[0.08em]">{s.title}</p>
                <p className="mt-2 text-ink-soft">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center md:py-28">
        <Reveal>
          <p className="script inked text-[3rem] leading-tight text-scarlet md:text-[4.6rem]">{A.craft.script}</p>
          <p className="display mt-2 text-[1.3rem] md:text-[1.6rem]">{A.craft.line}</p>
          <div className="mt-10 flex flex-col items-center gap-6">
            <Link href="/experience" className="label border border-ink px-8 py-4 transition hover:bg-ink hover:text-cream">
              See the experience & collections
            </Link>
            <ScriptLink href="/inquire">or inquire with me</ScriptLink>
          </div>
        </Reveal>
      </section>

      <InquireBand photo={p(8)} />
    </>
  );
}
