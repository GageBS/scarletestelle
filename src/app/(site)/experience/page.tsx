import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/site/photo";
import { Print } from "@/components/site/print";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { ScriptLink } from "@/components/site/script-link";
import { InquireBand } from "@/components/site/cta";
import { experiencePage as E, approachPage } from "@/content/site";
import { money } from "@/lib/format";
import { getCategories, getFeaturedPhotos, getSitePackages } from "@/lib/site-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Experience",
  description: "What it's like to work with Scarlet — and collections for weddings, couples, seniors, portraits and branding.",
};

// how project types roll up into the four service groups shown on the site
const GROUPS = [
  { key: "weddings", title: "Weddings & Elopements", types: ["wedding", "elopement"] },
  { key: "couples", title: "Couples & Engagements", types: ["engagement", "couples"] },
  { key: "seniors", title: "Seniors & Portraits", types: ["senior", "portrait"] },
  { key: "branding", title: "Branding", types: ["branding"] },
];

export default async function ExperiencePage() {
  const [pkgs, cats, featured] = await Promise.all([getSitePackages(), getCategories(), getFeaturedPhotos(12)]);
  const cover = (slug: string) => cats.find((c) => c.slug === slug)?.cover ?? null;

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-32 md:px-10 md:pt-44">
        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <SectionTitle script={E.script} size="xl" />
            <p className="display mt-6 text-[1.6rem] leading-snug md:text-[2rem]">{E.lead}</p>
            <ul className="mt-8 space-y-3">
              {E.included.map((t) => (
                <li key={t} className="flex gap-3 text-[1.1rem]">
                  <span className="script inked mt-[-0.2rem] text-2xl leading-none text-scarlet">✦</span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={150} className="mx-auto w-full max-w-sm">
            <Print photo={featured[3] ?? featured[0]} tilt={3} tape aspect="aspect-[4/5]" />
          </Reveal>
        </div>
      </section>

      {/* collections */}
      <section className="border-t border-rule bg-cream/60">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <Reveal className="text-center">
            <p className="label text-muted">Collections</p>
            <h2 className="display mt-3 text-[2.4rem] uppercase tracking-[0.06em] md:text-[3.6rem]">Investment</h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-soft">{E.note}</p>
          </Reveal>
          <div className="mt-14 grid gap-14">
            {GROUPS.map((g, gi) => {
              const list = pkgs.filter((p) => g.types.includes(p.projectType));
              const from = list.length ? Math.min(...list.map((p) => p.priceCents)) : null;
              const img = cover(g.key);
              return (
                <Reveal key={g.key} className="grid gap-8 md:grid-cols-[minmax(0,320px)_1fr] md:gap-14">
                  <div className={gi % 2 ? "md:order-2" : ""}>
                    <div className="relative aspect-[4/5] overflow-hidden bg-linen">
                      {img && <Photo photo={img} fill sizes="(min-width: 768px) 320px, 90vw" />}
                    </div>
                  </div>
                  <div className="self-center">
                    <p className="label text-muted">{String(gi + 1).padStart(2, "0")}</p>
                    <h3 className="display text-[2rem] uppercase tracking-[0.06em] md:text-[2.6rem]">{g.title}</h3>
                    {from != null ? (
                      <p className="script inked text-[2rem] text-scarlet">collections from {money(from)}</p>
                    ) : (
                      <p className="script inked text-[2rem] text-scarlet">custom collections</p>
                    )}
                    {list.length > 0 && (
                      <div className="mt-6 divide-y divide-rule border-y border-rule">
                        {list.map((p) => (
                          <details key={p.id} className="group py-4">
                            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4">
                              <span className="display text-[1.3rem]">{p.name}</span>
                              <span className="flex items-baseline gap-3">
                                <span className="font-sans text-sm tracking-wide text-ink-soft">{money(p.priceCents)}</span>
                                <span className="text-muted transition group-open:rotate-45">+</span>
                              </span>
                            </summary>
                            {p.description && <p className="mt-3 text-ink-soft">{p.description}</p>}
                            {p.inclusions.length > 0 && (
                              <ul className="mt-3 space-y-1.5">
                                {p.inclusions.map((x) => (
                                  <li key={x} className="flex gap-2 text-[1.02rem]">
                                    <span className="text-scarlet">·</span>
                                    {x}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </details>
                        ))}
                      </div>
                    )}
                    <Link
                      href={`/inquire?type=${g.types[0]}`}
                      className="label mt-6 inline-block border border-ink px-6 py-3 transition hover:bg-ink hover:text-cream"
                    >
                      Inquire about {g.title.split(" ")[0].toLowerCase()}
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* process */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
        <SectionTitle script="From hello to heirloom" label="how it works" center />
        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {approachPage.steps.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 60} className="border-t border-rule pt-5">
              <p className="display text-[2.2rem] leading-none text-scarlet">{s.n}</p>
              <p className="display mt-2 text-[1.4rem] uppercase tracking-[0.08em]">{s.title}</p>
              <p className="mt-2 text-ink-soft">{s.body}</p>
            </Reveal>
          ))}
        </ol>
        <div className="mt-14 text-center">
          <ScriptLink href="/approach">read my approach</ScriptLink>
        </div>
      </section>

      <InquireBand photo={featured[1]} />
    </>
  );
}

