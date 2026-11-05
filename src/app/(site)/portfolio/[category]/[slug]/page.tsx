import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { InquireBand } from "@/components/site/cta";
import { formatDay } from "@/lib/format";
import { getCategory, getGallery } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGallery(slug);
  return g ? { title: g.gallery.title, description: g.gallery.description || g.gallery.subtitle } : {};
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const [cat, data] = await Promise.all([getCategory(category), getGallery(slug)]);
  if (!cat || !data || data.gallery.categoryId !== cat.id) notFound();
  const { gallery, photos } = data;
  const cover = photos.find((p) => p.id === gallery.coverPhotoId) ?? photos[0];

  return (
    <>
      <section className="relative h-[78svh] min-h-[480px] overflow-hidden bg-noir text-cream">
        {cover && <Photo photo={cover} fill preload sizes="100vw" quality={90} />}
        <div className="absolute inset-0 bg-gradient-to-b from-noir/35 via-transparent to-noir/70" />
        <div className="pointer-events-none absolute inset-3 border border-cream/30 md:inset-6" />
        <div className="absolute inset-x-0 bottom-[10%] px-6 text-center">
          <p className="label text-cream/80">{cat.name}</p>
          <h1 className="script inked mt-2 text-[3.6rem] leading-none md:text-[6rem]">{gallery.title}</h1>
          <p className="label mt-4 text-cream/80">
            {[gallery.location, gallery.date ? formatDay(gallery.date, "long") : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      {(gallery.subtitle || gallery.description) && (
        <Reveal className="mx-auto max-w-2xl px-6 py-16 text-center md:py-24">
          {gallery.subtitle && <p className="display text-[1.6rem]">{gallery.subtitle}</p>}
          {gallery.description && <p className="mt-4 text-ink-soft">{gallery.description}</p>}
        </Reveal>
      )}

      <section className="mx-auto max-w-6xl px-3 pb-20 md:px-10">
        <GalleryGrid
          columns="columns-1 sm:columns-2"
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
        <div className="mt-16 flex justify-center gap-6">
          <Link href={`/portfolio/${cat.slug}`} className="label border border-ink px-6 py-3 hover:bg-ink hover:text-cream">
            ← More {cat.name}
          </Link>
          <Link href="/inquire" className="label bg-ink px-6 py-3 text-cream hover:bg-wine">
            Inquire
          </Link>
        </div>
      </section>

      <InquireBand photo={photos[photos.length - 1]} />
    </>
  );
}
