import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings, siteUrl } from "@/lib/settings";
import { formatInstant } from "@/lib/format";
import { Badge, Card, LinkButton, PageHeader } from "@/components/studio/ui";
import { ConfirmButton, CopyButton } from "@/components/studio/client-ui";
import { deleteSentQuestionnaire } from "../../actions";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Questionnaire answers" };

export default async function SentQuestionnaire({ params }: { params: Promise<{ id: string }> }) {
  await requireStudio();
  const { id } = await params;
  const q = await db.query.questionnaires.findFirst({ where: eq(schema.questionnaires.id, id) });
  if (!q) notFound();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, q.projectId) });
  const tz = (await getSettings()).business.timezone;
  const link = project ? `${siteUrl()}/c/${project.portalToken}/questionnaire/${q.token}` : "";

  return (
    <div className="space-y-6">
      {/* hide the studio chrome when printing this page */}
      <style>{`@media print{aside,nav,body>div>header{display:none!important}main{padding-left:0!important}body{background:#fff!important}}`}</style>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Questionnaires"
          title={q.title}
          description={project?.title}
          actions={
            <>
              <LinkButton href="/studio/questionnaires" variant="ghost">
                ← All questionnaires
              </LinkButton>
              {project && (
                <LinkButton href={`/studio/projects/${project.id}`} variant="secondary">
                  Open project
                </LinkButton>
              )}
              <PrintButton />
            </>
          }
        />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
          <h2 className="display text-2xl">{q.title}</h2>
          {q.status === "submitted" ? <Badge tone="ok">Submitted</Badge> : <Badge tone="warn">Not submitted yet</Badge>}
          <p className="w-full font-sans text-sm text-ink-soft">
            {project?.title}
            {q.status === "submitted" && ` · submitted ${formatInstant(q.submittedAt, tz)}`}
          </p>
        </div>
        <dl className="space-y-5">
          {q.fields.map((f) => {
            if (f.type === "heading")
              return (
                <h3 key={f.id} className="display border-b border-rule pb-1 pt-4 text-xl">
                  {f.label}
                </h3>
              );
            const a = q.answers[f.id];
            const text = Array.isArray(a) ? a.join(", ") : (a ?? "");
            return (
              <div key={f.id} className="break-inside-avoid">
                <dt className="font-sans text-xs uppercase tracking-[0.14em] text-muted">{f.label}</dt>
                <dd className="mt-1 whitespace-pre-line text-[1.05rem]">
                  {text || <span className="font-sans text-sm italic text-muted">No answer</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {link && <CopyButton text={link} label="Copy client link" />}
        <form action={deleteSentQuestionnaire}>
          <input type="hidden" name="id" value={q.id} />
          <ConfirmButton confirmText="Tap again to delete">Delete</ConfirmButton>
        </form>
      </div>
    </div>
  );
}
