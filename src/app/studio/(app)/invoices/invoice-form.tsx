"use client";
/* Standalone invoice builder: line items, discount/tax, and either a single payment or
   custom installments that must add up to the total. */
import { useActionState, useState } from "react";
import { Button, Card, Field, Input, Notice, Textarea, cx } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { computeTotals, percentToBps } from "@/lib/billing-math";
import { addDays, money, parseMoney } from "@/lib/format";
import { createInvoice, type FormState } from "./actions";

type Line = { k: number; desc: string; qty: string; unit: string };
type Pay = { k: number; label: string; amount: string; due: string };
let seq = 1;

/** 30 days before the event (never before today), or 30 days out when there's no date. */
function defaultBalanceDue(eventDate: string | null, today: string) {
  if (!eventDate) return addDays(today, 30);
  const d = addDays(eventDate, -30);
  return d > today ? d : today;
}

export function InvoiceForm({
  project,
  today,
  defaultTaxPercent,
}: {
  project: { id: string; title: string; eventDate: string | null };
  today: string;
  defaultTaxPercent: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(createInvoice, {});
  const [lines, setLines] = useState<Line[]>([{ k: 0, desc: "", qty: "1", unit: "" }]);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState(defaultTaxPercent);
  const [mode, setMode] = useState<"single" | "custom">("single");
  const [pays, setPays] = useState<Pay[]>([
    { k: 0, label: "Retainer", amount: "", due: today },
    { k: 1, label: "Balance", amount: "", due: defaultBalanceDue(project.eventDate, today) },
  ]);

  const items = lines
    .map((l) => ({ description: l.desc, quantity: Number(l.qty) || 0, unitCents: parseMoney(l.unit) ?? 0 }))
    .filter((l) => l.description || l.unitCents);
  const totals = computeTotals(items, { discountCents: parseMoney(discount) ?? 0, taxRateBps: percentToBps(tax) ?? 0 });
  const scheduled = pays.reduce((a, p) => a + (parseMoney(p.amount) ?? 0), 0);
  const left = totals.totalCents - scheduled;

  const setLine = (k: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.k === k ? { ...l, ...patch } : l)));
  const setPay = (k: number, patch: Partial<Pay>) => setPays((ps) => ps.map((p) => (p.k === k ? { ...p, ...patch } : p)));

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="scheduleMode" value={mode} />

      <Card title="Invoice">
        <div className="grid gap-4">
          <Field label="Title">
            <Input name="title" defaultValue={`${project.title.split(" — ")[0]} — Invoice`} required />
          </Field>
        </div>
      </Card>

      <Card title="Line items">
        <div className="flex flex-col gap-3">
          {lines.map((l, i) => (
            <div key={l.k} className="grid grid-cols-[1fr_4.5rem_6.5rem_auto] items-end gap-2 max-sm:grid-cols-[1fr_4rem_6rem_auto]">
              <Field label={i === 0 ? "Description" : " "} className="min-w-0">
                <Input name="li_desc" value={l.desc} onChange={(e) => setLine(l.k, { desc: e.target.value })} placeholder="Second shooter" />
              </Field>
              <Field label={i === 0 ? "Qty" : " "}>
                <Input name="li_qty" inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.k, { qty: e.target.value })} />
              </Field>
              <Field label={i === 0 ? "Price" : " "}>
                <Input name="li_unit" inputMode="decimal" value={l.unit} onChange={(e) => setLine(l.k, { unit: e.target.value })} placeholder="0.00" />
              </Field>
              <button
                type="button"
                aria-label="Remove line"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((x) => x.k !== l.k))}
                className="grid min-h-10 w-9 place-items-center text-muted hover:text-scarlet disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
          <div>
            <Button type="button" variant="ghost" onClick={() => setLines((ls) => [...ls, { k: seq++, desc: "", qty: "1", unit: "" }])}>
              + Add line
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-md">
          <Field label="Discount ($)">
            <Input name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Tax %">
            <Input name="taxPercent" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 font-sans text-sm">
          <dt className="text-ink-soft">Subtotal</dt>
          <dd className="text-right tabular-nums">{money(totals.subtotalCents, { cents: true })}</dd>
          {totals.discountCents > 0 && (
            <>
              <dt className="text-ink-soft">Discount</dt>
              <dd className="text-right tabular-nums">− {money(totals.discountCents, { cents: true })}</dd>
            </>
          )}
          {totals.taxCents > 0 && (
            <>
              <dt className="text-ink-soft">Tax</dt>
              <dd className="text-right tabular-nums">{money(totals.taxCents, { cents: true })}</dd>
            </>
          )}
          <dt className="display pt-1 text-lg">Total</dt>
          <dd className="display pt-1 text-right text-lg tabular-nums">{money(totals.totalCents, { cents: true })}</dd>
        </dl>
      </Card>

      <Card title="Payment schedule">
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {(
            [
              ["single", "Single payment"],
              ["custom", "Custom installments"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={mode === k}
              onClick={() => setMode(k)}
              className={cx(
                "min-h-11 rounded-sm border px-3 font-sans text-sm",
                mode === k ? "border-ink bg-ink text-cream" : "border-rule text-ink-soft hover:border-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "single" ? (
          <div className="mt-4 sm:max-w-xs">
            <Field label="Due date">
              <Input type="date" name="singleDue" defaultValue={addDays(today, 7)} required />
            </Field>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {pays.map((p, i) => (
              <div key={p.k} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_8rem_10rem_auto]">
                <Field label={i === 0 ? "Label" : " "} className="col-span-2 sm:col-span-1">
                  <Input name="in_label" value={p.label} onChange={(e) => setPay(p.k, { label: e.target.value })} />
                </Field>
                <Field label={i === 0 ? "Amount" : " "}>
                  <Input name="in_amount" inputMode="decimal" value={p.amount} onChange={(e) => setPay(p.k, { amount: e.target.value })} placeholder="0.00" />
                </Field>
                <Field label={i === 0 ? "Due" : " "}>
                  <Input type="date" name="in_due" value={p.due} onChange={(e) => setPay(p.k, { due: e.target.value })} />
                </Field>
                <button
                  type="button"
                  aria-label="Remove payment"
                  disabled={pays.length === 1}
                  onClick={() => setPays((ps) => ps.filter((x) => x.k !== p.k))}
                  className="grid min-h-10 w-9 place-items-center text-muted hover:text-scarlet disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPays((ps) => [...ps, { k: seq++, label: `Payment ${ps.length + 1}`, amount: "", due: addDays(today, 30) }])}
              >
                + Add payment
              </Button>
              {left !== 0 && pays.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const last = pays[pays.length - 1];
                    const cur = parseMoney(last.amount) ?? 0;
                    setPay(last.k, { amount: ((cur + left) / 100).toFixed(2) });
                  }}
                >
                  Put remaining {money(left, { cents: true })} on the last payment
                </Button>
              )}
            </div>
            <p className={cx("font-sans text-sm", left === 0 ? "text-moss-deep" : "text-scarlet")}>
              {left === 0
                ? "Payments add up to the total ✓"
                : `${money(Math.abs(left), { cents: true })} ${left > 0 ? "still to schedule" : "over the total"}`}
            </p>
          </div>
        )}
      </Card>

      <Card title="Notes for your client">
        <Textarea name="notes" placeholder="Optional — shown on the invoice." className="min-h-20" />
      </Card>

      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <div className="flex gap-2">
        <SubmitButton variant="accent">Create invoice</SubmitButton>
      </div>
    </form>
  );
}
