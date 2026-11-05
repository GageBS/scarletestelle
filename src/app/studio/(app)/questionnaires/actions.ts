"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { PROJECT_TYPES, type ProjectType, type QField } from "@/lib/constants";
import { createQuestionnaireFromTemplate } from "@/lib/questionnaires";
import { buildMergeContext, renderTemplate } from "@/lib/merge";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/settings";

const BASE = "/studio/questionnaires";
const typeValues = ["any", ...PROJECT_TYPES.map((t) => t.value)] as [string, ...string[]];

const fieldSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Every question needs some text").max(300),
  type: z.enum(["text", "textarea", "date", "time", "select", "checkboxes", "heading"]),
  help: z.string().trim().max(500).optional(),
  options: z.array(z.string().trim().min(1).max(200)).max(60).optional(),
  required: z.boolean().optional(),
});

export async function createTemplate() {
  await requireStudio();
  const id = newId();
  await db.insert(schema.questionnaireTemplates).values({
    id,
    name: "New questionnaire",
    projectType: "any",
    intro: "",
    fields: [{ id: "q1", label: "Your first question", type: "text" }],
  });
  revalidatePath(BASE);
  redirect(`${BASE}/templates/${id}`);
}

export async function saveTemplate(formData: FormData) {
  await requireStudio();
  const id = String(formData.get("id") ?? "");
  const back = `${BASE}/templates/${id}`;
  const base = z
    .object({
      name: z.string().trim().min(1, "Give the questionnaire a title").max(160),
      projectType: z.enum(typeValues),
      intro: z.string().trim().max(4000).default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!base.success) return redirect(`${back}?err=${encodeURIComponent(base.error.issues[0]?.message ?? "Check the form")}`);
  let fields: QField[];
  try {
    const raw = z.array(fieldSchema).max(200).parse(JSON.parse(String(formData.get("fields") ?? "[]")));
    const ids = new Set<string>();
    fields = raw.map((f) => {
      let fid = f.id;
      while (ids.has(fid)) fid += "x";
      ids.add(fid);
      const needsOptions = f.type === "select" || f.type === "checkboxes";
      return {
        id: fid,
        label: f.label,
        type: f.type,
        ...(f.help ? { help: f.help } : {}),
        ...(needsOptions ? { options: f.options ?? [] } : {}),
        ...(f.required && f.type !== "heading" ? { required: true } : {}),
      };
    });
    const bad = fields.find((f) => (f.type === "select" || f.type === "checkboxes") && !f.options?.length);
    if (bad) return redirect(`${back}?err=${encodeURIComponent(`"${bad.label}" needs at least one option`)}`);
  } catch (e) {
    if (e instanceof z.ZodError)
      return redirect(`${back}?err=${encodeURIComponent(e.issues[0]?.message ?? "Check the questions")}`);
    throw e;
  }
  await db
    .update(schema.questionnaireTemplates)
    .set({ name: base.data.name, projectType: base.data.projectType as ProjectType | "any", intro: base.data.intro, fields })
    .where(eq(schema.questionnaireTemplates.id, id));
  revalidatePath(BASE);
  redirect(`${back}?ok=${encodeURIComponent("Saved.")}`);
}

export async function deleteTemplate(formData: FormData) {
  await requireStudio();
  await db
    .delete(schema.questionnaireTemplates)
    .where(eq(schema.questionnaireTemplates.id, String(formData.get("id") ?? "")));
  revalidatePath(BASE);
  redirect(`${BASE}?ok=${encodeURIComponent("Template deleted. Questionnaires already sent are kept.")}`);
}

const SUBJECT = "A few questions before your session — {{questionnaire_title}}";
const BODY =
  "Hi {{client_first_name}},\n\nSo I can plan every detail with you, please fill out this short questionnaire when you have a moment:\n\n{{questionnaire_link}}\n\nWith love,\n{{photographer_name}}";

export async function sendQuestionnaire(formData: FormData) {
  await requireStudio();
  const projectId = String(formData.get("projectId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const here = `${BASE}/send?project=${encodeURIComponent(projectId)}`;
  if (!projectId) return redirect(`${BASE}/send?err=${encodeURIComponent("Choose a project")}`);
  if (!templateId) return redirect(`${here}&err=${encodeURIComponent("Choose a questionnaire")}`);
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!p) return redirect(`${BASE}/send?err=${encodeURIComponent("Project not found")}`);
  const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, p.contactId) });
  let q;
  try {
    q = await createQuestionnaireFromTemplate(projectId, templateId);
  } catch (e) {
    return redirect(`${here}&err=${encodeURIComponent(e instanceof Error ? e.message : "Could not create it")}`);
  }
  const link = `${siteUrl()}/c/${p.portalToken}/questionnaire/${q.token}`;
  const ctx = await buildMergeContext(projectId, { questionnaire_link: link, questionnaire_title: q.title });
  const r = await sendEmail({
    to: contact?.email ?? "",
    subject: renderTemplate(SUBJECT, ctx),
    body: renderTemplate(String(formData.get("message") ?? "").trim() || BODY, ctx),
    projectId,
    contactId: p.contactId,
  });
  revalidatePath(BASE);
  revalidatePath(`/studio/projects/${projectId}`);
  const msg =
    r.status === "sent"
      ? `Sent “${q.title}” to ${contact?.email}.`
      : r.status === "logged"
        ? `Created “${q.title}”. Email isn't connected, so it was only saved in Emails — copy the link: ${link}`
        : `Created “${q.title}”, but the email failed: ${r.error}. Link: ${link}`;
  redirect(`${BASE}?${r.status === "failed" ? "err" : "ok"}=${encodeURIComponent(msg)}`);
}

export async function deleteSentQuestionnaire(formData: FormData) {
  await requireStudio();
  await db.delete(schema.questionnaires).where(eq(schema.questionnaires.id, String(formData.get("id") ?? "")));
  revalidatePath(BASE);
  redirect(`${BASE}?ok=${encodeURIComponent("Questionnaire removed.")}`);
}
