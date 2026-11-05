/* Invoice body: line items, totals and the payment schedule. Stacks on phones (no
   horizontal scroll). Used by the studio invoice page/print view and the client invoice. */
import { Monogram } from "@/components/brand";
import { cx } from "@/components/studio/ui";
import { formatDay, formatInstant, money } from "@/lib/format";
import { invoiceProgress, lineTotalCents } from "@/lib/billing-math";
import { PAYMENT_METHODS, type LineItem } from "@/lib/constants";

type Inv = {
  number: string;
  title: string;
  status: string;
  lineItems: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes: string;
  createdAt: Date;
  sentAt: Date | null;
};
type Inst = {
  id: string;
  label: string;
  amountCents: number;
  dueDate: string;
  status: "due" | "paid";
  paidAt: Date | null;
  method: string | null;
  reference: string;
};

const methodLabel = (m: string | null) =>
  PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m ?? "";

export function InvoiceDocument({
  invoice,
  installments,
  studio,
  billTo,
  today,
  timezone,
  showHeader = true,
  highlightId,
}: {
  invoice: Inv;
  installments: Inst[];
  studio: { name: string; email: string; phone: string };
  billTo: { name: string; email: string; project: string };
  today: string;
  timezone: string;
  showHeader?: boolean;
  highlightId?: string;
}) {
  const prog = invoiceProgress(invoice, installments, today);
  const row = (label: string, value: string, strong = false) => (
    <div className={cx("flex justify-between gap-4 py-1", strong && "display pt-2 text-xl")}>
      <span className={strong ? "" : "text-ink-soft"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <article className="bg-cream px-5 py-7 sm:px-9 sm:py-10">
      {showHeader && (
        <header className="mb-8 flex flex-col gap-6 border-b border-rule pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Monogram size={50} className="text-ink" />
            <div className="font-sans text-xs leading-relaxed text-ink-soft">
              <p className="label text-ink">{studio.name}</p>
              {studio.email && <p>{studio.email}</p>}
              {studio.phone && <p>{studio.phone}</p>}
            </div>
          </div>
          <div className="font-sans text-xs leading-relaxed sm:text-right">
            <p className="label text-muted">Invoice</p>
            <p className="display text-2xl text-ink">{invoice.number}</p>
            <p className="text-ink-soft">Issued {formatInstant(invoice.sentAt ?? invoice.createdAt, timezone, { month: "short", day: "numeric", year: "numeric" })}</p>
          </div>
        </header>
      )}

      <div className="mb-6 grid gap-4 font-sans text-sm sm:grid-cols-2">
        <div>
          <p className="label text-muted">Billed to</p>
          <p className="mt-1 text-ink">{billTo.name}</p>
          {billTo.email && <p className="text-ink-soft">{billTo.email}</p>}
        </div>
        <div className="sm:text-right">
          <p className="label text-muted">For</p>
          <p className="mt-1 text-ink">{invoice.title}</p>
          <p className="text-ink-soft">{billTo.project}</p>
        </div>
      </div>

      {/* line items */}
      <div className="border-y border-rule font-sans text-sm">
        {invoice.lineItems.map((li, i) => (
          <div key={i} className="flex items-start justify-between gap-4 border-b border-rule/60 py-3 last:border-b-0">
            <div className="min-w-0">
              <p className="text-ink">{li.description}</p>
              {li.quantity !== 1 && (
                <p className="text-xs text-muted">
                  {li.quantity} × {money(li.unitCents)}
                </p>
              )}
            </div>
            <p className="shrink-0 tabular-nums">{money(lineTotalCents(li))}</p>
          </div>
        ))}
      </div>

      <div className="ml-auto mt-4 max-w-xs font-sans text-sm">
        {row("Subtotal", money(invoice.subtotalCents))}
        {invoice.discountCents > 0 && row("Discount", `− ${money(invoice.discountCents)}`)}
        {invoice.taxCents > 0 && row("Tax", money(invoice.taxCents))}
        {row("Total", money(invoice.totalCents), true)}
        {prog.paidCents > 0 && row("Paid", `− ${money(prog.paidCents)}`)}
        {prog.paidCents > 0 && row("Remaining", money(prog.remainingCents), true)}
      </div>

      {installments.length > 0 && (
        <section className="mt-8">
          <p className="label mb-2 text-muted">Payment schedule</p>
          <ol className="divide-y divide-rule/70 border-y border-rule font-sans text-sm">
            {installments.map((i) => {
              const overdue = i.status === "due" && i.dueDate < today && invoice.status !== "void";
              return (
                <li
                  key={i.id}
                  className={cx(
                    "flex items-center justify-between gap-3 py-3",
                    highlightId === i.id && "bg-blush/30 -mx-2 px-2",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-ink">{i.label}</p>
                    <p className={cx("text-xs", overdue ? "text-scarlet" : "text-muted")}>
                      {i.status === "paid"
                        ? `Paid ${formatInstant(i.paidAt, timezone, { month: "short", day: "numeric", year: "numeric" })}${i.method ? ` · ${methodLabel(i.method)}` : ""}`
                        : `${overdue ? "Overdue — was due" : "Due"} ${formatDay(i.dueDate, "medium")}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums">{money(i.amountCents)}</span>
                    <span
                      className={cx(
                        "rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.16em]",
                        i.status === "paid"
                          ? "border-moss/50 text-moss-deep"
                          : overdue
                            ? "border-scarlet/50 text-scarlet"
                            : "border-rule text-ink-soft",
                      )}
                    >
                      {i.status === "paid" ? "Paid" : overdue ? "Overdue" : "Due"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {invoice.notes && (
        <section className="mt-8 font-sans text-sm text-ink-soft">
          <p className="label mb-1 text-muted">Notes</p>
          <p className="whitespace-pre-line">{invoice.notes}</p>
        </section>
      )}
    </article>
  );
}
