"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { renderTemplate } from "@/lib/merge";
import { sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { sampleContext } from "./sample";

const BASE = "/studio/templates";
const tplSchema = z.object({
  name: z.string().trim().min(1, "Give the template a name").max(160),
  subject: z.string().trim().min(1, "Add a subject line").max(300),
  body: z.string().trim().min(1, "The message can't be empty").max(20000),
});
const msg = (kind: "ok" | "err", text: string) => `${kind}=${encodeURIComponent(text)}`;

export async function createEmailTemplate() {
  await requireStudio();
  const id = newId();
  await db.insert(schema.emailTemplates).values({
    id,
    name: "New template",
    subject: "A note from {{photographer_name}}",
    body: "Hi {{client_first_name}},\n\n\n\nWith love,\n{{photographer_name}}",
  });
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

export async function saveEmailTemplate(formData: FormData) {
  await requireStudio();
  const id = String(formData.get("id") ?? "");
  const p = tplSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return redirect(`${BASE}/${id}?${msg("err", p.error.issues[0]?.message ?? "Check the form")}`);
  await db.update(schema.emailTemplates).set(p.data).where(eq(schema.emailTemplates.id, id));
  revalidatePath(BASE);
  redirect(`${BASE}/${id}?${msg("ok", "Saved.")}`);
}

export async function deleteEmailTemplate(formData: FormData) {
  await requireStudio();
  const id = String(formData.get("id") ?? "");
  const used = await db.query.automations.findFirst({ where: eq(schema.automations.emailTemplateId, id) });
  if (used)
    return redirect(`${BASE}/${id}?${msg("err", `“${used.name}” automation uses this template — change that automation first.`)}`);
  await db.delete(schema.emailTemplates).where(eq(schema.emailTemplates.id, id));
  revalidatePath(BASE);
  redirect(`${BASE}?${msg("ok", "Template deleted.")}`);
}

/** Sends the CURRENT (unsaved) subject/body, filled with sample values, to the studio email. */
export async function sendTestEmail(formData: FormData) {
  await requireStudio();
  const id = String(formData.get("id") ?? "");
  const p = tplSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return redirect(`${BASE}/${id}?${msg("err", p.error.issues[0]?.message ?? "Check the form")}`);
  const s = await getSettings();
  const to = s.business.email || s.notifications.notifyEmail;
  if (!to)
    return redirect(`${BASE}/${id}?${msg("err", "Add your studio email in Settings first, so there's somewhere to send the test.")}`);
  const ctx = await sampleContext();
  const r = await sendEmail({
    to,
    subject: `[TEST] ${renderTemplate(p.data.subject, ctx)}`,
    body: renderTemplate(p.data.body, ctx),
    logToTimeline: false,
  });
  const text =
    r.status === "sent"
      ? `Test sent to ${to}.`
      : r.status === "logged"
        ? `Email isn't connected, so the test was only saved in Emails (not delivered to ${to}).`
        : `Test failed: ${r.error}`;
  redirect(`${BASE}/${id}?${msg(r.status === "sent" ? "ok" : "err", text)}`);
}
