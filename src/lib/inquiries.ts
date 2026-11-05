/**
 * Public inquiry → CRM. Creates (or reuses) the contact, opens a project in the
 * "inquiry" stage, logs the timeline, notifies Scarlet, and fires `inquiry_received`
 * automations (auto-reply etc.).
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId, newToken } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { fireTrigger } from "@/lib/automations";
import { sendEmail } from "@/lib/email";
import { getSettings, siteUrl } from "@/lib/settings";
import { PROJECT_TYPES, projectTypeLabel, type ProjectType } from "@/lib/constants";

const typeValues = PROJECT_TYPES.map((t) => t.value) as [ProjectType, ...ProjectType[]];

export const inquirySchema = z.object({
  type: z.enum(typeValues),
  firstName: z.string().trim().min(1, "Please share your name").max(80),
  lastName: z.string().trim().max(80).default(""),
  email: z.string().trim().email("Please use a valid email").max(200),
  phone: z.string().trim().max(40).default(""),
  instagram: z.string().trim().max(80).default(""),
  partnerFirstName: z.string().trim().max(80).default(""),
  partnerLastName: z.string().trim().max(80).default(""),
  eventDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  eventDateNote: z.string().trim().max(120).default(""),
  location: z.string().trim().max(160).default(""),
  venue: z.string().trim().max(160).default(""),
  guestCount: z.string().trim().max(10).default(""),
  budget: z.string().trim().max(60).default(""),
  source: z.string().trim().max(80).default(""),
  // type-specific extras (school, grad year, business name, website…)
  extras: z.record(z.string(), z.string().max(2000)).default({}),
  story: z.string().trim().max(5000).default(""),
  why: z.string().trim().max(3000).default(""),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

export async function createInquiry(input: InquiryInput) {
  const s = await getSettings();
  const now = new Date();

  // reuse the contact when this email has inquired before
  const existing = await db.query.contacts.findFirst({
    where: eq(schema.contacts.email, input.email.toLowerCase()),
  });
  const contactId = existing?.id ?? newId();
  if (!existing) {
    await db.insert(schema.contacts).values({
      id: contactId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      instagram: input.instagram.replace(/^@/, ""),
      partnerFirstName: input.partnerFirstName,
      partnerLastName: input.partnerLastName,
      source: input.source,
    });
  }

  const names = input.partnerFirstName
    ? `${input.firstName} & ${input.partnerFirstName}`
    : `${input.firstName} ${input.lastName}`.trim();
  const projectId = newId();
  const inquiryData: Record<string, string> = {
    ...input.extras,
    ...(input.story ? { "Tell me about it": input.story } : {}),
    ...(input.why ? { "Why Scarlet": input.why } : {}),
    ...(input.budget ? { Budget: input.budget } : {}),
  };
  const guests = Number.parseInt(input.guestCount, 10);
  await db.insert(schema.projects).values({
    id: projectId,
    contactId,
    title: `${names} — ${projectTypeLabel(input.type)}`,
    type: input.type,
    stage: "inquiry",
    eventDate: input.eventDate || null,
    eventDateNote: input.eventDateNote,
    location: input.location,
    venue: input.venue,
    guestCount: Number.isFinite(guests) ? guests : null,
    budget: input.budget,
    leadSource: input.source,
    inquiryData,
    portalToken: newToken(),
    stageChangedAt: now,
  });

  await logActivity({
    projectId,
    contactId,
    kind: "inquiry",
    title: `New ${projectTypeLabel(input.type).toLowerCase()} inquiry from ${names}`,
    body: input.story,
    meta: { ...inquiryData, source: input.source },
  });

  // alert Scarlet
  const notify = s.notifications.notifyEmail || s.business.email;
  if (notify && s.notifications.notifyOnInquiry) {
    const opt = (v: string, line: string) => (v ? line : null);
    const lines: (string | null)[] = [
      `New ${projectTypeLabel(input.type)} inquiry`,
      "",
      `Name: ${names}`,
      `Email: ${input.email}`,
      opt(input.phone, `Phone: ${input.phone}`),
      opt(input.instagram, `Instagram: @${input.instagram.replace(/^@/, "")}`),
      `Date: ${input.eventDate || input.eventDateNote || "TBD"}`,
      opt(input.venue, `Venue: ${input.venue}`),
      opt(input.location, `Location: ${input.location}`),
      opt(input.budget, `Budget: ${input.budget}`),
      opt(input.source, `Found you via: ${input.source}`),
      ...Object.entries(input.extras).map(([k, v]) => opt(v, `${k}: ${v}`)),
      "",
      input.story,
      "",
      `Open in your studio: ${siteUrl()}/studio/projects/${projectId}`,
    ];
    await sendEmail({
      to: notify,
      subject: `✦ New inquiry — ${names} (${projectTypeLabel(input.type)})`,
      body: lines.join("\n"),
      logToTimeline: false,
    });
  }

  await fireTrigger("inquiry_received", projectId);
  return { projectId, contactId };
}
