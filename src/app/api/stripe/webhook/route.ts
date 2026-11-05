/**
 * Stripe webhook → records card payments.
 * Point a Stripe webhook endpoint at  {SITE_URL}/api/stripe/webhook  for
 * `checkout.session.completed` (+ `checkout.session.async_payment_succeeded`)
 * and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */
import { handleStripeEvent, verifyStripeSignature, type StripeEvent } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] webhook called but STRIPE_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  const raw = await request.text(); // must be the exact bytes Stripe signed
  const check = verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event);
    return Response.json({ received: true, ...result });
  } catch (e) {
    // 500 → Stripe retries later; recording is idempotent so retries are safe
    console.error("[stripe] webhook handling failed", event.id, e);
    return Response.json({ error: "Handler failed" }, { status: 500 });
  }
}
