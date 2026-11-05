"use server";
/* Client-facing action (no studio login): open Stripe Checkout for the next payment. */
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { siteUrl } from "@/lib/settings";
import { isStudio } from "@/lib/auth";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { getPortalProject } from "../../portal-data";

export type PayState = { error?: string };

export async function startCheckout(_prev: PayState, fd: FormData): Promise<PayState> {
  const token = String(fd.get("token") ?? "");
  const itoken = String(fd.get("itoken") ?? "");
  const installmentId = String(fd.get("installmentId") ?? "");
  const portal = await getPortalProject(token);
  const invoice = await db.query.invoices.findFirst({ where: eq(schema.invoices.token, itoken) });
  if (!portal || !invoice || invoice.projectId !== portal.project.id)
    return { error: "This link is no longer valid." };
  if (await isStudio())
    return {
      error:
        "You're signed in to the studio, so this is a preview — no payment was started. To test paying as a client, open the link in a private window.",
    };
  if (invoice.status !== "sent" && invoice.status !== "partial")
    return { error: "This invoice isn't open for payment." };
  const inst = await db.query.installments.findFirst({
    where: and(eq(schema.installments.id, installmentId), eq(schema.installments.invoiceId, invoice.id)),
  });
  if (!inst || inst.status !== "due") return { error: "This payment has already been made — thank you!" };
  if (!stripeEnabled())
    return { error: "Card payments aren't available right now — please use one of the options below." };

  const page = `${siteUrl()}/c/${token}/invoice/${itoken}`;
  let url: string;
  try {
    const session = await createCheckoutSession({
      installment: inst,
      invoice,
      project: portal.project,
      contactEmail: portal.contact?.email,
      successUrl: `${page}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${page}?canceled=1`,
    });
    await db
      .update(schema.installments)
      .set({ stripeSessionId: session.id })
      .where(eq(schema.installments.id, inst.id));
    url = session.url;
  } catch (e) {
    console.error("[stripe] checkout failed", e);
    return {
      error:
        e instanceof Error && e.message.startsWith("Card payments must")
          ? e.message
          : "We couldn't open the secure checkout just now. Please try again in a moment, or use one of the other ways to pay.",
    };
  }
  redirect(url);
}
