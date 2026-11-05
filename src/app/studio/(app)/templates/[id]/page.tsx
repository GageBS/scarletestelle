import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { LinkButton, Notice, PageHeader } from "@/components/studio/ui";
import { ConfirmButton } from "@/components/studio/client-ui";
import { deleteEmailTemplate, saveEmailTemplate, sendTestEmail } from "../actions";
import { ALL_FIELDS, sampleContext } from "../sample";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit email template" };

export default async function EditTemplate({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireStudio();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await db.query.emailTemplates.findFirst({ where: eq(schema.emailTemplates.id, id) });
  if (!t) notFound();
  const sample = await sampleContext();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Email templates"
        title={t.name}
        actions={
          <LinkButton href="/studio/templates" variant="ghost">
            ← All templates
          </LinkButton>
        }
      />
      {sp.ok && <Notice tone="ok">{sp.ok}</Notice>}
      {sp.err && <Notice tone="bad">{sp.err}</Notice>}
      <TemplateEditor
        key={`${t.id}-${t.updatedAt.getTime()}`}
        id={t.id}
        initial={{ name: t.name, subject: t.subject, body: t.body }}
        fields={ALL_FIELDS}
        sample={sample}
        save={saveEmailTemplate}
        sendTest={sendTestEmail}
      />
      <form action={deleteEmailTemplate}>
        <input type="hidden" name="id" value={t.id} />
        <ConfirmButton confirmText="Tap again to delete">Delete template</ConfirmButton>
      </form>
    </div>
  );
}
