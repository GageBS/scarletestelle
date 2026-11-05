import { buildMergeContext, MERGE_FIELDS, type MergeContext } from "@/lib/merge";
import { siteUrl } from "@/lib/settings";

/** Fields that only exist when an automation supplies them (payments, questionnaires). */
export const AUTOMATION_FIELDS: { key: string; label: string }[] = [
  { key: "payment_amount", label: "Payment amount (reminders)" },
  { key: "payment_label", label: "Payment name, e.g. Balance (reminders)" },
  { key: "payment_due_date", label: "Payment due date (reminders)" },
  { key: "invoice_link", label: "Invoice link (reminders)" },
  { key: "questionnaire_link", label: "Questionnaire link" },
  { key: "questionnaire_title", label: "Questionnaire title" },
];

export const ALL_FIELDS = [...MERGE_FIELDS, ...AUTOMATION_FIELDS];

/** Realistic sample values for previews and test sends. */
export async function sampleContext(): Promise<MergeContext> {
  const base = await buildMergeContext(null);
  const site = siteUrl();
  return {
    client_first_name: "Hannah",
    client_full_name: "Hannah Whitfield",
    partner_first_name: "Eric",
    couple_names: "Hannah & Eric",
    client_email: "hannah@example.com",
    project_title: "Hannah & Eric — Wedding",
    session_type: "Wedding",
    event_date: "Saturday, October 16, 2027",
    event_time: "4:00 PM",
    venue: "The Acreage",
    location: "Sedona, Arizona",
    coverage_hours: "8",
    package_name: "Signature Wedding",
    total: "$5,200",
    retainer: "$1,560",
    balance: "$3,640",
    next_payment_due: "September 16, 2027",
    portal_link: `${site}/c/sample-portal`,
    gallery_link: `${site}/gallery/sample`,
    review_link: `${site}/c/sample-portal/review`,
    payment_amount: "$3,640",
    payment_label: "Balance",
    payment_due_date: "September 16, 2027",
    invoice_link: `${site}/c/sample-portal/invoice/sample`,
    questionnaire_link: `${site}/c/sample-portal/questionnaire/sample`,
    questionnaire_title: "Wedding day questionnaire",
    ...Object.fromEntries(Object.entries(base).filter(([, v]) => v)),
  };
}
