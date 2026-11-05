"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/settings";
import { deleteImage } from "@/lib/storage";
import type { FormState } from "../_components/action-form";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const flag = (fd: FormData, k: string) => fd.get(k) === "on";
const bump = () => revalidatePath("/", "layout");
const first = (e: z.ZodError) => e.issues[0]?.message ?? "Please check the form.";

const email = z.string().email("That email address doesn’t look right.").or(z.literal(""));

export async function saveBusiness(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const p = z
    .object({
      name: z.string().min(1, "Add your business name.").max(120),
      photographer: z.string().min(1, "Add your name.").max(120),
      email,
      phone: z.string().max(40),
      instagram: z.string().max(80),
      location: z.string().max(160),
      timezone: z.string().refine((z) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: z });
          return true;
        } catch {
          return false;
        }
      }, "Pick a time zone."),
      invoicePrefix: z
        .string()
        .min(1, "Add an invoice prefix, like SE.")
        .max(10)
        .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers and dashes in the invoice prefix."),
      signatureName: z.string().min(1, "Add the name you sign with.").max(120),
    })
    .safeParse({
      name: str(fd, "name"),
      photographer: str(fd, "photographer"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      instagram: str(fd, "instagram"),
      location: str(fd, "location"),
      timezone: str(fd, "timezone"),
      invoicePrefix: str(fd, "invoicePrefix"),
      signatureName: str(fd, "signatureName"),
    });
  if (!p.success) return { ok: false, error: first(p.error) };
  const cur = await getSettings();
  await saveSettings("business", { ...cur.business, ...p.data });
  bump();
  revalidatePath("/studio", "layout");
  return { ok: true, message: "Saved." };
}

export async function savePayments(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const pct = Number(str(fd, "taxPercent").replace(/[%\s]/g, "") || "0");
  if (!Number.isFinite(pct) || pct < 0 || pct > 30) {
    return { ok: false, error: "Sales tax should be a percent between 0 and 30, like 8.25." };
  }
  const p = z
    .object({
      venmo: z.string().max(80),
      zelle: z.string().max(120),
      checkPayableTo: z.string().max(120),
      instructions: z.string().max(1500),
    })
    .safeParse({
      venmo: str(fd, "venmo"),
      zelle: str(fd, "zelle"),
      checkPayableTo: str(fd, "checkPayableTo"),
      instructions: str(fd, "instructions"),
    });
  if (!p.success) return { ok: false, error: first(p.error) };
  const cur = await getSettings();
  await saveSettings("payments", {
    ...cur.payments,
    ...p.data,
    defaultTaxRateBps: Math.round(pct * 100),
  });
  bump();
  return { ok: true, message: "Saved." };
}

export async function saveNotifications(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const p = email.safeParse(str(fd, "notifyEmail"));
  if (!p.success) return { ok: false, error: first(p.error) };
  const cur = await getSettings();
  await saveSettings("notifications", {
    ...cur.notifications,
    notifyEmail: p.data,
    notifyOnInquiry: flag(fd, "notifyOnInquiry"),
    notifyOnSigned: flag(fd, "notifyOnSigned"),
    notifyOnPayment: flag(fd, "notifyOnPayment"),
  });
  revalidatePath("/studio/settings");
  return { ok: true, message: "Saved." };
}

/** Delete sample contacts (their projects, invoices, etc. cascade). */
export async function removeSampleClients(): Promise<FormState> {
  await requireStudio();
  const sampleProjects = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.isSample, true));
  const sampleContacts = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(eq(schema.contacts.isSample, true));
  if (sampleProjects.length) {
    await db.delete(schema.projects).where(inArray(schema.projects.id, sampleProjects.map((p) => p.id)));
  }
  if (sampleContacts.length) {
    await db.delete(schema.contacts).where(inArray(schema.contacts.id, sampleContacts.map((c) => c.id)));
  }
  bump();
  revalidatePath("/studio", "layout");
  return {
    ok: true,
    message: `Removed ${sampleContacts.length} sample client${sampleContacts.length === 1 ? "" : "s"} and ${sampleProjects.length} sample project${sampleProjects.length === 1 ? "" : "s"}.`,
  };
}

/** Delete demo photos + demo reviews, and clear anything that pointed at them. */
export async function removeDemoPhotos(): Promise<FormState> {
  await requireStudio();
  const demo = await db
    .select({ id: schema.photos.id, src: schema.photos.src, galleryId: schema.photos.galleryId })
    .from(schema.photos)
    .where(eq(schema.photos.isDemo, true));
  const ids = demo.map((d) => d.id);
  if (ids.length) {
    await db.update(schema.categories).set({ coverPhotoId: null }).where(inArray(schema.categories.coverPhotoId, ids));
    await db.update(schema.galleries).set({ coverPhotoId: null }).where(inArray(schema.galleries.coverPhotoId, ids));
    await db.update(schema.testimonials).set({ photoId: null }).where(inArray(schema.testimonials.photoId, ids));
    await db.delete(schema.photos).where(inArray(schema.photos.id, ids));
    for (const d of demo) await deleteImage(d.src);
  }

  // galleries that only held demo photos are now empty shells: remove them too
  let galleriesRemoved = 0;
  const touched = [...new Set(demo.map((d) => d.galleryId).filter((g): g is string => Boolean(g)))];
  for (const gid of touched) {
    const left = await db.query.photos.findFirst({ where: eq(schema.photos.galleryId, gid) });
    if (!left) {
      await db.delete(schema.galleries).where(eq(schema.galleries.id, gid));
      galleriesRemoved++;
    }
  }

  const demoReviews = await db
    .select({ id: schema.testimonials.id })
    .from(schema.testimonials)
    .where(eq(schema.testimonials.isDemo, true));
  if (demoReviews.length) {
    await db.delete(schema.testimonials).where(inArray(schema.testimonials.id, demoReviews.map((r) => r.id)));
  }
  bump();
  return {
    ok: true,
    message: `Removed ${ids.length} demo photo${ids.length === 1 ? "" : "s"}, ${galleriesRemoved} empty demo galleries and ${demoReviews.length} sample review${demoReviews.length === 1 ? "" : "s"}.`,
  };
}
