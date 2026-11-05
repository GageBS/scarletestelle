"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId, slugify } from "@/lib/ids";
import { deleteImage, saveImage } from "@/lib/storage";
import type { FormState } from "../_components/action-form";
import { orderedScope } from "./queries";

const { categories, galleries, photos, testimonials } = schema;

/** Slugs that would collide with fixed routes under /studio/portfolio. */
const RESERVED = new Set(["gallery", "new"]);

const bump = () => revalidatePath("/", "layout");
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const flag = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";
const fail = (error: string): FormState => ({ ok: false, error });

function firstIssue(e: z.ZodError) {
  return e.issues[0]?.message ?? "Please check the form.";
}

async function uniqueSlug(table: "categories" | "galleries", base: string) {
  const root = slugify(base) || "untitled";
  for (let i = 0; i < 200; i++) {
    const s = i === 0 ? root : `${root}-${i + 1}`;
    if (RESERVED.has(s)) continue;
    const hit =
      table === "categories"
        ? await db.query.categories.findFirst({ where: eq(categories.slug, s) })
        : await db.query.galleries.findFirst({ where: eq(galleries.slug, s) });
    if (!hit) return s;
  }
  return `${root}-${newId().slice(0, 6)}`;
}

/** Remove every reference to deleted photos (covers + review portraits). */
async function clearPhotoRefs(ids: string[]) {
  if (!ids.length) return;
  await db.update(categories).set({ coverPhotoId: null }).where(inArray(categories.coverPhotoId, ids));
  await db.update(galleries).set({ coverPhotoId: null }).where(inArray(galleries.coverPhotoId, ids));
  await db.update(testimonials).set({ photoId: null }).where(inArray(testimonials.photoId, ids));
}

/* ───────────────────────── categories ───────────────────────── */
const categorySchema = z.object({
  name: z.string().min(1, "Give the category a name.").max(80),
  tagline: z.string().max(120),
  description: z.string().max(600),
});

export async function createCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const p = categorySchema.safeParse({
    name: str(fd, "name"),
    tagline: str(fd, "tagline"),
    description: str(fd, "description"),
  });
  if (!p.success) return fail(firstIssue(p.error));
  const slug = await uniqueSlug("categories", p.data.name);
  const [{ m }] = await db.select({ m: sql<number>`coalesce(max(${categories.sort}), 0)` }).from(categories);
  await db.insert(categories).values({ id: newId(), slug, ...p.data, sort: Number(m) + 1 });
  bump();
  redirect(`/studio/portfolio/${slug}`);
}

export async function updateCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const id = str(fd, "id");
  const p = categorySchema.safeParse({
    name: str(fd, "name"),
    tagline: str(fd, "tagline"),
    description: str(fd, "description"),
  });
  if (!p.success) return fail(firstIssue(p.error));
  const row = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!row) return fail("That category no longer exists.");
  await db
    .update(categories)
    .set({ ...p.data, visible: flag(fd, "visible") })
    .where(eq(categories.id, id));
  bump();
  return { ok: true, message: "Saved. The website is updated." };
}

export async function toggleCategoryVisible(fd: FormData) {
  await requireStudio();
  await db
    .update(categories)
    .set({ visible: str(fd, "to") === "1" })
    .where(eq(categories.id, str(fd, "id")));
  bump();
}

export async function moveCategory(fd: FormData) {
  await requireStudio();
  const id = str(fd, "id");
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const rows = await db.select({ id: categories.id, sort: categories.sort }).from(categories).orderBy(categories.sort, categories.name);
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [n, r] of rows.entries()) {
    if (r.sort !== n + 1) await db.update(categories).set({ sort: n + 1 }).where(eq(categories.id, r.id));
  }
  bump();
}

export async function deleteCategory(fd: FormData) {
  await requireStudio();
  const id = str(fd, "id");
  const g = await db.select({ n: sql<number>`count(*)` }).from(galleries).where(eq(galleries.categoryId, id));
  const ph = await db.select({ n: sql<number>`count(*)` }).from(photos).where(eq(photos.categoryId, id));
  if (Number(g[0].n) > 0 || Number(ph[0].n) > 0) return; // UI only offers this when empty
  await db.delete(categories).where(eq(categories.id, id));
  bump();
  redirect("/studio/portfolio");
}

/* ───────────────────────── galleries ───────────────────────── */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date, or leave it blank.")
  .or(z.literal(""));
