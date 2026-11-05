import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings, siteUrl } from "@/lib/settings";
import { MERGE_FIELDS } from "@/lib/merge";
import { addDays, formatDay, todayIn } from "@/lib/format";
import {
  buildSchedule,
  computeTotals,
  CONTRACT_EXTRA_FIELDS,
  selectionMergeValues,
} from "@/lib/billing-math";
import { Card, LinkButton, Notice, PageHeader } from "@/components/studio/ui";
import { ConfirmButton } from "@/components/studio/client-ui";
import { deleteTemplate } from "../../actions";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Contract template" };

const STARTER = `# Photography Agreement

This agreement is made on {{today}} between **{{studio_name}}** ("Photographer") and **{{client_full_name}}** ("Client").

## 1. The session
- **Date:** {{event_date}}
- **Location:** {{location}}

## 2. Services
**{{package_name}}** ({{package_price}}):

{{package_inclusions}}

## 3. Payment
Total **{{total}}**:

{{payment_schedule}}

The retainer of **{{retainer}}** is non-refundable.
`;

async function sampleContext() {
  const s = await getSettings();
  const base = siteUrl();
  const today = todayIn(s.business.timezone);
  const eventDate = addDays(today, 240);
  const pkg = { name: "The Signature", priceCents: 5400_00 };
  const addon = { name: "Film add-on", priceCents: 650_00 };
  const totals = computeTotals(
    [pkg, addon].map((p) => ({ description: p.name, quantity: 1, unitCents: p.priceCents })),
    { taxRateBps: s.payments.defaultTaxRateBps },
  );
  const schedule = buildSchedule(
    { kind: "retainer", retainerPercent: 30, balanceDueDaysBeforeEvent: 30 },
    totals.totalCents,
    { signedDay: today, eventDate },
  );
  return {
    client_first_name: "Hannah",
    client_full_name: "Hannah Brooks",
    partner_first_name: "Eric",
    couple_names: "Hannah & Eric",
    client_email: "hannah@example.com",
    project_title: "Hannah & Eric — Wedding",
    session_type: "Wedding",
    event_date: formatDay(eventDate, "long"),
    event_time: "3:30 PM",
    venue: "The Acreage",
    location: "Sedona, Arizona",
    coverage_hours: "8",
    portal_link: `${base}/c/sample`,
    booking_link: `${base}/book`,
    gallery_link: "https://gallery.example.com/hannah-eric",
    review_link: `${base}/c/sample/review`,
    studio_name: s.business.name,
    photographer_name: s.business.photographer,
    studio_email: s.business.email || "hello@example.com",
    studio_phone: s.business.phone || "(555) 010-0000",
    today: formatDay(today, "long").replace(/^\w+, /, ""),
    ...selectionMergeValues({
      packageName: pkg.name,
      packagePriceCents: pkg.priceCents,
      inclusions: ["Up to 8 hours of coverage", "Film + digital", "Online gallery of 600+ images"],
      addons: [addon],
      totals,
      schedule,
      signedDay: today,
    }),
  } as Record<string, string>;
}

export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStudio();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const tpl = isNew
    ? null
    : await db.query.contractTemplates.findFirst({ where: eq(schema.contractTemplates.id, id) });
  if (!isNew && !tpl) notFound();

  const sample = await sampleContext();
  const fields = [
    ...MERGE_FIELDS.map((f) => ({ ...f, group: "Client, project & studio" })),
    ...CONTRACT_EXTRA_FIELDS.map((f) => ({ ...f, group: "Chosen collection & payments" })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Contracts"
        title={tpl?.name ?? "New contract template"}
        description="Merge fields are filled in from the client's project and the collection they choose, then the text is frozen when they sign."
        actions={
          <LinkButton href="/studio/contracts" variant="secondary">
            All contracts
          </LinkButton>
        }
      />
      {sp.notice === "created" && (
        <div className="mb-5">
          <Notice tone="ok">Template created.</Notice>
        </div>
      )}
      {sp.error === "in-use" && (
        <div className="mb-5">
          <Notice tone="bad">
            This template is attached to an open proposal, so it can&apos;t be deleted yet. Void or finish that
            proposal first.
          </Notice>
        </div>
      )}
      <TemplateEditor
        id={tpl?.id}
        initial={{
          name: tpl?.name ?? "",
          projectType: tpl?.projectType ?? "any",
          body: tpl?.body ?? STARTER,
        }}
        sample={sample}
        fields={fields}
      />
      {tpl && (
        <Card className="mt-8" title="Delete">
          <form action={deleteTemplate.bind(null, tpl.id)} className="flex flex-wrap items-center gap-3">
            <ConfirmButton>Delete template</ConfirmButton>
            <span className="font-sans text-xs text-muted">Signed contracts keep their own frozen copy.</span>
          </form>
        </Card>
      )}
    </>
  );
}
