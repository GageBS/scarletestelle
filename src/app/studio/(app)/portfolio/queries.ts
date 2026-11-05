/* Shared portfolio queries (server only; used by pages AND actions so ordering matches). */
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { categories, galleries, photos } = schema;

export type Photo = typeof photos.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Gallery = typeof galleries.$inferSelect;

/** Display order everywhere: sort, then oldest first, then id (stable). */
export const photoOrder = [asc(photos.sort), asc(photos.createdAt), asc(photos.id)] as const;

export function scopeWhere(p: { categoryId: string | null; galleryId: string | null }) {
  return p.galleryId
    ? eq(photos.galleryId, p.galleryId)
    : and(eq(photos.categoryId, p.categoryId ?? ""), isNull(photos.galleryId));
}

export async function orderedScope(p: { categoryId: string | null; galleryId: string | null }) {
  return db
    .select({ id: photos.id, sort: photos.sort })
    .from(photos)
    .where(scopeWhere(p))
    .orderBy(...photoOrder);
}

export async function categoryList() {
  return db.query.categories.findMany({ orderBy: [asc(categories.sort), asc(categories.name)] });
}

export async function categoryBySlug(slug: string) {
  return db.query.categories.findFirst({ where: eq(categories.slug, slug) });
}

export async function highlightPhotos(categoryId: string) {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.categoryId, categoryId), isNull(photos.galleryId)))
    .orderBy(...photoOrder);
}

export async function galleryPhotos(galleryId: string) {
  return db
    .select()
    .from(photos)
    .where(eq(photos.galleryId, galleryId))
    .orderBy(...photoOrder);
}

export async function categoryGalleries(categoryId: string) {
  return db.query.galleries.findMany({
    where: eq(galleries.categoryId, categoryId),
    orderBy: [asc(galleries.sort), desc(galleries.createdAt)],
  });
}

/** photo id → row for a set of ids */
export async function photosById(ids: (string | null | undefined)[]) {
  const clean = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!clean.length) return new Map<string, Photo>();
  const rows = await db.select().from(photos).where(inArray(photos.id, clean));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function photoCountsByGallery() {
  const rows = await db
    .select({ galleryId: photos.galleryId, n: sql<number>`count(*)` })
    .from(photos)
    .where(sql`${photos.galleryId} is not null`)
    .groupBy(photos.galleryId);
  return new Map(rows.map((r) => [r.galleryId as string, Number(r.n)]));
}

export async function highlightCountsByCategory() {
  const rows = await db
    .select({ categoryId: photos.categoryId, n: sql<number>`count(*)` })
    .from(photos)
    .where(and(isNull(photos.galleryId), sql`${photos.categoryId} is not null`))
    .groupBy(photos.categoryId);
  return new Map(rows.map((r) => [r.categoryId as string, Number(r.n)]));
}

export async function galleryCountsByCategory() {
  const rows = await db
    .select({ categoryId: galleries.categoryId, n: sql<number>`count(*)` })
    .from(galleries)
    .groupBy(galleries.categoryId);
  return new Map(rows.map((r) => [r.categoryId, Number(r.n)]));
}