const gallerySchema = z.object({
  title: z.string().min(1, "Give the gallery a title.").max(120),
  subtitle: z.string().max(160),
  location: z.string().max(120),
  date: day,
  description: z.string().max(3000),
});
const galleryFields = (fd: FormData) => ({
  title: str(fd, "title"),
  subtitle: str(fd, "subtitle"),
  location: str(fd, "location"),
  date: str(fd, "date"),
  description: str(fd, "description"),
});

export async function createGallery(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const categoryId = str(fd, "categoryId");
  const cat = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  if (!cat) return fail("That category no longer exists.");
  const p = gallerySchema.safeParse(galleryFields(fd));
  if (!p.success) return fail(firstIssue(p.error));
  const slug = await uniqueSlug("galleries", p.data.title);
  const [{ m }] = await db
    .select({ m: sql<number>`coalesce(max(${galleries.sort}), 0)` })
    .from(galleries)
    .where(eq(galleries.categoryId, categoryId));
  const id = newId();
  await db.insert(galleries).values({
    id,
    categoryId,
    slug,
    ...p.data,
    date: p.data.date || null,
    published: false, // hidden until she adds photos and switches it on
    sort: Number(m) + 1,
  });
  bump();
  redirect(`/studio/portfolio/gallery/${id}`);
}

export async function updateGallery(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const id = str(fd, "id");
  const p = gallerySchema.safeParse(galleryFields(fd));
  if (!p.success) return fail(firstIssue(p.error));
  const row = await db.query.galleries.findFirst({ where: eq(galleries.id, id) });
  if (!row) return fail("That gallery no longer exists.");
  await db
    .update(galleries)
    .set({ ...p.data, date: p.data.date || null, published: flag(fd, "published") })
    .where(eq(galleries.id, id));
  bump();
  return { ok: true, message: "Saved. The website is updated." };
}

export async function toggleGalleryPublished(fd: FormData) {
  await requireStudio();
  await db
    .update(galleries)
    .set({ published: str(fd, "to") === "1" })
    .where(eq(galleries.id, str(fd, "id")));
  bump();
}

export async function moveGallery(fd: FormData) {
  await requireStudio();
  const id = str(fd, "id");
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const g = await db.query.galleries.findFirst({ where: eq(galleries.id, id) });
  if (!g) return;
  const rows = await db
    .select({ id: galleries.id, sort: galleries.sort })
    .from(galleries)
    .where(eq(galleries.categoryId, g.categoryId))
    .orderBy(galleries.sort, galleries.createdAt);
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [n, r] of rows.entries()) {
    if (r.sort !== n + 1) await db.update(galleries).set({ sort: n + 1 }).where(eq(galleries.id, r.id));
  }
  bump();
}

export async function deleteGallery(fd: FormData) {
  await requireStudio();
  const id = str(fd, "id");
  const g = await db.query.galleries.findFirst({ where: eq(galleries.id, id) });
  if (!g) return;
  const ph = await db.select({ id: photos.id, src: photos.src }).from(photos).where(eq(photos.galleryId, id));
  await clearPhotoRefs(ph.map((p) => p.id));
  await db.delete(galleries).where(eq(galleries.id, id)); // photos cascade
  for (const p of ph) await deleteImage(p.src);
  bump();
  const cat = await db.query.categories.findFirst({ where: eq(categories.id, g.categoryId) });
  redirect(cat ? `/studio/portfolio/${cat.slug}` : "/studio/portfolio");
}

/* ───────────────────────── photos ───────────────────────── */
export type UploadResult = { ok: boolean; error?: string; id?: string };

const MAX_FILE = 38 * 1024 * 1024;

