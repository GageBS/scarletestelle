import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { getSettings, siteUrl } from "@/lib/settings";
import { formatDay, formatInstant, fullName, money, todayIn } from "@/lib/format";
import { installmentsFor, invoiceProgress } from "@/lib/billing";
import { stripeEnabled, stripeWebhookConfigured } from "@/lib/stripe";
import { PAYMENT_METHODS } from "@/lib/constants";
import { Badge, Card, Field, Input, LinkButton, Notice, PageHeader, Select } from "@/components/studio/ui";
import { ConfirmButton, CopyButton, SubmitButton } from "@/components/studio/client-ui";
import { InvoiceDocument } from "@/components/money/invoice-document";
import { PrintButton, PrintStyles } from "@/components/money/print";
import { recordPaymentAction, sendInvoice, voidInvoice } from "../actions";

export const metadata: Metadata = { title: "Invoice" };

const NOTICES: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  created: { tone: "ok", text: "Invoice created as a draft. Send it when you're ready." },
  paid: { tone: "ok", text: "Payment recorded. Your client's invoice now shows it as paid." },
  "sent-sent": { tone: "ok", text: "Invoice emailed to your client." },
  "sent-logged": {
    tone: "warn",
    text: "Marked as sent, but email isn't connected — nothing was delivered. Copy the pay link and send it yourself.",
  },
  "sent-failed": {
    tone: "bad",
    text: "Marked as sent, but the email FAILED (see Emails for the error). Copy the pay link and send it yourself.",
  },
  voided: { tone: "ok", text: "Invoice voided." },
};

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStudio();
  const { id } = await params;
  const sp = await searchParams;
  const invoice = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, id) });
  if (!invoice) notFound();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, invoice.projectId) });
  if (!project) notFound();
  const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, project.contactId) });
  const s = await getSettings();
  const tz = s.business.timezone;
  const today = todayIn(tz);
  const inst = await installmentsFor(invoice.id);
  const prog = invoiceProgress(invoice, inst, today);
  const link = `${siteUrl()}/c/${project.portalToken}/invoice/${invoice.token}`;
  const notice = NOTICES[String(sp.notice ?? "")];
  const error = typeof sp.error === "string" ? sp.error : "";
  const canVoid = invoice.status !== "void" && invoice.status !== "paid" && !inst.some((i) => i.status === "paid");

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow={project.title}
        title={`Invoice ${invoice.number}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge
              tone={
                invoice.status === "paid" ? "ok" : prog.overdue ? "bad" : invoice.status === "partial" ? "warn" : invoice.status === "sent" ? "blush" : "muted"
              }
            >
              {prog.overdue ? "overdue" : invoice.status}
            </Badge>
            <span>
              {money(prog.paidCents)} of {money(invoice.totalCents)} paid
            </span>
            <Link href={`/studio/projects/${project.id}`} className="underline-offset-4 hover:underline">
              Open project
            </Link>
          </span>
        }
        actions={
          <>
            <PrintButton />
            {invoice.status !== "draft" && <CopyButton text={link} label="Copy pay link" />}
            <LinkButton href={link} target="_blank" variant="ghost">
              Client view
            </LinkButton>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3">
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        {error && <Notice tone="bad">{error}</Notice>}
        {stripeEnabled() && !stripeWebhookConfigured() && (
          <Notice tone="warn">
            Card payments are on, but STRIPE_WEBHOOK_SECRET isn&apos;t set — payments are only recorded when the client
            returns to the success page. Add the webhook secret so every card payment is recorded.
          </Notice>
        )}
        {!stripeEnabled() && invoice.status !== "paid" && invoice.status !== "void" && (
          <Notice tone="info">
            Card payments aren&apos;t set up, so your client sees your Venmo / Zelle / check details. Record payments
            here when they arrive.
          </Notice>
        )}
      </div>

      {invoice.status !== "void" && invoice.status !== "paid" && (
        <Card className="mb-6" title={invoice.status === "draft" ? "Send to client" : "Remind client"}>
          <form action={sendInvoice.bind(null, invoice.id)} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1 font-sans text-sm text-ink-soft">
              Emails {contact?.email || "your client"} the pay link
              {invoice.sentAt ? ` (last sent ${formatInstant(invoice.sentAt, tz)})` : ""}.
              {!emailConfigured() && " Email isn't connected, so it will only be saved."}
            </p>
            <SubmitButton variant="accent" pendingText="Sending…">
              {invoice.status === "draft" ? "Send invoice" : "Send again"}
            </SubmitButton>
          </form>
        </Card>
      )}

      <Card className="mb-6" title="Payments" pad={false}>
        <ul className="divide-y divide-rule/70">
          {inst.map((i) => {
            const overdue = i.status === "due" && i.dueDate < today && invoice.status !== "void";
            return (
              <li key={i.id} className="px-4 py-3 md:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-sans text-[0.95rem] text-ink">
                      {i.label} · <span className="tabular-nums">{money(i.amountCents, { cents: true })}</span>
                    </p>
                    <p className={overdue ? "font-sans text-xs text-scarlet" : "font-sans text-xs text-muted"}>
                      {i.status === "paid"
                        ? `Paid ${formatInstant(i.paidAt, tz, { month: "short", day: "numeric", year: "numeric" })} · ${
                            PAYMENT_METHODS.find((m) => m.value === i.method)?.label ?? i.method
                          }${i.reference ? ` · ${i.reference}` : ""}`
                        : `${overdue ? "Overdue — due" : "Due"} ${formatDay(i.dueDate, "medium")}`}
                    </p>
                  </div>
                  <Badge tone={i.status === "paid" ? "ok" : overdue ? "bad" : "muted"}>
                    {i.status === "paid" ? "Paid" : overdue ? "Overdue" : "Due"}
                  </Badge>
                </div>
                {i.status === "due" && invoice.status !== "void" && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-sans text-xs uppercase tracking-[0.16em] text-scarlet">
                      Record payment
                    </summary>
                    <form
                      action={recordPaymentAction.bind(null, i.id)}
                      className="mt-3 grid gap-3 rounded-sm border border-rule bg-parchment/40 p-3 sm:grid-cols-[10rem_1fr_10rem_auto] sm:items-end"
                    >
                      <Field label="Method">
                        <Select name="method" defaultValue="venmo">
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Reference" hint="Optional — check #, Venmo note…">
                        <Input name="reference" />
                      </Field>
                      <Field label="Date paid">
                        <Input type="date" name="date" defaultValue={today} max={today} required />
                      </Field>
                      <SubmitButton pendingText="Recording…">Mark paid</SubmitButton>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
          {inst.length === 0 && <li className="px-4 py-3 font-sans text-sm text-ink-soft md:px-5">No payments are scheduled.</li>}
        </ul>
      </Card>

      <div className="print-area overflow-hidden rounded-sm border border-rule">
        <InvoiceDocument
          invoice={invoice}
          installments={inst}
          studio={{ name: s.business.name, email: s.business.email, phone: s.business.phone }}
          billTo={{
            name: contact ? fullName(contact) : project.title,
            email: contact?.email ?? "",
            project: project.title,
          }}
          today={today}
          timezone={tz}
        />
      </div>

      {canVoid && (
        <Card className="mt-8" title="Void invoice">
          <form action={voidInvoice.bind(null, invoice.id)} className="flex flex-wrap items-center gap-3">
            <ConfirmButton>Void invoice</ConfirmButton>
            <span className="font-sans text-xs text-muted">Your client will see it as cancelled.</span>
          </form>
        </Card>
      )}
      {!canVoid && invoice.status !== "void" && invoice.status !== "paid" && (
        <p className="mt-6 font-sans text-xs text-muted">
          This invoice has payments recorded, so it can&apos;t be voided.
        </p>
      )}
    </>
  );
}
