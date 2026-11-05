"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId } from "@/lib/ids";
import { sendEmail } from "@/lib/email";
import { getSettings, siteUrl } from "@/lib/settings";
import { projectTypeLabel } from "@/lib/constants";

export type ReviewState = { ok: boolean; error?: string } | null;

const input = z.object({
  name: z.string().trim().min(1, "Please tell us how you’d like your names shown.").max(120),
  quote: z
    .string()
    .trim()
    .min(10, "A few words about your experience, please.")
    .max(4000, "That’s a little long. Could you trim it a bit?"),
  pullQuote: z.string().trim().max(220, "Please keep your favorite memory to one short line."),
  rating: z.union([z.literal(""), z.coerce.number().int().min(1).max(5)]),
});

export async function submitReview(token: string, _prev: ReviewState, fd: FormData): Promise<ReviewState> {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.portalToken, token),
  });
  if (!project) return { ok: false, error: "This link is no longer valid." };

  // honeypot: bots fill hidden fields; pretend success
  if (String(fd.get("website") ?? "").trim() !== "") return { ok: true };

  if (fd.get("consent") !== "on") {
    return { ok: false, error: "Please tick the box so Scarlet knows she may share your words." };
  }
  const p = input.safeParse({
    name: fd.get("name") ?? "",
    quote: fd.get("quote") ?? "",
    pullQuote: fd.get("pullQuote") ?? "",
    rating: String(fd.get("rating") ?? ""),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Please check the form." };

  const existing = await db.query.testimonials.findFirst({
    where: eq(schema.testimonials.projectId, project.id),
  });
  if (existing && existing.source === "client") {
    return { ok: true }; // already received (double tap / refresh)
  }

  const contact = await db.query.contacts.findFirst({
    where: eq(schema.contacts.id, project.contactId),
  });
  const sessionType = [projectTypeLabel(project.type), project.location].filter(Boolean).join(" · ");

  await db.insert(schema.testimonials).values({
    id: newId(),
    name: p.data.name,
    sessionType,
    quote: p.data.quote,
    pullQuote: p.data.pullQuote,
    projectId: project.id,
    rating: p.data.rating === "" ? null : p.data.rating,
    featured: false,
    published: false, // Scarlet approves it first
    source: "client",
    isDemo: false,
    sort: 0,
  });
  revalidatePath("/studio/reviews");

  // tell Scarlet (never blocks or fails the thank-you; sendEmail records failures itself)
  try {
    const s = await getSettings();
    const to = s.notifications.notifyEmail || s.business.email;
    await sendEmail({
      to,
      subject: `New review from ${p.data.name}, waiting for your approval`,
      body: [
        `${p.data.name} just left you a review${p.data.rating === "" ? "" : ` (${p.data.rating} of 5 stars)`}.`,
        p.data.pullQuote ? `Favorite memory: “${p.data.pullQuote}”` : "",
        `“${p.data.quote}”`,
        `It is NOT on your website yet. Read it and approve it here:\n${siteUrl()}/studio/reviews`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      projectId: project.id,
      contactId: contact?.id ?? null,
    });
  } catch {
    /* the review is saved; the studio Reviews page shows it either way */
  }
  return { ok: true };
}
