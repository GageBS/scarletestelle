import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { PROJECT_TYPES } from "@/lib/constants";
import { Card, Field, LinkButton, Notice, PageHeader, Select } from "@/components/studio/ui";
import { ConfirmButton, SubmitButton } from "@/components/studio/client-ui";
import { deleteTemplate, saveTemplate } from "../../actions";
import { FieldsEditor } from "./fields-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit questionnaire" };

export default async function TemplateBuilder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireStudio();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await db.query.questionnaireTemplates.findFirst({
    where: eq(schema.questionnaireTemplates.id, id),
  });
  if (!t) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Questionnaires"
        title="Edit questionnaire"
        actions={
          <>
            <LinkButton href="/studio/questionnaires" variant="ghost">
              ← All questionnaires
            </LinkButton>
            <LinkButton href={`/studio/questionnaires/send?template=${t.id}`} variant="secondary">
              Send to a client
            </LinkButton>
          </>
        }
      />
      {sp.ok && <Notice tone="ok">{sp.ok}</Notice>}
      {sp.err && <Notice tone="bad">{sp.err}</Notice>}
      <form action={saveTemplate} className="space-y-6">
        <input type="hidden" name="id" value={t.id} />
        <Card title="Questionnaire">
          <div className="space-y-5">
            <Field label="Used for" className="max-w-xs">
              <Select name="projectType" defaultValue={t.projectType}>
                <option value="any">Any project type</option>
                {PROJECT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <FieldsEditor initial={t.fields} title={t.name} intro={t.intro} />
          </div>
        </Card>
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-rule bg-parchment/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <SubmitButton>Save questionnaire</SubmitButton>
        </div>
      </form>
      <form action={deleteTemplate}>
        <input type="hidden" name="id" value={t.id} />
        <ConfirmButton confirmText="Tap again to delete">Delete template</ConfirmButton>
      </form>
    </div>
  );
}
