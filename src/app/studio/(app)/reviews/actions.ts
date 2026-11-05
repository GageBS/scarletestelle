"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId } from "@/lib/ids";
import type { FormState } from "../_components/action-form";

const { testimonials, photos, projects } = schema;

const bump = () => revalidatePath("/", "layout");
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const flag = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";

const reviewSchema = z.object({
  name: z.string().min(1, "Add the name to show with the review.").max(120),
  sessionType: z.string().max(120),
  quote: z.string().min(1, "Add what they said.").max(4000),
  pullQuote: z.string().max(220, "Keep the short line under 220 characters."),
  rating: z.union([z.literal(""), z.coerce.number().int().min(1).max(5)]),
  sort: z.coerce.number().int().min(-9999).max(9999),
});

async function parse(fd: FormData) {
  const p = reviewSchema.safeParse({
    name: str(fd, "name"),
    sessionType: str(fd, "sessionType"),
    quote: str(fd, "quote"),
    pullQuote: str(fd, "pullQuote"),
    rating: str(fd, "rating"),
    sort: str(fd, "sort") || "0",
  });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Please check the form." } as const;

  const photoId = str(fd, "photoId") || null;
  if (photoId) {
    const ph = await db.query.photos.findFirst({ where: eq(photos.id, photoId) });
    if (!ph) return { error: "That photo no longer exists. Pick another." } as const;
  }
  const projectId = str(fd, "projectId") || null;
  if (projectId) {
    const pr = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!pr) return { error: "That project no longer exists." } as const;
  }
  return {
    data: {
      name: p.data.name,
      sessionType: p.data.sessionType,
      quote: p.data.quote,
      pullQuote: p.data.pullQuote,
      rating: p.data.rating === "" ? null : p.data.rating,
      sort: p.data.sort,
      photoId,
      projectId,
      featured: flag(fd, "featured"),
      published: flag(fd, "published"),
    },
  } as const;
}

export async function createReview(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const r = await parse(fd);
  if ("error" in r) return { ok: false, error: r.error };
  await db.insert(testimonials).values({ id: newId(), ...r.data, source: "manual", isDemo: false });
  bump();
  return { ok: true, message: "Review added." };
}

export async function updateReview(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const id = str(fd, "id");
  const row = await db.query.testimonials.findFirst({ where: eq(testimonials.id, id) });
  if (!row) return { ok: false, error: "That review no longer exists." };
  const r = await parse(fd);
  if ("error" in r) return { ok: false, error: r.error };
  await db.update(testimonials).set(r.data).where(eq(testimonials.id, id));
  bump();
  return { ok: true, message: "Saved. The website is updated." };
}

/** Approve a client-submitted review: publish it. */
export async function approveReview(fd: FormData) {
  await requireStudio();
  await db.update(testimonials).set({ published: true }).where(eq(testimonials.id, str(fd, "id")));
  bump();
}

export async function setReviewFlag(fd: FormData) {
  await requireStudio();
  const field = str(fd, "field");
  if (field !== "featured" && field !== "published") return;
  await db
    .update(testimonials)
    .set({ [field]: str(fd, "to") === "1" })
    .where(eq(testimonials.id, str(fd, "id")));
  bump();
}

export async function deleteReview(fd: FormData) {
  await requireStudio();
  await db.delete(testimonials).where(eq(testimonials.id, str(fd, "id")));
  bump();
}
