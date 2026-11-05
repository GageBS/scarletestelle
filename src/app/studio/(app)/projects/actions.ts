"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId, newToken } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { fireTrigger } from "@/lib/automations";
import { moveStage } from "@/lib/projects";
import { sendEmail } from "@/lib/email";
import { buildMergeContext, renderTemplate } from "@/lib/merge";
import { parseMoney } from "@/lib/format";
import { projectTypeLabel, BOOKED_STAGES, type Stage } from "@/lib/constants";
import {
  dayStr,
  firstError,
  formObject,
  optInt,
  optNum,
  refresh,
  stageValues,
  timeStr,
  typeValues,
  type FormState,
} from "../_crm/shared";

const optEmail = (msg: string) =>
  z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, msg);

/* ───────────────────────── create ───────────────────────── */
const createSchema = z.object({
  contactId: z.string().trim().max(40),
  firstName: z.string().trim().max(80),
  lastName: z.string().trim().max(80),
  email: optEmail("Please use a valid email"),
  phone: z.string().trim().max(40),
  instagram: z.string().trim().max(80),
  partnerFirstName: z.string().trim().max(80),
  partnerLastName: z.string().trim().max(80),
  type: z.enum(typeValues, "Choose a project type"),
  stage: z.enum(stageValues, "Choose a starting stage"),
  eventDate: dayStr,
  eventDateNote: z.string().trim().max(120),
  venue: z.string().trim().max(160),
  location: z.string().trim().max(160),
  budget: z.string().trim().max(60),
  leadSource: z.string().trim().max(80),
  value: z.string().trim().max(20),
});

export async function createProject(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const raw = formObject(fd);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const sendAutoReply = raw.sendAutoReply === "on";

  let contactId = d.contactId;
  let contact = contactId
    ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) })
    : undefined;
  if (contactId && !contact) return { error: "That client no longer exists." };

  if (!contact) {
    if (!d.firstName) return { error: "Please add the client’s first name." };
    if (sendAutoReply && !d.email) {
      return { error: "An email address is needed to send the auto-reply." };
    }
    const email = d.email.toLowerCase();
    if (email) {
      contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.email, email) });
    }
    if (!contact) {
      contactId = newId();
      await db.insert(schema.contacts).values({
        id: contactId,
        firstName: d.firstName,
        lastName: d.lastName,
        email,
        phone: d.phone,
        instagram: d.instagram.replace(/^@/, ""),
        partnerFirstName: d.partnerFirstName,
        partnerLastName: d.partnerLastName,
        source: d.leadSource,
      });
      contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) });
    } else {
      contactId = contact.id;
    }
  }
  if (!contact) return { error: "Couldn’t save the client. Please try again." };
  if (sendAutoReply && !contact.email) {
    return { error: "This client has no email address, so the auto-reply can’t be sent." };
  }

  const valueCents = d.value ? parseMoney(d.value) : 0;
  if (valueCents === null || valueCents < 0) return { error: "Booked value should be a dollar amount." };

  const names = contact.partnerFirstName
    ? `${contact.firstName} & ${contact.partnerFirstName}`
    : [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const now = new Date();
  const projectId = newId();
  await db.insert(schema.projects).values({
    id: projectId,
    contactId: contact.id,
    title: `${names} — ${projectTypeLabel(d.type)}`,
    type: d.type,
    stage: d.stage,
    eventDate: d.eventDate || null,
    eventDateNote: d.eventDateNote,
    venue: d.venue,
    location: d.location,
    budget: d.budget,
    leadSource: d.leadSource,
    valueCents,
    portalToken: newToken(),
    stageChangedAt: now,
    bookedAt: BOOKED_STAGES.includes(d.stage) ? now : null,
  });
  await logActivity({
    projectId,
    contactId: contact.id,
    kind: "note",
    title: `Added manually as ${projectTypeLabel(d.type).toLowerCase()} · ${d.stage.replace("_", " ")}`,
  });
  if (sendAutoReply) await fireTrigger("inquiry_received", projectId);
  refresh();
  redirect(`/studio/projects/${projectId}`);
}

/* ───────────────────────── update details ───────────────────────── */
const updateSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1, "The project needs a title").max(200),
  type: z.enum(typeValues, "Choose a project type"),
  eventDate: dayStr,
  eventDateNote: z.string().trim().max(120),
  startTime: timeStr,
  endTime: timeStr,
  venue: z.string().trim().max(160),
  location: z.string().trim().max(160),
  guestCount: z.string().trim().max(10),
  coverageHours: z.string().trim().max(10),
  budget: z.string().trim().max(60),
  value: z.string().trim().max(20),
  leadSource: z.string().trim().max(80),
  galleryUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "The gallery link should start with https://"),
  notes: z.string().max(10000),
});

