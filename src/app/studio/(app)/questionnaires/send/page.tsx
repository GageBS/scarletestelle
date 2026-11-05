import type { Metadata } from "next";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { OPEN_LEAD_STAGES, BOOKED_STAGES, projectTypeLabel } from "@/lib/constants";
import { Card, EmptyState, Field, LinkButton, Notice, PageHeader, Select, Textarea } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { sendQuestionnaire } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Send a questionnaire" };

export default async function SendQuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; template?: string; err?: string }>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const templates = await db.query.questionnaireTemplates.findMany({
    orderBy: asc(schema.questionnaireTemplates.name),
  });
  const project = sp.project
    ? await db.query.projects.findFirst({ where: eq(schema.projects.id, sp.project) })
    : null;
  const contact = project
    ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, project.contactId) })
    : null;
  const projects = project
    ? []
    : await db.query.projects.findMany({
        where: inArray(schema.projects.stage, [...OPEN_LEAD_STAGES, ...BOOKED_STAGES]),
        orderBy: desc(schema.projects.updatedAt),
        limit: 200,
      });
  // suggest the template that matches the project type
  const suggested =
    sp.template ??
    (project ? templates.find((t) => t.projectType === project.type)?.id : undefined) ??
    "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Questionnaires"
        title="Send a questionnaire"
        actions={
          <LinkButton href="/studio/questionnaires" variant="ghost">
            ← Back
          </LinkButton>
        }
      />
      {sp.err && <Notice tone="bad">{sp.err}</Notice>}
      {templates.length === 0 ? (
        <Card>
          <EmptyState title="No templates yet">Create a questionnaire template first.</EmptyState>
        </Card>
      ) : (
        <Card className="max-w-2xl">
          <form action={sendQuestionnaire} className="space-y-5">
            {project ? (
              <>
                <input type="hidden" name="projectId" value={project.id} />
                <div>
                  <p className="label text-muted">Sending to</p>
                  <p className="font-sans text-base">{project.title}</p>
                  <p className="font-sans text-sm text-ink-soft">
                    {contact?.email ?? "No email on file"} · {projectTypeLabel(project.type)}
                  </p>
                </div>
              </>
            ) : (
              <Field label="Project">
                <Select name="projectId" required defaultValue="">
                  <option value="" disabled>
                    Choose a project…
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Questionnaire">
              <Select name="templateId" required defaultValue={suggested}>
                <option value="" disabled>
                  Choose a questionnaire…
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Email message (optional)"
              hint="Leave blank for the standard note. Use {{questionnaire_link}} for the link."
            >
              <Textarea
                name="message"
                rows={6}
                placeholder={
                  "Hi {{client_first_name}},\n\nSo I can plan every detail with you, please fill this out when you have a moment:\n\n{{questionnaire_link}}\n\nWith love,\n{{photographer_name}}"
                }
              />
            </Field>
            <SubmitButton pendingText="Sending…">Send questionnaire</SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
