import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { coupleName, fullName } from "@/lib/format";
import { LEAD_SOURCES, PROJECT_TYPES, STAGES } from "@/lib/constants";
import { Card, Checkbox, Field, Input, PageHeader, Select } from "@/components/studio/ui";
import { ActionForm } from "../../_crm/action-form";
import { createProject } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "New lead" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  await requireStudio();
  const { contact: contactId } = await searchParams;
  const contact = contactId
    ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) })
    : undefined;

  return (
    <>
      <Link href="/studio/pipeline" className="mb-3 inline-flex min-h-10 items-center font-sans text-xs uppercase tracking-[0.14em] text-ink-soft hover:text-ink">
        ← Pipeline
      </Link>
      <PageHeader
        eyebrow={contact ? "New project for an existing client" : "Add a lead or client"}
        title="New project"
        description="For someone who reached you by text, DM, or in person. Website inquiries arrive on their own."
      />

      <ActionForm action={createProject} submitLabel="Create project" pendingLabel="Creating…" className="max-w-3xl space-y-6">
        <Card title="Who">
          {contact ? (
            <>
              <input type="hidden" name="contactId" value={contact.id} />
              <p className="font-sans text-[0.95rem]">
                {contact.partnerFirstName ? coupleName(contact) : fullName(contact)}
              </p>
              <p className="font-sans text-sm text-ink-soft">
                {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details yet"}
              </p>
              <p className="mt-2 font-sans text-xs text-muted">
                Adding a project to this existing client.{" "}
                <Link href="/studio/projects/new" className="underline">
                  Start with someone new instead
                </Link>
              </p>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input name="firstName" required autoComplete="off" />
              </Field>
              <Field label="Last name">
                <Input name="lastName" autoComplete="off" />
              </Field>
              <Field label="Email" hint="Needed to email them from the studio.">
                <Input name="email" type="email" inputMode="email" autoComplete="off" />
              </Field>
              <Field label="Phone">
                <Input name="phone" type="tel" autoComplete="off" />
              </Field>
              <Field label="Instagram" hint="Without the @">
                <Input name="instagram" autoCapitalize="none" autoComplete="off" />
              </Field>
              <span />
              <Field label="Partner first name" hint="For couples. Used in the project title.">
                <Input name="partnerFirstName" autoComplete="off" />
              </Field>
              <Field label="Partner last name">
                <Input name="partnerLastName" autoComplete="off" />
              </Field>
            </div>
          )}
        </Card>

        <Card title="The project">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Select name="type" defaultValue="wedding">
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Starting stage">
              <Select name="stage" defaultValue="inquiry">
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input name="eventDate" type="date" />
            </Field>
            <Field label="Or a date note" hint="Like “fall 2027, flexible”">
              <Input name="eventDateNote" />
            </Field>
            <Field label="Venue">
              <Input name="venue" />
            </Field>
            <Field label="Location" hint="City or area">
              <Input name="location" />
            </Field>
            <Field label="Budget">
              <Input name="budget" placeholder="$2,500 – $4,500" />
            </Field>
            <Field label="Booked value" hint="Leave blank until it’s booked.">
              <Input name="value" inputMode="decimal" placeholder="$0" />
            </Field>
            <Field label="Lead source" className="sm:col-span-2">
              <Select name="leadSource" defaultValue="">
                <option value="">Not sure</option>
                {LEAD_SOURCES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Emails">
          <Checkbox name="sendAutoReply" label="Send my inquiry auto-reply to this person" />
          <p className="mt-2 font-sans text-xs text-muted">
            Off by default, so adding a lead never emails anyone on its own. If you tick it, your “new inquiry”
            automations run right after the project is created.
          </p>
        </Card>
      </ActionForm>
    </>
  );
}
