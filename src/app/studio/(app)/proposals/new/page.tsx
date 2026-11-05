import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { addDays, todayIn } from "@/lib/format";
import { bpsToPercent } from "@/lib/billing-math";
import { stageLabel } from "@/lib/constants";
import { Button, Card, Field, LinkButton, Notice, PageHeader, Select } from "@/components/studio/ui";
import { ProposalForm } from "../proposal-form";
import { builderOptions } from "../options";
import { DEFAULT_PROPOSAL_BODY, DEFAULT_PROPOSAL_MESSAGE, DEFAULT_PROPOSAL_SUBJECT } from "../defaults";

export const metadata: Metadata = { title: "New proposal" };

export default async function NewProposalPage({
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

  if (!project) {
    const projects = await db.query.projects.findMany({
      where: eq(schema.projects.archived, false),
      orderBy: desc(schema.projects.createdAt),
      limit: 200,
    });
    return (
      <>
        <PageHeader eyebrow="Proposals" title="New proposal" description="Which client is this for?" />
        {projectId && (
          <div className="mb-4">
            <Notice tone="bad">That project couldn&apos;t be found.</Notice>
          </div>
        )}
        <Card>
          {projects.length === 0 ? (
            <p className="font-sans text-sm text-ink-soft">
              No projects yet — proposals are sent from a client&apos;s project.
            </p>
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

  const [contact, s, opts] = await Promise.all([
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, project.contactId) }),
    getSettings(),
    builderOptions(project.type),
  ]);
  const today = todayIn(s.business.timezone);

  return (
    <>
      <PageHeader
        eyebrow={project.title}
        title="New proposal"
        actions={
          <LinkButton href="/studio/proposals" variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <ProposalForm
        project={{ id: project.id, title: project.title, eventDate: project.eventDate }}
        packages={opts.packages}
        templates={opts.templates}
        today={today}
        sent={false}
        values={{
          title: `${project.title.split(" — ")[0]} — Proposal`,
          message: DEFAULT_PROPOSAL_MESSAGE(contact?.firstName ?? "", s.business.photographer),
          packageIds: [],
          addonIds: [],
          contractTemplateId: opts.defaultTemplateId,
          plan: { kind: "retainer", retainerPercent: 30, balanceDueDaysBeforeEvent: 30 },
          taxPercent: bpsToPercent(s.payments.defaultTaxRateBps),
          discount: "",
          expiresOn: addDays(today, 14),
          emailSubject: DEFAULT_PROPOSAL_SUBJECT,
          emailBody: DEFAULT_PROPOSAL_BODY,
        }}
      />
    </>
  );
}
