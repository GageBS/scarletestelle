/* Read-only queries for the public website. */
import { and, asc, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";

export type Photo = typeof schema.photos.$inferSelect;
export type Category = typeof schema.categories.$inferSelect;
export type Gallery = typeof schema.galleries.$inferSelect;
export type Testimonial = typeof schema.testimonials.$inferSelect;

/**
 * A photo is PUBLIC only when it isn't in a gallery or its gallery is published, AND its
 * category (if any) is visible. Every public query goes through this so draft galleries and
 * hidden categories never leak onto the site (home, strip, covers, film/digital picks).
 */
const isPublic = and(
  or(isNull(schema.photos.galleryId), eq(schema.galleries.published, true)),
  or(isNull(schema.photos.categoryId), eq(schema.categories.visible, true)),
);
function publicPhotos(extra?: SQL) {
  return db
    .select({ p: schema.photos })
    .from(schema.photos)
    .leftJoin(schema.galleries, eq(schema.photos.galleryId, schema.galleries.id))
    .leftJoin(schema.categories, eq(schema.photos.categoryId, schema.categories.id))
    .where(extra ? and(isPublic, extra) : isPublic);
}

async function photosByIds(ids: (string | null | undefined)[]) {
  const clean = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (clean.length === 0) return new Map<string, Photo>();
  const rows = (await publicPhotos(inArray(schema.photos.id, clean))).map((r) => r.p);
  return new Map(rows.map((r) => [r.id, r]));
}

/** Visible categories, each with its cover photo (falls back to its first photo). */
export async function getCategories() {
  const cats = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.visible, true))
    .orderBy(asc(schema.categories.sort));
  const covers = await photosByIds(cats.map((c) => c.coverPhotoId));
  const out: (Category & { cover: Photo | null; count: number })[] = [];
  for (const c of cats) {
    const photos = (
      await publicPhotos(eq(schema.photos.categoryId, c.id)).orderBy(asc(schema.photos.sort))
    ).map((r) => r.p);
    out.push({
      ...c,
      cover: (c.coverPhotoId && covers.get(c.coverPhotoId)) || photos[0] || null,
      count: photos.length,
    });
  }
  return out;
}

export async function getCategory(slug: string) {
  return db.query.categories.findFirst({
    where: and(eq(schema.categories.slug, slug), eq(schema.categories.visible, true)),
  });
}

/** Every photo in a category (highlights first, then story photos), in sort order. */
export async function getCategoryPhotos(categoryId: string) {
  const loose = await db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.categoryId, categoryId), isNull(schema.photos.galleryId)))
    .orderBy(asc(schema.photos.sort), asc(schema.photos.createdAt));
  const inStories = await db
    .select({ p: schema.photos })
    .from(schema.photos)
    .innerJoin(schema.galleries, eq(schema.photos.galleryId, schema.galleries.id))
    .where(and(eq(schema.galleries.categoryId, categoryId), eq(schema.galleries.published, true)))
    .orderBy(asc(schema.galleries.sort), asc(schema.photos.sort));
  return [...loose, ...inStories.map((r) => r.p)];
}

export async function getGalleries(categoryId: string) {
  const gals = await db
    .select()
    .from(schema.galleries)
    .where(and(eq(schema.galleries.categoryId, categoryId), eq(schema.galleries.published, true)))
    .orderBy(asc(schema.galleries.sort), desc(schema.galleries.date));
  const covers = await photosByIds(gals.map((g) => g.coverPhotoId));
  const out: (Gallery & { cover: Photo | null; count: number })[] = [];
  for (const g of gals) {
    const ps = await db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.galleryId, g.id))
      .orderBy(asc(schema.photos.sort));
    out.push({ ...g, cover: (g.coverPhotoId && covers.get(g.coverPhotoId)) || ps[0] || null, count: ps.length });
  }
  return out;
}

export async function getGallery(slug: string) {
  const g = await db.query.galleries.findFirst({
    where: and(eq(schema.galleries.slug, slug), eq(schema.galleries.published, true)),
  });
  if (!g) return null;
  const photos = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.galleryId, g.id))
    .orderBy(asc(schema.photos.sort), asc(schema.photos.createdAt));
  return { gallery: g, photos };
}

/** Photos marked "featured on home page"; falls back to the first photo of each category. */
export async function getFeaturedPhotos(limit = 12) {
  const featured = (
    await publicPhotos(eq(schema.photos.featured, true))
      .orderBy(asc(schema.photos.sort), desc(schema.photos.createdAt))
      .limit(limit)
  ).map((r) => r.p);
  if (featured.length >= 4) return featured;
  return (await publicPhotos().orderBy(asc(schema.photos.sort)).limit(limit)).map((r) => r.p);
}

/** Find one photo for a medium (film/digital) — used by the Film & Digital section. */
export async function getMediumPhotos(medium: "film" | "digital", limit = 2) {
  return (
    await publicPhotos(eq(schema.photos.medium, medium)).orderBy(asc(schema.photos.sort)).limit(limit)
  ).map((r) => r.p);
}

export async function getTestimonials(opts: { featuredOnly?: boolean } = {}) {
  const rows = await db
    .select()
    .from(schema.testimonials)
    .where(
      opts.featuredOnly
        ? and(eq(schema.testimonials.published, true), eq(schema.testimonials.featured, true))
        : eq(schema.testimonials.published, true),
    )
    .orderBy(asc(schema.testimonials.sort), desc(schema.testimonials.createdAt));
  const photos = await photosByIds(rows.map((r) => r.photoId));
  return rows.map((r) => ({ ...r, photo: r.photoId ? photos.get(r.photoId) ?? null : null }));
}

/** Packages shown on the Experience page, grouped by project type. */
export async function getSitePackages() {
  return db
    .select()
    .from(schema.packages)
    .where(
      and(
        eq(schema.packages.active, true),
        eq(schema.packages.showOnSite, true),
        eq(schema.packages.isAddon, false),
      ),
    )
    .orderBy(asc(schema.packages.sort), asc(schema.packages.priceCents));
}
