/**
 * Stripe Checkout without the SDK (plain fetch + node:crypto).
 *  - stripeEnabled()            STRIPE_SECRET_KEY is set → clients can pay by card
 *  - createCheckoutSession()    one-off Checkout Session for one installment
 *  - retrieveCheckoutSession()  read a session back (success-page fallback)
 *  - verifyStripeSignature()    Stripe v1 webhook signature (HMAC-SHA256, 5 min tolerance)
 *  - handleStripeEvent()        records the payment for a paid Checkout Session (idempotent)
 * A payment is only ever recorded from Stripe's own data (signed webhook or API read).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordPayment } from "@/lib/billing";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email";
import { getSettings, siteUrl } from "@/lib/settings";
import { money } from "@/lib/format";

const API = "https://api.stripe.com/v1";
export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);
export const stripeWebhookConfigured = () => Boolean(process.env.STRIPE_WEBHOOK_SECRET);

export type CheckoutSession = {
  id: string;
  url: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired" | null;
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  payment_intent: string | { id: string } | null;
  metadata: Record<string, string> | null;
};

async function stripeFetch<T>(path: string, init: { method: "GET" | "POST"; form?: URLSearchParams }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Card payments aren't set up (STRIPE_SECRET_KEY is missing).");
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init.form?.toString(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${json.error?.message ?? res.statusText}`);
  return json as T;
}

export async function createCheckoutSession(o: {
  installment: { id: string; label: string; amountCents: number };
  invoice: { id: string; number: string; title: string };
  project: { id: string; title: string };
  contactEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const amount = Math.round(o.installment.amountCents);
  if (!Number.isInteger(amount) || amount < 50)
    throw new Error("Card payments must be at least $0.50.");
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("success_url", o.successUrl);
  f.set("cancel_url", o.cancelUrl);
  f.set("client_reference_id", o.installment.id);
  if (o.contactEmail) f.set("customer_email", o.contactEmail);
  f.set("line_items[0][quantity]", "1");
  f.set("line_items[0][price_data][currency]", "usd");
  f.set("line_items[0][price_data][unit_amount]", String(amount));
  f.set("line_items[0][price_data][product_data][name]", `${o.installment.label} — ${o.project.title}`.slice(0, 250));
  f.set("line_items[0][price_data][product_data][description]", `Invoice ${o.invoice.number} · ${o.invoice.title}`.slice(0, 500));
  for (const [k, v] of Object.entries({
    installment_id: o.installment.id,
    invoice_id: o.invoice.id,
    project_id: o.project.id,
    invoice_number: o.invoice.number,
  })) {
    f.set(`metadata[${k}]`, v);
    f.set(`payment_intent_data[metadata][${k}]`, v);
  }
  f.set("payment_intent_data[description]", `${o.invoice.number} · ${o.installment.label}`);
  const s = await stripeFetch<CheckoutSession>("/checkout/sessions", { method: "POST", form: f });
  if (!s.url) throw new Error("Stripe did not return a checkout link.");
  return { id: s.id, url: s.url };
}

export async function retrieveCheckoutSession(id: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new Error("Not a Checkout Session id");
  return stripeFetch<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(id)}`, { method: "GET" });
}

/* ───────────────────────── webhook signature ───────────────────────── */
/**
 * Stripe-Signature: "t=1700000000,v1=<hex hmac>,v1=…,v0=…"
 * signed payload = `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret (whsec_…).
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  opts: { toleranceSec?: number; nowSec?: number } = {},
): { ok: true; timestamp: number } | { ok: false; reason: string } {
  if (!secret) return { ok: false, reason: "webhook secret not configured" };
  if (!header) return { ok: false, reason: "missing Stripe-Signature header" };
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d+$/.test(v)) t = Number(v);
    else if (k === "v1") v1.push(v);
  }
  if (t == null) return { ok: false, reason: "no timestamp in signature" };
  if (v1.length === 0) return { ok: false, reason: "no v1 signature" };
  const tolerance = opts.toleranceSec ?? 300;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > tolerance) return { ok: false, reason: "timestamp outside tolerance" };
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest();
  for (const sig of v1) {
    if (!/^[0-9a-f]{64}$/i.test(sig)) continue;
    const got = Buffer.from(sig, "hex");
    if (got.length === expected.length && timingSafeEqual(got, expected)) return { ok: true, timestamp: t };
  }
  return { ok: false, reason: "signature mismatch" };
}

/* ───────────────────────── recording a paid session ───────────────────────── */
export type StripeEvent = { id: string; type: string; created?: number; data?: { object?: unknown } };

