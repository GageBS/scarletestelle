/**
 * Merge fields for emails, contracts and questionnaires: {{client_first_name}} etc.
 * buildMergeContext(projectId) gathers the values; renderTemplate() fills them in.
 */
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings, siteUrl } from "@/lib/settings";
import { formatDay, formatTime, money } from "@/lib/format";
import { projectTypeLabel } from "@/lib/constants";

export const MERGE_FIELDS: { key: string; label: string }[] = [
  { key: "client_first_name", label: "Client first name" },
  { key: "client_full_name", label: "Client full name" },
  { key: "partner_first_name", label: "Partner first name" },
  { key: "couple_names", label: "Client (& partner) names" },
  { key: "client_email", label: "Client email" },
  { key: "project_title", label: "Project title" },
  { key: "session_type", label: "Session type" },
  { key: "event_date", label: "Event / session date" },
  { key: "event_time", label: "Start time" },
  { key: "venue", label: "Venue" },
  { key: "location", label: "Location" },
  { key: "coverage_hours", label: "Coverage hours" },
  { key: "package_name", label: "Booked package" },
  { key: "total", label: "Booked total" },
  { key: "retainer", label: "Retainer amount" },
  { key: "balance", label: "Balance due" },
  { key: "next_payment_due", label: "Next payment due date" },
  { key: "portal_link", label: "Client portal link" },
  { key: "booking_link", label: "Book-a-call link" },
  { key: "gallery_link", label: "Gallery link" },
  { key: "review_link", label: "Leave-a-review link" },
  { key: "studio_name", label: "Studio name" },
  { key: "photographer_name", label: "Photographer name" },
  { key: "studio_email", label: "Studio email" },
  { key: "studio_phone", label: "Studio phone" },
  { key: "today", label: "Today's date" },
];

export type MergeContext = Record<string, string>;

export function renderTemplate(tpl: string, ctx: MergeContext) {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key: string) =>
    key in ctx ? ctx[key] : m,
  );
}

/** Values for a project (or just studio values when projectId is null). */
export async function buildMergeContext(
  projectId: string | null,
  extra: MergeContext = {},
): Promise<MergeContext> {
  const s = await getSettings();
  const base = siteUrl();
  const ctx: MergeContext = {
    studio_name: s.business.name,
    photographer_name: s.business.photographer,
    studio_email: s.business.email,
    studio_phone: s.business.phone,
    booking_link: `${base}/book`,
    today: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: s.business.timezone,
    }),
  };
  if (projectId) {
    const p = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (p) {
      const c = await db.query.contacts.findFirst({
        where: eq(schema.contacts.id, p.contactId),
      });
      Object.assign(ctx, {
        project_title: p.title,
        session_type: projectTypeLabel(p.type),
        event_date: p.eventDate ? formatDay(p.eventDate, "long") : p.eventDateNote || "TBD",
        event_time: formatTime(p.startTime),
        venue: p.venue,
        location: p.location,
        coverage_hours: p.coverageHours != null ? String(p.coverageHours) : "",
        portal_link: `${base}/c/${p.portalToken}`,
        review_link: `${base}/c/${p.portalToken}/review`,
        gallery_link: p.galleryUrl,
        total: p.valueCents ? money(p.valueCents) : "",
      });
      if (c) {
        Object.assign(ctx, {
          client_first_name: c.firstName,
          client_full_name: [c.firstName, c.lastName].filter(Boolean).join(" "),
          partner_first_name: c.partnerFirstName,
          couple_names: c.partnerFirstName
            ? `${c.firstName} & ${c.partnerFirstName}`
            : c.firstName,
          client_email: c.email,
        });
      }
      // booked package + payment figures from the latest accepted proposal / invoice
      const prop = await db.query.proposals.findFirst({
        where: eq(schema.proposals.projectId, projectId),
        orderBy: desc(schema.proposals.createdAt),
      });
      if (prop?.selectedPackageId) {
        const pkg = await db.query.packages.findFirst({
          where: eq(schema.packages.id, prop.selectedPackageId),
        });
        if (pkg) ctx.package_name = pkg.name;
      }
      const inv = await db.query.invoices.findFirst({
        where: eq(schema.invoices.projectId, projectId),
        orderBy: desc(schema.invoices.createdAt),
      });
      if (inv) {
        const inst = await db.query.installments.findMany({
          where: eq(schema.installments.invoiceId, inv.id),
          orderBy: schema.installments.sort,
        });
        const paid = inst.filter((i) => i.status === "paid").reduce((a, i) => a + i.amountCents, 0);
        const next = inst.find((i) => i.status === "due");
        ctx.total = money(inv.totalCents);
        ctx.retainer = inst[0] ? money(inst[0].amountCents) : "";
        ctx.balance = money(inv.totalCents - paid);
        ctx.next_payment_due = next ? formatDay(next.dueDate, "long") : "";
      }
    }
  }
  return { ...ctx, ...extra };
}
