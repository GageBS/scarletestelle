import Link from "next/link";
import { Monogram } from "@/components/brand";
import { Photo, PhotoPlaceholder } from "@/components/site/photo";
import { aboutPortrait } from "@/lib/portrait";
import { Print, FilmFrame } from "@/components/site/print";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { ScriptLink } from "@/components/site/script-link";
import { TestimonialCarousel } from "@/components/site/testimonials";
import { InquireBand } from "@/components/site/cta";
import { aboutPage, approachQuote, brand, home } from "@/content/site";
import {
  getCategories,
  getFeaturedPhotos,
  getMediumPhotos,
  getTestimonials,
} from "@/lib/site-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, categories, quotes, film, digital] = await Promise.all([
    getFeaturedPhotos(12),
    getCategories(),
    getTestimonials(),
    getMediumPhotos("film", 2),
    getMediumPhotos("digital", 2),
  ]);
  // order featured photos by category order so the hero leads with weddings
  const catOrder = new Map(categories.map((c, i) => [c.id, i]));
  featured.sort((a, b) => (catOrder.get(a.categoryId ?? "") ?? 99) - (catOrder.get(b.categoryId ?? "") ?? 99));
  const hero = featured[0] ?? null;
  const collage = [featured[2], featured[1], featured[5] ?? featured[3]];
  const portrait = aboutPortrait();
  const approachPhoto = featured[4] ?? featured[0] ?? null;

  return (
    <>
      {/* ───────── HERO ───────── */}
      <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-noir text-cream">
        {hero ? (
          <Photo photo={hero} fill preload sizes="100vw" quality={90} className="animate-[heroZoom_18s_ease-out_forwards]" position="center 35%" />
        ) : (
          <PhotoPlaceholder className="absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-noir/45 via-noir/10 to-noir/65" />
        {/* fine inset frame, like a print border */}
        <div className="pointer-events-none absolute inset-3 border border-cream/35 md:inset-6" />
        <div className="absolute inset-x-0 bottom-[12%] flex flex-col items-center px-6 text-center md:bottom-[16%]">
          <p className="label mb-5 text-cream/85">
            {brand.established ? `Est. ${brand.established} · ` : ""}
            {home.heroKicker}
          </p>
          <h1 className="display text-[2.6rem] uppercase leading-none tracking-[0.18em] sm:text-[3.6rem] md:text-[5.4rem] md:tracking-[0.22em]">
            Scarlet Estelle
          </h1>
          <p className="script inked -mt-1 text-[2.6rem] text-blush md:-mt-3 md:text-[4rem]">photography</p>
          <p className="label mt-5 max-w-xs text-cream/85 md:max-w-none">{home.heroServices}</p>
        </div>
        <a
          href="#welcome"
          aria-label="Scroll down"
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-cream/70 md:block"
        >
          <span className="block h-10 w-px animate-pulse bg-cream/70" />
        </a>
      </section>

      {/* ───────── WELCOME ───────── */}
      <section id="welcome" className="grain relative overflow-hidden bg-blush">
        <div className="relative z-10 mx-auto grid max-w-6xl gap-14 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:gap-20 md:px-10 md:py-32">
          <Reveal>
            <SectionTitle script={home.welcomeScript} size="xl" />
            <p className="display mt-6 text-[1.7rem] leading-snug md:text-[2.1rem]">{home.welcomeLead}</p>
            <div className="mt-6 space-y-4 text-ink-soft">
              {home.welcomeBody.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <ScriptLink href="/portfolio" className="mt-8">
              see the archives
            </ScriptLink>
          </Reveal>
          <Reveal delay={150} className="relative mx-auto w-full max-w-[460px]">
            {/* phone: two overlapping prints */}
            <div className="relative h-[420px] md:hidden">
              <Print photo={collage[0]} tilt={-4} tape className="absolute left-0 top-2 w-[60%]" sizes="60vw" />
              <Print photo={collage[1]} tilt={5} caption="on film" className="absolute right-0 top-[120px] w-[52%]" aspect="aspect-[3/4]" sizes="52vw" />
            </div>
            {/* laptop: three-print collage */}
            <div className="relative hidden h-[600px] md:block">
              <Print photo={collage[0]} tilt={-4} tape className="absolute left-0 top-0 w-[60%]" />
              <Print photo={collage[1]} tilt={5} className="absolute right-0 top-[18%] w-[50%]" aspect="aspect-[3/4]" />
              <Print photo={collage[2]} tilt={-2} caption="on film" className="absolute bottom-0 left-[12%] w-[46%]" aspect="aspect-square" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── WHAT I PHOTOGRAPH ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
        <Reveal className="mb-12 text-center md:mb-16">
          <p className="label text-muted">{home.servicesTitle}</p>
        </Reveal>
        <ul className="flex flex-col">
          {categories.map((c, i) => (
            <Reveal as="li" key={c.id} delay={i * 80}>
              <Link
                href={`/portfolio/${c.slug}`}
                className="group grid grid-cols-[72px_1fr] items-center gap-5 border-t border-rule py-5 md:grid-cols-[120px_1fr_auto] md:gap-10 md:py-7"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-linen">
                  {c.cover && <Photo photo={c.cover} fill sizes="120px" quality={70} className="transition duration-700 group-hover:scale-105" />}
                </div>
                <div className={i % 2 ? "md:pl-24" : ""}>
                  <p className="display text-[1.9rem] uppercase tracking-[0.08em] md:text-[3.2rem]">
                    <span className="mr-3 align-top font-sans text-xs tracking-[0.2em] text-muted md:text-sm">
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    {c.name}
                  </p>
                  {c.tagline && <p className="script inked -mt-1 text-[1.6rem] text-scarlet md:text-[2rem]">{c.tagline}</p>}
                </div>
                <span className="label hidden text-ink-soft transition group-hover:translate-x-1 md:block">
                  View gallery →
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
        <div className="mt-12 text-center">
          <ScriptLink href="/experience">explore the experience</ScriptLink>
        </div>
      </section>

      {/* ───────── MY APPROACH (Elise-style) ───────── */}
      <section className="border-t border-rule bg-parchment">
        <div className="mx-auto max-w-4xl px-6 py-20 md:py-28">
          <Reveal className="mx-auto max-w-md">
            <div className="relative aspect-square overflow-hidden bg-linen">
              {approachPhoto && <Photo photo={approachPhoto} fill sizes="(min-width: 768px) 28rem, 90vw" />}
            </div>
          </Reveal>
          <Reveal className="mt-14 md:px-10">
            <h2 className="display text-[2.4rem] uppercase tracking-[0.04em] md:text-[3.4rem]">My Approach</h2>
            <p className="mt-4 text-[1.2rem] leading-relaxed md:text-[1.35rem]">{approachQuote}</p>
            <p className="script inked mt-8 text-[2.5rem] leading-tight text-scarlet md:text-[3.6rem]">
              {home.approachScript}
            </p>
            <p className="script inked mt-6 text-[2rem] text-ink-soft">— {brand.photographer}</p>
            <ScriptLink href="/approach" className="mt-8">
              read my approach
            </ScriptLink>
          </Reveal>
        </div>
      </section>

      {/* ───────── FILM & DIGITAL ───────── */}
      <section className="grain relative bg-linen">
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <Reveal>
            <SectionTitle script="Film & Digital" label="the best of both, woven into one story" center />
          </Reveal>
          <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-14">
            <Reveal>
              <FilmFrame photo={film[0] ?? featured[5]} label="Kodak Portra 400" aspect="aspect-[4/5]" />
              <p className="mt-5 text-ink-soft">
                <span className="display mr-2 text-ink">On film —</span> soft skin, real grain and a timeless glow no filter can fake.
              </p>
            </Reveal>
            <Reveal delay={120} className="md:mt-24">
              <div className="relative aspect-[4/5] overflow-hidden bg-linen">
                {(digital[0] ?? featured[6]) && <Photo photo={(digital[0] ?? featured[6])!} fill sizes="(min-width: 768px) 45vw, 90vw" />}
              </div>
              <p className="mt-5 text-ink-soft">
                <span className="display mr-2 text-ink">On digital —</span> full coverage, low light and every fleeting moment, beautifully hand-edited.
              </p>
            </Reveal>
          </div>
          <div className="mt-12 text-center">
            <ScriptLink href="/approach#film-digital">the difference, explained</ScriptLink>
          </div>
        </div>
      </section>

      {/* ───────── KIND WORDS ───────── */}
      {quotes.length > 0 && (
        <section className="grain woven relative bg-moss text-cream">
          <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 md:py-28">
            <SectionTitle script="Kind Words" label="from the people I've photographed" center light />
            <div className="mt-12">
              <TestimonialCarousel
                light
                quotes={quotes.map((q) => ({
                  id: q.id,
                  name: q.name,
                  sessionType: q.sessionType,
                  quote: q.quote,
                  pullQuote: q.pullQuote,
                  isDemo: q.isDemo,
                }))}
              />
            </div>
            <div className="mt-10 text-center">
              <ScriptLink href="/kind-words" light>
                read them all
              </ScriptLink>
            </div>
          </div>
        </section>
      )}

      {/* ───────── BEHIND THE LENS ───────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 md:grid-cols-[1fr_1.1fr] md:gap-20 md:px-10 md:py-32">
        <Reveal className="relative mx-auto w-full max-w-sm">
          <Print photo={portrait} tilt={-2} tape aspect="aspect-[4/5]" sizes="(min-width: 768px) 24rem, 80vw" />
          <span className="absolute -bottom-6 -right-3 rotate-6 rounded-full bg-parchment p-1 text-scarlet">
            <Monogram size={70} />
          </span>
        </Reveal>
        <Reveal delay={120}>
          <SectionTitle script={aboutPage.script} label={aboutPage.kicker} />
          <p className="display mt-6 text-[1.8rem]">{aboutPage.hello}</p>
          <p className="mt-4 text-ink-soft">{aboutPage.body[0]}</p>
          <p className="mt-4 text-ink-soft">{aboutPage.body[1]}</p>
          <ScriptLink href="/about" className="mt-8">
            get to know me
          </ScriptLink>
        </Reveal>
      </section>

      <InquireBand photo={featured[7] ?? hero} />
    </>
  );
}
