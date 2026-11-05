import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { projectTypeLabel } from "@/lib/constants";
import { formatInstant } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { createTemplate } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Questionnaires" };

export default async function QuestionnairesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const tz = (await getSettings()).business.timezone;
  const [templates, sent] = await Promise.all([
    db.query.questionnaireTemplates.findMany({ orderBy: asc(schema.questionnaireTemplates.name) }),
    db
      .select({ q: schema.questionnaires, project: schema.projects })
      .from(schema.questionnaires)
      .innerJoin(schema.projects, eq(schema.questionnaires.projectId, schema.projects.id))
      .orderBy(desc(schema.questionnaires.createdAt))
      .limit(100),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow"
        title="Questionnaires"
        description="Send clients a beautiful form for timelines, family lists and preferences. Answers land on their project."
        actions={
          <form action={createTemplate}>
            <SubmitButton pendingText="Creating…">New template</SubmitButton>
          </form>
        }
      />
      {sp.ok && <Notice tone="ok">{sp.ok}</Notice>}
      {sp.err && <Notice tone="bad">{sp.err}</Notice>}

      <Card title="Sent questionnaires" pad={false}>
        {sent.length === 0 ? (
          <EmptyState title="None sent yet">
            Open a project and choose “Send a questionnaire”, or let an automation do it when a proposal is signed.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {sent.map(({ q, project }) => (
              <li key={q.id}>
                <Link
                  href={`/studio/questionnaires/sent/${q.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-linen/50 md:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-sm font-medium">{q.title}</span>
                    <span className="block truncate font-sans text-xs text-muted">
                      {project.title} ·{" "}
                      {q.status === "submitted"
                        ? `submitted ${formatInstant(q.submittedAt, tz)}`
                        : `sent ${formatInstant(q.sentAt ?? q.createdAt, tz)}`}
                    </span>
                  </span>
                  {q.status === "submitted" ? (
                    <Badge tone="ok">Submitted</Badge>
                  ) : Object.keys(q.answers).length > 0 ? (
                    <Badge tone="warn">In progress</Badge>
                  ) : (
                    <Badge>Waiting</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Templates" pad={false}>
        {templates.length === 0 ? (
          <EmptyState title="No templates">Create one to get started.</EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:px-5">
                <Link href={`/studio/questionnaires/templates/${t.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-sm font-medium">{t.name}</span>
                  <span className="block font-sans text-xs text-muted">
                    {t.projectType === "any" ? "Any project type" : projectTypeLabel(t.projectType)} ·{" "}
                    {t.fields.filter((f) => f.type !== "heading").length} questions
                  </span>
                </Link>
                <LinkButton href={`/studio/questionnaires/templates/${t.id}`} variant="secondary">
                  Edit
                </LinkButton>
                <LinkButton href={`/studio/questionnaires/send?template=${t.id}`} variant="ghost">
                  Send…
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