const intentId = (pi: CheckoutSession["payment_intent"]) =>
  typeof pi === "string" ? pi : (pi?.id ?? null);

/**
 * Record the payment for a PAID Checkout Session. Safe to call many times for the
 * same session (webhook retries + success-page fallback): the installment is only
 * marked paid once. A second, different payment for an already-paid installment is
 * flagged loudly (timeline + email) so Scarlet can refund it.
 */
export async function recordCheckoutSession(session: CheckoutSession, source: "webhook" | "return") {
  if (session.payment_status !== "paid") return { recorded: false, reason: "not paid" };
  const installmentId = session.metadata?.installment_id || session.client_reference_id;
  if (!installmentId) return { recorded: false, reason: "no installment reference" };
  const inst = await db.query.installments.findFirst({
    where: eq(schema.installments.id, installmentId),
  });
  if (!inst) return { recorded: false, reason: `unknown installment ${installmentId}` };
  const reference = intentId(session.payment_intent) ?? session.id;

  const r = await recordPayment(inst.id, { method: "stripe", reference, allowVoid: true });
  const inv = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, inst.invoiceId) });

  if (!r.ok) {
    if (r.alreadyPaid && r.existing && r.existing.reference !== reference && inv) {
      // a genuinely different charge for something already paid — never swallow it
      const s = await getSettings();
      const title = `Possible duplicate card payment: ${inst.label} ${money(session.amount_total ?? inst.amountCents)}`;
      const already = await db.query.activities.findFirst({
        where: eq(schema.activities.title, `${title} (${reference})`),
      });
      if (!already) {
        await logActivity({
          projectId: inv.projectId,
          kind: "payment",
          title: `${title} (${reference})`,
          body: `This installment was already marked paid (${r.existing.method ?? "?"} ${r.existing.reference}). Check Stripe and refund if needed.`,
          meta: { installmentId: inst.id, stripeReference: reference },
        });
        const to = s.notifications.notifyEmail || s.business.email;
        if (to)
          await sendEmail({
            to,
            subject: `⚠ ${title}`,
            body: `Stripe reports payment ${reference} for invoice ${inv.number} (${inst.label}), which was already marked paid.\n\nPlease review it in Stripe and refund if it's a duplicate.\n\n${siteUrl()}/studio/invoices/${inv.id}`,
            logToTimeline: false,
          });
      }
      return { recorded: false, reason: "duplicate payment flagged" };
    }
    return { recorded: false, reason: r.error };
  }

  if (session.amount_total != null && session.amount_total !== inst.amountCents && inv) {
    await logActivity({
      projectId: inv.projectId,
      kind: "payment",
      title: `Card amount differs from schedule: ${money(session.amount_total)} paid for ${inst.label} (${money(inst.amountCents)})`,
      body: `Stripe ${reference}. Adjust the invoice if needed.`,
      meta: { installmentId: inst.id },
    });
  }
  if (source === "return") console.info("[stripe] payment recorded from success page", session.id);
  return { recorded: true, reason: "ok" };
}

export async function handleStripeEvent(event: StripeEvent) {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data?.object as CheckoutSession | undefined;
    if (!session || typeof session !== "object") return { recorded: false, reason: "no session" };
    return recordCheckoutSession(session, "webhook");
  }
  return { recorded: false, reason: `ignored ${event.type}` };
}
