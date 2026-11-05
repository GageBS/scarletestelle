import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { Card, EmptyState, LinkButton, Notice, PageHeader } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { createEmailTemplate } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email templates" };

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const templates = await db.query.emailTemplates.findMany({ orderBy: asc(schema.emailTemplates.name) });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow"
        title="Email templates"
        description="Reusable messages in your voice. Merge fields like {{client_first_name}} fill in automatically."
        actions={
          <form action={createEmailTemplate}>
            <SubmitButton pendingText="Creating…">New template</SubmitButton>
          </form>
        }
      />
      {sp.ok && <Notice tone="ok">{sp.ok}</Notice>}
      {sp.err && <Notice tone="bad">{sp.err}</Notice>}
      <Card pad={false}>
        {templates.length === 0 ? (
          <EmptyState title="No templates yet">Create your first one.</EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <Link href={`/studio/templates/${t.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-sm font-medium">{t.name}</span>
                  <span className="block truncate font-sans text-xs text-muted">{t.subject}</span>
                </Link>
                <LinkButton href={`/studio/templates/${t.id}`} variant="secondary">
                  Edit
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
