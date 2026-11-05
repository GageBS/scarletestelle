import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { InquireBand } from "@/components/site/cta";
import { cx } from "@/components/studio/ui";
import { formatDay } from "@/lib/format";
import { getCategories, getCategory, getCategoryPhotos, getGalleries } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const c = await getCategory(category);
  return c ? { title: `${c.name} Portfolio`, description: c.description } : {};
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = await getCategory(category);
  if (!cat) notFound();
  const [all, photos, stories] = await Promise.all([
    getCategories(),
    getCategoryPhotos(cat.id),
    getGalleries(cat.id),
  ]);

  return (
    <>
      {/* sticky category switcher — the "easy to look through" fix */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 border-b border-rule bg-parchment/95 backdrop-blur-sm md:top-24">
        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 md:justify-center md:gap-3 md:px-10">
          <Link href="/portfolio" className="label shrink-0 px-3 py-2 text-muted hover:text-ink">
            All
          </Link>
          {all.map((c) => (
            <Link
              key={c.id}
              href={`/portfolio/${c.slug}`}
              aria-current={c.slug === cat.slug ? "page" : undefined}
              className={cx(
                "label shrink-0 rounded-full px-4 py-2 transition",
                c.slug === cat.slug ? "bg-ink text-cream" : "text-ink-soft hover:text-ink",
              )}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-6 pt-24 text-center md:px-10 md:pt-36">
        <Reveal>
          <h1 className="display text-[2.8rem] uppercase tracking-[0.1em] md:text-[5rem]">{cat.name}</h1>
          {cat.tagline && <p className="script inked -mt-1 text-[2.4rem] text-scarlet md:text-[3.4rem]">{cat.tagline}</p>}
          {cat.description && <p className="mx-auto mt-4 max-w-xl text-ink-soft">{cat.description}</p>}
        </Reveal>
      </section>

      {stories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-10 md:px-10">
          <p className="label mb-4 text-center text-muted">Full galleries</p>
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:px-0">
            {stories.map((g) => (
              <Link
                key={g.id}
                href={`/portfolio/${cat.slug}/${g.slug}`}
                className="group print w-[72%] shrink-0 snap-center md:w-auto"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  {g.cover && (
                    <Photo photo={g.cover} fill sizes="(min-width: 768px) 30vw, 72vw" className="transition duration-700 group-hover:scale-105" />
                  )}
                </div>
                <div className="flex items-end justify-between gap-2 px-1 pt-3">
                  <div className="text-left">
                    <p className="display text-lg leading-tight">{g.title}</p>
                    <p className="label text-[0.6rem] text-muted">
                      {[g.location, g.date ? formatDay(g.date, "medium") : ""].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="label shrink-0 text-ink-soft">{g.count} →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-3 pb-24 pt-6 md:px-10">
        {photos.length > 0 ? (
          <GalleryGrid
            photos={photos.map((p) => ({
              id: p.id,
              src: p.src,
              width: p.width,
              height: p.height,
              alt: p.alt,
              caption: p.caption,
              medium: p.medium,
            }))}
          />
        ) : (
          <p className="py-20 text-center text-ink-soft">New work is on its way — check back soon.</p>
        )}
      </section>

      <InquireBand photo={photos[1] ?? photos[0]} />
    </>
  );
}