/** One file per call. The client uploads a batch sequentially so phones never hit the request limit. */
export async function uploadPhoto(fd: FormData): Promise<UploadResult> {
  await requireStudio();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file received." };
  if (file.size > MAX_FILE) {
    return { ok: false, error: `Too large (${(file.size / 1048576).toFixed(0)} MB, max 38 MB).` };
  }
  const galleryId = str(fd, "galleryId");
  const categoryId = str(fd, "categoryId");

  let catId: string | null = null;
  let galId: string | null = null;
  let slug = "";
  if (galleryId) {
    const g = await db.query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
    if (!g) return { ok: false, error: "That gallery no longer exists." };
    const c = await db.query.categories.findFirst({ where: eq(categories.id, g.categoryId) });
    galId = g.id;
    catId = g.categoryId;
    slug = c?.slug ?? "misc";
  } else {
    const c = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
    if (!c) return { ok: false, error: "That category no longer exists." };
    catId = c.id;
    slug = c.slug;
  }

  let saved: { src: string; width: number; height: number };
  try {
    saved = await saveImage(file, `portfolio/${slug}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { ok: false, error: `Could not read this image (${msg}). Try a JPG or PNG.` };
  }

  const scope = { categoryId: catId, galleryId: galId };
  const existing = await orderedScope(scope);
  const next = existing.reduce((m, r) => Math.max(m, r.sort), 0) + 1;
  const id = newId();
  try {
    await db.insert(photos).values({
      id,
      categoryId: catId,
      galleryId: galId,
      src: saved.src,
      width: saved.width,
      height: saved.height,
      alt: "",
      caption: "",
      medium: null,
      featured: false,
      sort: next,
      isDemo: false,
    });
  } catch (e) {
    await deleteImage(saved.src);
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the photo." };
  }
  bump();
  return { ok: true, id };
}

export async function movePhoto(fd: FormData) {
  await requireStudio();
  const id = str(fd, "id");
  const dir = str(fd, "dir"); // up | down | first
  const p = await db.query.photos.findFirst({ where: eq(photos.id, id) });
  if (!p) return;
  const rows = await orderedScope(p);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return;
  if (dir === "first") {
    if (i === 0) return;
    const [x] = rows.splice(i, 1);
    rows.unshift(x);
  } else {
    const j = i + (dir === "up" ? -1 : 1);
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  for (const [n, r] of rows.entries()) {
    if (r.sort !== n + 1) await db.update(photos).set({ sort: n + 1 }).where(eq(photos.id, r.id));
  }
  bump();
}

export async function togglePhotoFeatured(fd: FormData) {
  await requireStudio();
  await db
    .update(photos)
    .set({ featured: str(fd, "to") === "1" })
    .where(eq(photos.id, str(fd, "id")));
  bump();
}

/** Toggle: make this photo the cover of its gallery (or category, for highlights); tap again to clear. */
export async function togglePhotoCover(fd: FormData) {
  await requireStudio();
  const id = str(fd, "id");
  const p = await db.query.photos.findFirst({ where: eq(photos.id, id) });
  if (!p) return;
  if (p.galleryId) {
    const g = await db.query.galleries.findFirst({ where: eq(galleries.id, p.galleryId) });
    if (!g) return;
    await db
      .update(galleries)
      .set({ coverPhotoId: g.coverPhotoId === id ? null : id })
      .where(eq(galleries.id, g.id));
  } else if (p.categoryId) {
    const c = await db.query.categories.findFirst({ where: eq(categories.id, p.categoryId) });
    if (!c) return;
    await db
      .update(categories)
      .set({ coverPhotoId: c.coverPhotoId === id ? null : id })
      .where(eq(categories.id, c.id));
  }
  bump();
}

/** Use a gallery photo as its CATEGORY's cover too. */
export async function setCategoryCoverFromPhoto(fd: FormData) {
  await requireStudio();
  const p = await db.query.photos.findFirst({ where: eq(photos.id, str(fd, "id")) });
  if (!p?.categoryId) return;
  await db.update(categories).set({ coverPhotoId: p.id }).where(eq(categories.id, p.categoryId));
  bump();
}

const detailsSchema = z.object({
  alt: z.string().max(300),
  caption: z.string().max(500),
  medium: z.enum(["film", "digital", ""]),
});

export async function savePhotoDetails(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const p = detailsSchema.safeParse({
    alt: str(fd, "alt"),
    caption: str(fd, "caption"),
    medium: str(fd, "medium"),
  });
  if (!p.success) return fail(firstIssue(p.error));
  const id = str(fd, "id");
  const row = await db.query.photos.findFirst({ where: eq(photos.id, id) });
  if (!row) return fail("That photo no longer exists.");
  await db
    .update(photos)
    .set({ alt: p.data.alt, caption: p.data.caption, medium: p.data.medium || null })
    .where(eq(photos.id, id));
  bump();
  return { ok: true, message: "Saved." };
}

export async function deletePhoto(fd: FormData) {
  await requireStudio();
  const id = str(fd, "id");
  const p = await db.query.photos.findFirst({ where: eq(photos.id, id) });
  if (!p) return;
  await clearPhotoRefs([id]);
  await db.delete(photos).where(and(eq(photos.id, id)));
  await deleteImage(p.src);
  bump();
}
