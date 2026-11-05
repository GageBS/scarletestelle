"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { firstError, formObject, refresh, type FormState } from "../_crm/shared";

const contactSchema = z.object({
  id: z.string().trim().min(1),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80),
  email: z.string().trim().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "Please use a valid email"),
  phone: z.string().trim().max(40),
  instagram: z.string().trim().max(80),
  partnerFirstName: z.string().trim().max(80),
  partnerLastName: z.string().trim().max(80),
  partnerEmail: z.string().trim().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "Please use a valid partner email"),
  partnerPhone: z.string().trim().max(40),
  source: z.string().trim().max(80),
  notes: z.string().max(10000),
});

export async function updateContact(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const parsed = contactSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const existing = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, d.id) });
  if (!existing) return { error: "This client no longer exists." };
  await db
    .update(schema.contacts)
    .set({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email.toLowerCase(),
      phone: d.phone,
      instagram: d.instagram.replace(/^@/, ""),
      partnerFirstName: d.partnerFirstName,
      partnerLastName: d.partnerLastName,
      partnerEmail: d.partnerEmail.toLowerCase(),
      partnerPhone: d.partnerPhone,
      source: d.source,
      notes: d.notes,
    })
    .where(eq(schema.contacts.id, d.id));
  refresh();
  return { ok: "Saved." };
}

export async function deleteContact(fd: FormData): Promise<void> {
  await requireStudio();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  // projects, activities and emails cascade with the contact
  await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  refresh();
  redirect("/studio/clients");
}
