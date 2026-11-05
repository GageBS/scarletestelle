"use server";
/* Client-facing questionnaire actions. No studio login: access is the pair of unguessable tokens,
   and the questionnaire must belong to the portal token's project. */
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity } from "@/lib/activity";
import { fireTrigger } from "@/lib/automations";
import { sendEmail } from "@/lib/email";
import { getSettings, siteUrl } from "@/lib/settings";
import type { QField } from "@/lib/constants";

type Answers = Record<string, string | string[]>;
export type QResult =
  | { ok: true; savedAt: number }
  | { ok: false; error: string; missing?: string[] };

async function load(token: string, qtoken: string) {
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.portalToken, token) });
  if (!project) return null;
  const q = await db.query.questionnaires.findFirst({
    where: and(eq(schema.questionnaires.token, qtoken), eq(schema.questionnaires.projectId, project.id)),
  });
  return q ? { project, q } : null;
}

/** Keep only answers for real, answerable fields, coerced to the right shape. */
function clean(fields: QField[], raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const f of fields) {
    if (f.type === "heading") continue;
    const v = r[f.id];
    if (f.type === "checkboxes") {
      const arr = Array.isArray(v) ? v : [];
      const picked = arr.map(String).filter((x) => (f.options ?? []).includes(x));
      if (picked.length) out[f.id] = picked;
    } else if (typeof v === "string") {
      const s = v.slice(0, 10_000);
      if (s.trim() !== "") out[f.id] = s;
    }
  }
  return out;
}

export async function saveDraft(token: string, qtoken: string, answers: Answers): Promise<QResult> {
  const found = await load(token, qtoken);
  if (!found) return { ok: false, error: "This questionnaire link isn't valid." };
  if (found.q.status === "submitted") return { ok: false, error: "This questionnaire was already submitted." };
  await db
    .update(schema.questionnaires)
    .set({ answers: clean(found.q.fields, answers) })
    .where(and(eq(schema.questionnaires.id, found.q.id), ne(schema.questionnaires.status, "submitted")));
  return { ok: true, savedAt: Date.now() };
}

export async function submitQuestionnaire(token: string, qtoken: string, answers: Answers): Promise<QResult> {
  const found = await load(token, qtoken);
  if (!found) return { ok: false, error: "This questionnaire link isn't valid." };
  const { project, q } = found;
  if (q.status === "submitted") return { ok: false, error: "This questionnaire was already submitted." };

  const cleaned = clean(q.fields, answers);
  const missing = q.fields
    .filter((f) => f.type !== "heading" && f.required && !cleaned[f.id])
    .map((f) => f.id);
  if (missing.length)
    return { ok: false, error: "Please answer the questions marked with a star.", missing };

  const now = new Date();
  const res = await db
    .update(schema.questionnaires)
    .set({ answers: cleaned, status: "submitted", submittedAt: now })
    .where(and(eq(schema.questionnaires.id, q.id), ne(schema.questionnaires.status, "submitted")))
    .returning({ id: schema.questionnaires.id });
  if (res.length === 0) return { ok: false, error: "This questionnaire was already submitted." };

  await logActivity({
    projectId: project.id,
    contactId: project.contactId,
    kind: "questionnaire",
    title: `Questionnaire submitted: ${q.title}`,
    meta: { questionnaireId: q.id },
  });
  await fireTrigger("questionnaire_submitted", project.id, { subjectKey: q.id });

  const s = await getSettings();
  const to = s.notifications.notifyEmail || s.business.email;
  if (to) {
    await sendEmail({
      to,
      subject: `✦ Questionnaire submitted — ${project.title}`,
      body: `${project.title} just submitted “${q.title}”.\n\nRead their answers: ${siteUrl()}/studio/questionnaires/sent/${q.id}`,
      projectId: project.id,
      contactId: project.contactId,
      logToTimeline: false,
    });
  }
  revalidatePath("/studio/questionnaires");
  revalidatePath(`/studio/projects/${project.id}`);
  return { ok: true, savedAt: now.getTime() };
}
