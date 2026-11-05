import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { coupleName, formatDay, fullName, money } from "@/lib/format";
import { projectTypeLabel } from "@/lib/constants";
import { ConfirmButton } from "@/components/studio/client-ui";
import { Card, EmptyState, Field, Input, LinkButton, PageHeader, StageBadge, Textarea } from "@/components/studio/ui";
import { ActionForm } from "../../_crm/action-form";
import { ListRow, RowList, SampleBadge, projectHref } from "../../_crm/parts";
import { deleteContact, updateContact } from "../actions";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStudio();
  const { id } = await params;
  const c = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, id) });
  if (!c) notFound();
  const projects = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.contactId, id))
    .orderBy(desc(schema.projects.createdAt));

  return (
    <>
      <Link href="/studio/clients" className="mb-3 inline-flex min-h-10 items-center font-sans text-xs uppercase tracking-[0.14em] text-ink-soft hover:text-ink">
        ← Clients
      </Link>
      <PageHeader
        eyebrow="Client"
        title={c.partnerFirstName ? coupleName(c) : fullName(c)}
        description={c.isSample ? "Sample client: safe to delete." : undefined}
        actions={
          <LinkButton href={`/studio/projects/new?contact=${c.id}`} variant="accent">
            + New project
          </LinkButton>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Contact details">
            <ActionForm action={updateContact} submitLabel="Save changes">
              <input type="hidden" name="id" value={c.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="First name">
                  <Input name="firstName" defaultValue={c.firstName} required />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" defaultValue={c.lastName} />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" inputMode="email" defaultValue={c.email} />
                </Field>
                <Field label="Phone">
                  <Input name="phone" type="tel" defaultValue={c.phone} />
                </Field>
                <Field label="Instagram" hint="Without the @">
                  <Input name="instagram" defaultValue={c.instagram} autoCapitalize="none" />
                </Field>
                <Field label="How they found you">
                  <Input name="source" defaultValue={c.source} />
                </Field>
              </div>
              <p className="label mb-2 mt-6 text-muted">Partner</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Partner first name">
                  <Input name="partnerFirstName" defaultValue={c.partnerFirstName} />
                </Field>
                <Field label="Partner last name">
                  <Input name="partnerLastName" defaultValue={c.partnerLastName} />
                </Field>
                <Field label="Partner email">
                  <Input name="partnerEmail" type="email" inputMode="email" defaultValue={c.partnerEmail} />
                </Field>
                <Field label="Partner phone">
                  <Input name="partnerPhone" type="tel" defaultValue={c.partnerPhone} />
                </Field>
              </div>
              <Field label="Notes" className="mt-4" hint="Only you see these.">
                <Textarea name="notes" defaultValue={c.notes} rows={5} />
              </Field>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={`Projects (${projects.length})`} pad={false}>
            {projects.length === 0 ? (
              <EmptyState title="No projects">Start one for this client.</EmptyState>
            ) : (
              <RowList>
                {projects.map((p) => (
                  <ListRow
                    key={p.id}
                    href={projectHref(p.id)}
                    title={p.title}
                    sub={`${projectTypeLabel(p.type)} · ${formatDay(p.eventDate)}${p.valueCents ? ` · ${money(p.valueCents)}` : ""}`}
                    right={<StageBadge stage={p.stage} />}
                  />
                ))}
              </RowList>
            )}
            <div className="border-t border-rule p-4">
              <LinkButton href={`/studio/projects/new?contact=${c.id}`} variant="secondary" className="w-full">
                + New project for {c.firstName}
              </LinkButton>
            </div>
          </Card>

          <Card title="Danger zone">
            <p className="mb-3 font-sans text-sm text-ink-soft">
              Deleting a client also deletes all of their projects, to-dos and email history. This can’t be undone.
              {c.isSample && " "}
              {c.isSample && <SampleBadge />}
            </p>
            <form action={deleteContact}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton confirmText="Tap again to delete forever">Delete client</ConfirmButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
