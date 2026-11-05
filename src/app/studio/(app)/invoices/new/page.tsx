import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/format";
import { bpsToPercent } from "@/lib/billing-math";
import { stageLabel } from "@/lib/constants";
import { Button, Card, Field, LinkButton, Notice, PageHeader, Select } from "@/components/studio/ui";
import { InvoiceForm } from "../invoice-form";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const projectId = typeof sp.project === "string" ? sp.project : "";
  const project = projectId
    ? await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) })
    : undefined;
  const s = await getSettings();

  if (!project) {
    const projects = await db.query.projects.findMany({
      where: eq(schema.projects.archived, false),
      orderBy: desc(schema.projects.createdAt),
      limit: 200,
    });
    return (
      <>
        <PageHeader
          eyebrow="Invoices"
          title="New invoice"
          description="For extras, prints or sessions without a proposal. Booked clients get their invoice automatically when they sign."
        />
        {projectId && (
          <div className="mb-4">
            <Notice tone="bad">That project couldn&apos;t be found.</Notice>
          </div>
        )}
        <Card>
          {projects.length === 0 ? (
            <p className="font-sans text-sm text-ink-soft">No projects yet — invoices belong to a client&apos;s project.</p>
          ) : (
            <form method="get" className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Field label="Project" className="flex-1">
                <Select name="project" required defaultValue="">
                  <option value="" disabled>
                    Choose a project…
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · {stageLabel(p.stage)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit">Continue</Button>
            </form>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={project.title}
        title="New invoice"
        description="It's saved as a draft — send it from the next screen."
        actions={
          <LinkButton href="/studio/invoices" variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <InvoiceForm
        project={{ id: project.id, title: project.title, eventDate: project.eventDate }}
        today={todayIn(s.business.timezone)}
        defaultTaxPercent={bpsToPercent(s.payments.defaultTaxRateBps)}
      />
    </>
  );
}
