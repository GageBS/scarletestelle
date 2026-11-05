import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { coupleName, formatDay, fullName, money, todayIn } from "@/lib/format";
import { installmentsFor, invoiceProgress } from "@/lib/billing";
import { recordCheckoutSession, retrieveCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { InvoiceDocument } from "@/components/money/invoice-document";
import { PrintButton, PrintStyles } from "@/components/money/print";
import { Flourish, PortalCard, PortalHeading, PortalLink, portalBtn } from "@/components/money/portal-ui";
import { getPortalProject } from "../../portal-data";
import { PayButton } from "./pay-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your invoice" };

/** The most recent payment recorded within the last `ms` milliseconds (from the DB). */
function latestPaidWithin<T extends { status: string; paidAt: Date | null }>(rows: T[], ms: number) {
  const cutoff = Date.now() - ms;
  return rows
    .filter((i) => i.status === "paid" && i.paidAt && i.paidAt.getTime() >= cutoff)
    .sort((a, b) => b.paidAt!.getTime() - a.paidAt!.getTime())[0];
}

export default async function ClientInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; itoken: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, itoken } = await params;
  const sp = await searchParams;
  const portal = await getPortalProject(token);
  if (!portal) notFound();
  const { project, contact } = portal;
  const invoice = await db.query.invoices.findFirst({ where: eq(schema.invoices.token, itoken) });
  if (!invoice || invoice.projectId !== project.id) notFound();
  const studio = await isStudio();
  if (invoice.status === "draft" && !studio) notFound();

  const s = await getSettings();
  const today = todayIn(s.business.timezone);
  const p = s.payments;
  const first = s.business.photographer.split(" ")[0];

  // Back from Stripe: confirm with Stripe's API (never the query string) and record it.
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : "";
  if (sessionId && stripeEnabled()) {
    try {
      const session = await retrieveCheckoutSession(sessionId);
      if (session.metadata?.invoice_id === invoice.id) await recordCheckoutSession(session, "return");
    } catch (e) {
      console.error("[stripe] could not confirm session on return", sessionId, e);
    }
  }

  const fresh = (await db.query.invoices.findFirst({ where: eq(schema.invoices.id, invoice.id) })) ?? invoice;
  const inst = await installmentsFor(invoice.id);
  const prog = invoiceProgress(fresh, inst, today);
  const next = prog.next;
  const recentlyPaid = latestPaidWithin(inst, 2 * 3_600_000);
  const manual = [
    p.venmo && { k: "Venmo", v: p.venmo.startsWith("@") ? p.venmo : `@${p.venmo}` },
    p.zelle && { k: "Zelle", v: p.zelle },
    p.checkPayableTo && { k: "Check", v: `Payable to ${p.checkPayableTo}` },
  ].filter(Boolean) as { k: string; v: string }[];
  const card = stripeEnabled();
  const names = contact ? coupleName(contact) : project.title;

  const manualOptions = (
    <div className="text-left">
      {manual.length > 0 ? (
        <dl className="mx-auto grid max-w-sm grid-cols-[5.5rem_1fr] gap-x-4 gap-y-2 font-sans text-[0.95rem]">
          {manual.map((m) => (
            <div key={m.k} className="contents">
              <dt className="label pt-0.5 text-muted">{m.k}</dt>
              <dd className="break-words text-ink">{m.v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-center text-ink-soft">
          {first} will send you payment details{s.business.email ? ` — or email ${s.business.email}` : ""}.
        </p>
      )}
      {p.instructions && <p className="mx-auto mt-4 max-w-md whitespace-pre-line text-center text-ink-soft">{p.instructions}</p>}
      <p className="mx-auto mt-5 max-w-md text-center font-sans text-sm text-ink-soft">
        Please include <span className="text-ink">{fresh.number}</span> in the memo. Once your payment arrives,{" "}
        {first} will mark it as paid and you&apos;ll see it here.
      </p>
    </div>
  );

  return (
    <div>
      <PrintStyles />
      {studio && fresh.status === "draft" && (
        <p className="mb-8 rounded-[2px] border border-rose bg-blush/40 px-4 py-3 text-center font-sans text-sm text-wine">
          Studio preview of a draft — your client can&apos;t open this until you send it.
        </p>
      )}

      <PortalHeading
        script={sp.signed ? "It's official" : fresh.status === "paid" ? "Thank you" : "Your invoice"}
        title={sp.signed ? "Your agreement is signed" : fresh.title}
      >
        {sp.signed && next ? (
          <p>
            One last step: your <span className="text-ink">{next.label.toLowerCase()}</span> of{" "}
            <span className="text-ink">{money(next.amountCents)}</span> reserves your date.
          </p>
        ) : (
          <p className="font-sans text-[0.75rem] uppercase tracking-[0.22em] text-muted">
            Invoice {fresh.number} · {names}
          </p>
        )}
      </PortalHeading>

      <Flourish className="mt-10" />

      {/* payment state — always from the database */}
      <PortalCard className="mt-10 text-center">
        {fresh.status === "void" ? (
          <p className="text-[1.1rem]">This invoice was cancelled. Please reach out with any questions.</p>
        ) : !next ? (
          <>
            <p className="script inked text-5xl text-scarlet">Paid in full</p>
            <p className="mt-3 text-ink-soft">
              {money(prog.paidCents)} received — thank you so much. Nothing else is due.
            </p>
          </>
        ) : (
          <>
            {sp.paid && (
              <div className="mb-6 rounded-[2px] border border-rule bg-parchment/70 px-4 py-3 font-sans text-sm">
                {recentlyPaid ? (
                  <p className="text-moss-deep">
                    Payment received — {recentlyPaid.label} of {money(recentlyPaid.amountCents)}. Thank you!
                  </p>
                ) : (
                  <p className="text-ink-soft">
                    Thank you! We&apos;re confirming your payment with the card processor — it will show here as
                    paid within a few minutes. You&apos;ll also receive an emailed receipt.
                  </p>
                )}
              </div>
            )}
            {sp.canceled && !sp.paid && (
              <p className="mb-6 font-sans text-sm text-ink-soft">Checkout was cancelled — nothing was charged.</p>
            )}
            <p className="label text-muted">{prog.overdue ? "Past due" : "Next payment"}</p>
            <p className="display mt-2 text-5xl">{money(next.amountCents)}</p>
            <p className="mt-2 text-ink-soft">
              {next.label} ·{" "}
              {next.dueDate <= today
                ? next.dueDate < today
                  ? `was due ${formatDay(next.dueDate, "long")}`
                  : "due today"
                : `due ${formatDay(next.dueDate, "long")}`}
            </p>
            <div className="mt-7">
              {card ? (
                <>
                  <PayButton
                    token={token}
                    itoken={itoken}
                    installmentId={next.id}
                    label={`Pay ${money(next.amountCents)} by card`}
                    disabled={fresh.status === "draft"}
                  />
                  <p className="mt-3 font-sans text-xs text-muted">Secure checkout by Stripe</p>
                  {manual.length > 0 && (
                    <details className="mt-6 border-t border-rule pt-4">
                      <summary className="cursor-pointer list-none font-sans text-[0.7rem] uppercase tracking-[0.22em] text-ink-soft">
                        Other ways to pay
                      </summary>
                      <div className="mt-4">
                        {manualOptions}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p className="label mb-4 text-ink-soft">How to pay</p>
                  {manualOptions}
                </>
              )}
            </div>
          </>
        )}
      </PortalCard>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <PrintButton label="Print or save as PDF" className={portalBtn.outline} />
        <PortalLink href={`/c/${token}`} variant="quiet">
          Back to your portal
        </PortalLink>
      </div>

      <div className="print-area mt-8 overflow-hidden rounded-[2px] border border-rule shadow-[0_18px_40px_-28px_rgb(42_18_19/0.45)]">
        <InvoiceDocument
          invoice={fresh}
          installments={inst}
          studio={{ name: s.business.name, email: s.business.email, phone: s.business.phone }}
          billTo={{
            name: contact ? fullName(contact) : names,
            email: contact?.email ?? "",
            project: project.title,
          }}
          today={today}
          timezone={s.business.timezone}
          highlightId={next?.id}
        />
      </div>
    </div>
  );
}
