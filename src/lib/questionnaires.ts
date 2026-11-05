import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId, newToken } from "@/lib/ids";
import { logActivity } from "@/lib/activity";

/** Copy a questionnaire template onto a project (status "sent") and return it. */
export async function createQuestionnaireFromTemplate(projectId: string, templateId: string) {
  const t = await db.query.questionnaireTemplates.findFirst({
    where: eq(schema.questionnaireTemplates.id, templateId),
  });
  if (!t) throw new Error(`Questionnaire template ${templateId} not found`);
  const row = {
    id: newId(),
    projectId,
    templateId: t.id,
    token: newToken(),
    title: t.name,
    intro: t.intro,
    fields: t.fields,
    answers: {},
    status: "sent" as const,
    sentAt: new Date(),
  };
  await db.insert(schema.questionnaires).values(row);
  await logActivity({
    projectId,
    kind: "questionnaire",
    title: `Questionnaire sent: ${t.name}`,
    meta: { questionnaireId: row.id },
  });
  return row;
}
