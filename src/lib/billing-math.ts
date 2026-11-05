/**
 * Pure money + schedule math shared by the server (lib/billing.ts) and client
 * components (proposal flow, invoice builder). NO database or Node imports here.
 * All amounts are integer cents; all calendar days are "YYYY-MM-DD".
 */
import type { LineItem, PaymentPlan } from "@/lib/constants";
import { addDays, daysBetween, formatDay, money } from "@/lib/format";

export type Totals = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export type ScheduleRow = { label: string; amountCents: number; dueDate: string };

export const lineTotalCents = (li: LineItem) => Math.round(li.quantity * li.unitCents);

/** Subtotal → discount (capped at subtotal) → tax on the discounted amount → total. */
export function computeTotals(
  items: LineItem[],
  opts: { discountCents?: number; taxRateBps?: number } = {},
): Totals {
  const subtotal = items.reduce((a, li) => a + lineTotalCents(li), 0);
  const discount = Math.min(Math.max(0, Math.round(opts.discountCents ?? 0)), Math.max(0, subtotal));
  const taxable = subtotal - discount;
  const bps = Math.max(0, Math.round(opts.taxRateBps ?? 0));
  const tax = Math.round((taxable * bps) / 10_000);
  return { subtotalCents: subtotal, discountCents: discount, taxCents: tax, totalCents: taxable + tax };
}

const maxDay = (a: string, b: string) => (a > b ? a : b);
const clampPct = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
const clampInt = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo;

/** The amount the plan asks for at signing (0 = nothing due up front → book immediately). */
export function planFirstAmountCents(plan: PaymentPlan, totalCents: number) {
  const total = Math.max(0, Math.round(totalCents));
  switch (plan.kind) {
    case "full":
      return total;
    case "retainer":
      return Math.min(total, Math.round((total * clampPct(plan.retainerPercent)) / 100));
    case "installments":
      return clampInt(plan.count, 1, 24) === 1
        ? total
        : Math.min(total, Math.round((total * clampPct(plan.firstPercent)) / 100));
  }
}

/**
 * Payment schedule for a plan.
 *  - retainer/first payment = % of the total rounded to the cent; the rounding
 *    remainder always lands on the LAST payment so rows sum exactly to the total
 *  - final payment due N days before the event, or 14 days after signing when there
 *    is no event date
 *  - nothing is ever due before today (or before the signing day)
 *  - zero-amount rows are dropped (a $0 total → empty schedule)
 */
export function buildSchedule(
  plan: PaymentPlan,
  totalCents: number,
  opts: { signedDay: string; eventDate?: string | null; today?: string },
): ScheduleRow[] {
  const total = Math.max(0, Math.round(totalCents));
  if (total === 0) return [];
  const floor = maxDay(opts.signedDay, opts.today ?? opts.signedDay);
  const clamp = (d: string) => maxDay(d, floor);
  const finalDue = (daysBefore: number) =>
    clamp(
      opts.eventDate
        ? addDays(opts.eventDate, -clampInt(daysBefore, 0, 3650))
        : addDays(opts.signedDay, 14),
    );

  let rows: ScheduleRow[];
  switch (plan.kind) {
    case "full":
      rows = [
        {
          label: "Payment in full",
          amountCents: total,
          dueDate: clamp(addDays(opts.signedDay, clampInt(plan.dueDaysAfterSigning, 0, 3650))),
        },
      ];
      break;
    case "retainer": {
      const retainer = planFirstAmountCents(plan, total);
      rows =
        retainer >= total
          ? [{ label: "Payment in full", amountCents: total, dueDate: floor }]
          : [
              { label: "Retainer", amountCents: retainer, dueDate: floor },
              {
                label: "Balance",
                amountCents: total - retainer,
                dueDate: finalDue(plan.balanceDueDaysBeforeEvent),
              },
            ];
      break;
    }
    case "installments": {
      const count = clampInt(plan.count, 1, 24);
      if (count === 1) {
        rows = [{ label: "Payment in full", amountCents: total, dueDate: floor }];
        break;
      }
      const first = planFirstAmountCents(plan, total);
      const n = count - 1;
      const rest = total - first;
      const each = Math.floor(rest / n);
      const amounts = [first, ...Array.from({ length: n }, () => each)];
      amounts[amounts.length - 1] += rest - each * n;
      const last = finalDue(plan.finalDueDaysBeforeEvent);
      const span = Math.max(0, daysBetween(floor, last));
      rows = amounts.map((amountCents, i) => ({
        label: i === 0 ? "Retainer" : i === n ? "Final payment" : `Payment ${i + 1}`,
        amountCents,
        dueDate: i === 0 ? floor : i === n ? last : addDays(floor, Math.round((span * i) / n)),
      }));
      break;
    }
  }
  return rows.filter((r) => r.amountCents > 0);
}

