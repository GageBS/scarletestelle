import type { Metadata } from "next";
import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { InquireBand } from "@/components/site/cta";
import { kindWordsPage } from "@/content/site";
import { getFeaturedPhotos, getTestimonials } from "@/lib/site-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kind Words",
  description: "Reviews and testimonials from Scarlet Estelle's couples, seniors and brands.",
};

export default async function KindWordsPage() {
  const [quotes, featured] = await Promise.all([getTestimonials(), getFeaturedPhotos(12)]);
  return (
    <>
      <section className="mx-auto max-w-5xl px-6 pb-10 pt-32 text-center md:pt-44">
        <Reveal>
          <SectionTitle script={kindWordsPage.script} label={kindWordsPage.line} center size="xl" />
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        {quotes.length === 0 && (
          <p className="py-16 text-center text-ink-soft">Kind words are on their way.</p>
        )}
        <div className="flex flex-col">
          {quotes.map((q, i) => {
            const photo = q.photo ?? featured[(i * 3 + 1) % Math.max(featured.length, 1)] ?? null;
            return (
              <Reveal
                key={q.id}
                className="grid items-center gap-8 border-t border-rule py-14 md:grid-cols-[260px_1fr] md:gap-14 md:py-20"
              >
                <div className={i % 2 ? "md:order-2" : ""}>
                  {photo && (
                    <div className="print mx-auto w-56 md:w-full" style={{ transform: `rotate(${i % 2 ? 2 : -2}deg)` }}>
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <Photo photo={photo} fill sizes="260px" />
                      </div>
                    </div>
                  )}
                </div>
                <figure className="text-center md:text-left">
                  {q.pullQuote && (
                    <p className="script inked text-[2.6rem] leading-tight text-scarlet md:text-[3.4rem]">“{q.pullQuote}”</p>
                  )}
                  <blockquote className="mt-5 text-[1.2rem] leading-relaxed md:text-[1.3rem]">{q.quote}</blockquote>
                  <figcaption className="label mt-6 text-ink-soft">
                    — {q.name}
                    {q.sessionType && <span className="text-muted"> · {q.sessionType}</span>}
                    {q.isDemo && (
                      <span className="ml-2 rounded-full border border-rule px-2 py-0.5 text-[0.55rem] text-muted">
                        sample review
                      </span>
                    )}
                  </figcaption>
                </figure>
              </Reveal>
            );
          })}
        </div>
      </section>

      <InquireBand photo={featured[2]} />
    </>
  );
}