export async function updateProject(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const parsed = updateSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const existing = await db.query.projects.findFirst({ where: eq(schema.projects.id, d.id) });
  if (!existing) return { error: "This project no longer exists." };
  const valueCents = d.value ? parseMoney(d.value) : 0;
  if (valueCents === null || valueCents < 0) return { error: "Value should be a dollar amount." };
  if (d.guestCount && optInt(d.guestCount) === null) return { error: "Guest count should be a whole number." };
  if (d.coverageHours && optNum(d.coverageHours) === null) return { error: "Coverage hours should be a number." };
  await db
    .update(schema.projects)
    .set({
      title: d.title,
      type: d.type,
      eventDate: d.eventDate || null,
      eventDateNote: d.eventDateNote,
      startTime: d.startTime,
      endTime: d.endTime,
      venue: d.venue,
      location: d.location,
      guestCount: optInt(d.guestCount),
      coverageHours: optNum(d.coverageHours),
      budget: d.budget,
      valueCents,
      leadSource: d.leadSource,
      galleryUrl: d.galleryUrl,
      notes: d.notes,
    })
    .where(eq(schema.projects.id, d.id));
  refresh();
  return { ok: "Saved." };
}

/* ───────────────────────── stage ───────────────────────── */
export async function moveProjectStage(
  projectId: string,
  stage: string,
  reason?: string,
): Promise<{ error?: string }> {
  await requireStudio();
  const s = z.enum(stageValues).safeParse(stage);
  if (!s.success) return { error: "That isn’t a valid stage." };
  if (s.data === "lost" && !reason?.trim()) {
    return { error: "Please add a short reason for marking this not booked." };
  }
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!p) return { error: "This project no longer exists." };
  await moveStage(projectId, s.data as Stage, { reason: reason?.trim(), by: "studio" });
  refresh();
  return {};
}

/* ───────────────────────── notes ───────────────────────── */
const noteSchema = z.object({
  projectId: z.string().trim().min(1),
  note: z.string().trim().min(1, "Write a note first").max(5000),
});

export async function addNote(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const parsed = noteSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const p = await db.query.projects.findFirst({
    where: eq(schema.projects.id, parsed.data.projectId),
  });
  if (!p) return { error: "This project no longer exists." };
  await logActivity({
    projectId: p.id,
    contactId: p.contactId,
    kind: "note",
    title: "Note",
    body: parsed.data.note,
  });
  refresh();
  return { ok: "Note added." };
}

/* ───────────────────────── email ───────────────────────── */
const emailSchema = z.object({
  projectId: z.string().trim().min(1),
  to: z.string().trim().email("Please enter a valid recipient email"),
  subject: z.string().trim().min(1, "Add a subject").max(300),
  body: z.string().trim().min(1, "Write your message").max(20000),
});

const UNFILLED = /\{\{\s*([a-z_]+)\s*\}\}/g;
const unfilled = (s: string) => [...new Set([...s.matchAll(UNFILLED)].map((m) => m[1]))];

export type EmailPreview =
  | { subject: string; body: string; missing: string[]; error?: undefined }
  | { error: string };

export async function previewEmail(
  projectId: string,
  subject: string,
  body: string,
): Promise<EmailPreview> {
  await requireStudio();
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!p) return { error: "This project no longer exists." };
  const ctx = await buildMergeContext(projectId);
  const s = renderTemplate(subject, ctx);
  const b = renderTemplate(body, ctx);
  return { subject: s, body: b, missing: unfilled(`${s}\n${b}`) };
}

export async function sendProjectEmail(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const parsed = emailSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, d.projectId) });
  if (!p) return { error: "This project no longer exists." };
  const ctx = await buildMergeContext(p.id);
  const subject = renderTemplate(d.subject, ctx);
  const body = renderTemplate(d.body, ctx);
  const missing = unfilled(`${subject}\n${body}`);
  if (missing.length) {
    return {
      error: `These merge fields have no value for this project: ${missing
        .map((m) => `{{${m}}}`)
        .join(", ")}. Fill them in or remove them, then send again.`,
    };
  }
  const r = await sendEmail({
    to: d.to,
    subject,
    body,
    projectId: p.id,
    contactId: p.contactId,
  });
  refresh();
  if (r.status === "failed") return { error: `The email didn’t go out: ${r.error ?? "unknown error"}` };
  if (r.status === "logged") {
    return {
      ok: `Saved to your emails, but NOT delivered. Email isn’t connected yet, so nothing was sent to ${d.to}.`,
    };
  }
  return { ok: `Sent to ${d.to}.` };
}

/* ───────────────────────── archive / delete ───────────────────────── */
export async function setArchived(fd: FormData): Promise<void> {
  await requireStudio();
  const id = String(fd.get("id") ?? "");
  const archived = fd.get("archived") === "1";
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  if (!p) return;
  await db.update(schema.projects).set({ archived }).where(eq(schema.projects.id, id));
  await logActivity({
    projectId: id,
    contactId: p.contactId,
    kind: "note",
    title: archived ? "Archived" : "Restored from archive",
  });
  refresh();
}

export async function deleteProject(fd: FormData): Promise<void> {
  await requireStudio();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  refresh();
  redirect("/studio/pipeline");
}