/** Human summary of a plan, e.g. "30% retainer · balance 30 days before". */
export function describePlan(plan: PaymentPlan) {
  switch (plan.kind) {
    case "full":
      return plan.dueDaysAfterSigning > 0
        ? `Paid in full within ${plan.dueDaysAfterSigning} days of signing`
        : "Paid in full at signing";
    case "retainer":
      return `${plan.retainerPercent}% retainer at signing · balance ${plan.balanceDueDaysBeforeEvent} days before the date`;
    case "installments":
      return `${plan.count} payments · ${plan.firstPercent}% at signing · final ${plan.finalDueDaysBeforeEvent} days before the date`;
  }
}

/* ── merge values that only exist once a collection is chosen ───────────── */

/** Keys whose value depends on the chosen package/add-ons (stripped before preview). */
export const SELECTION_MERGE_KEYS = [
  "package_name",
  "package_price",
  "package_inclusions",
  "addons",
  "subtotal",
  "discount",
  "tax",
  "total",
  "retainer",
  "balance",
  "balance_due_date",
  "next_payment_due",
  "payment_schedule",
] as const;

/** Extra merge fields available in CONTRACTS (on top of lib/merge.ts MERGE_FIELDS). */
export const CONTRACT_EXTRA_FIELDS: { key: string; label: string }[] = [
  { key: "package_price", label: "Collection price" },
  { key: "package_inclusions", label: "Collection inclusions (bulleted list)" },
  { key: "addons", label: "Chosen add-ons (bulleted list)" },
  { key: "subtotal", label: "Subtotal" },
  { key: "discount", label: "Discount" },
  { key: "tax", label: "Tax" },
  { key: "payment_schedule", label: "Payment schedule (bulleted list)" },
  { key: "balance_due_date", label: "Final payment due date" },
];

export function selectionMergeValues(input: {
  packageName: string;
  packagePriceCents: number;
  inclusions: string[];
  addons: { name: string; priceCents: number }[];
  totals: Totals;
  schedule: ScheduleRow[];
  signedDay: string;
}): Record<string, string> {
  const { totals, schedule } = input;
  const first = schedule[0];
  const lastRow = schedule[schedule.length - 1];
  const dueText = (r: ScheduleRow) =>
    r.dueDate <= input.signedDay ? `due upon signing` : `due ${formatDay(r.dueDate, "long")}`;
  return {
    package_name: input.packageName,
    package_price: money(input.packagePriceCents),
    package_inclusions: input.inclusions.length
      ? input.inclusions.map((i) => `- ${i}`).join("\n")
      : "- As described in the selected collection",
    addons: input.addons.length
      ? input.addons.map((a) => `- ${a.name} (${money(a.priceCents)})`).join("\n")
      : "- None",
    subtotal: money(totals.subtotalCents),
    discount: money(totals.discountCents),
    tax: money(totals.taxCents),
    total: money(totals.totalCents),
    retainer: first ? money(first.amountCents) : money(0),
    balance: money(totals.totalCents - (schedule.length > 1 && first ? first.amountCents : totals.totalCents)),
    balance_due_date: lastRow ? formatDay(lastRow.dueDate, "long") : "",
    next_payment_due: first ? formatDay(first.dueDate, "long") : "",
    payment_schedule: schedule.length
      ? schedule.map((r) => `- **${r.label}:** ${money(r.amountCents)} — ${dueText(r)}`).join("\n")
      : "- No payment is due",
  };
}

/** {{field}} replacement — identical rules to lib/merge.ts renderTemplate (pure copy for the client). */
export function fillFields(tpl: string, ctx: Record<string, string>) {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key: string) => (key in ctx ? ctx[key] : m));
}

/* ── invoice progress ───────────────────────────────────────────────────── */
export function invoiceProgress<I extends { status: "due" | "paid"; amountCents: number; dueDate: string }>(
  inv: { totalCents: number; status: string },
  inst: I[],
  today: string,
) {
  const paidCents = inst.filter((i) => i.status === "paid").reduce((a, i) => a + i.amountCents, 0);
  const due = inst.filter((i) => i.status === "due").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const open = inv.status === "sent" || inv.status === "partial";
  const overdueRows = open ? due.filter((i) => i.dueDate < today) : [];
  return {
    paidCents,
    remainingCents: Math.max(0, inv.totalCents - paidCents),
    next: open ? (due[0] ?? null) : null,
    overdueCents: overdueRows.reduce((a, i) => a + i.amountCents, 0),
    overdue: overdueRows.length > 0,
  };
}

/** "8.25" → 825 basis points (null when invalid). */
export function percentToBps(input: string | null | undefined): number | null {
  if (input == null || String(input).trim() === "") return 0;
  const n = Number(String(input).replace(/[%\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}
export const bpsToPercent = (bps: number) => String(Math.round(bps) / 100);
