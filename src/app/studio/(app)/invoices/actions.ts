"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId, newToken } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email";
import { buildMergeContext, renderTemplate } from "@/lib/merge";
import { getSettings, siteUrl } from "@/lib/settings";
import { money, parseMoney, todayIn } from "@/lib/format";
import {
  computeTotals,
  nextInvoiceNumber,
  percentToBps,
  recordPayment,
  withWriteRetry,
  type PaymentMethod,
} from "@/lib/billing";
import { PAYMENT_METHODS, type LineItem } from "@/lib/constants";

export type FormState = { error?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function createInvoice(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const projectId = String(fd.get("projectId") ?? "");
  const title = String(fd.get("title") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 4000);
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!project) return { error: "Choose a project." };
  if (!title) return { error: "Give the invoice a title." };
  if (title.length > 160) return { error: "That title is a little long." };

  // line items
  const descs = fd.getAll("li_desc").map(String);
  const qtys = fd.getAll("li_qty").map(String);
  const units = fd.getAll("li_unit").map(String);
  const items: LineItem[] = [];
  for (let i = 0; i < descs.length; i++) {
    const description = descs[i].trim();
    if (!description && !units[i]?.trim()) continue; // blank row
    if (!description) return { error: `Line ${i + 1}: add a description.` };
    const quantity = Number(qtys[i] || "1");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000)
      return { error: `Line ${i + 1}: quantity must be more than 0.` };
    const unitCents = parseMoney(units[i]);
    if (unitCents == null || unitCents < 0) return { error: `Line ${i + 1}: enter a price like 450.` };
    items.push({ description: description.slice(0, 300), quantity: Math.round(quantity * 100) / 100, unitCents });
  }
  if (items.length === 0) return { error: "Add at least one line item." };
  const taxRateBps = percentToBps(String(fd.get("taxPercent") ?? ""));
  if (taxRateBps == null) return { error: "Tax must be a percentage between 0 and 100." };
  const discountRaw = String(fd.get("discount") ?? "").trim();
  const discountCents = discountRaw ? parseMoney(discountRaw) : 0;
  if (discountCents == null || discountCents < 0) return { error: "Enter the discount as an amount, like 100." };
  const totals = computeTotals(items, { discountCents, taxRateBps });
  if (totals.totalCents <= 0) return { error: "The invoice total must be more than $0." };

  // schedule
  const s = await getSettings();
  const today = todayIn(s.business.timezone);
  const mode = fd.get("scheduleMode") === "custom" ? "custom" : "single";
  let rows: { label: string; amountCents: number; dueDate: string }[];
  if (mode === "single") {
    const due = String(fd.get("singleDue") ?? "");
    if (!DAY.test(due)) return { error: "Choose a due date." };
    rows = [{ label: "Payment in full", amountCents: totals.totalCents, dueDate: due }];
  } else {
    const labels = fd.getAll("in_label").map(String);
    const amounts = fd.getAll("in_amount").map(String);
    const dues = fd.getAll("in_due").map(String);
    rows = [];
    for (let i = 0; i < labels.length; i++) {
      if (!labels[i].trim() && !amounts[i]?.trim()) continue;
      const amountCents = parseMoney(amounts[i]);
      if (amountCents == null || amountCents <= 0) return { error: `Payment ${i + 1}: enter an amount.` };
      if (!DAY.test(dues[i] ?? "")) return { error: `Payment ${i + 1}: choose a due date.` };
      rows.push({ label: labels[i].trim().slice(0, 80) || `Payment ${i + 1}`, amountCents, dueDate: dues[i] });
    }
    if (rows.length === 0) return { error: "Add at least one payment." };
    const sum = rows.reduce((a, r) => a + r.amountCents, 0);
    if (sum !== totals.totalCents)
      return {
        error: `Payments add up to ${money(sum, { cents: true })}, but the total is ${money(totals.totalCents, { cents: true })}.`,
      };
  }
  rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const id = newId();
  await withWriteRetry(() => db.transaction(async (tx) => {
    const number = await nextInvoiceNumber({
      exec: tx,
      prefix: s.business.invoicePrefix,
      timezone: s.business.timezone,
    });
    await tx.insert(schema.invoices).values({
      id,
      projectId: project.id,
      token: newToken(),
      number,
      title,
      lineItems: items,
      ...totals,
      notes,
      status: "draft",
    });
    await tx.insert(schema.installments).values(
      rows.map((r, i) => ({ id: newId(), invoiceId: id, sort: i, ...r })),
    );
  }));
  await logActivity({
    projectId: project.id,
    contactId: project.contactId,
    kind: "invoice",
    title: `Invoice created: ${title} (${money(totals.totalCents)})`,
    meta: { invoiceId: id, today },
  });
  revalidatePath("/studio/invoices");
  redirect(`/studio/invoices/${id}?notice=created`);
}

const methods = PAYMENT_METHODS.map((m) => m.value) as [PaymentMethod, ...PaymentMethod[]];
const payInput = z.object({
  method: z.enum(methods, { error: "Choose how it was paid." }),
  reference: z.string().trim().max(200),
  date: z.string().regex(DAY, "Choose the date it was paid."),
});

export async function recordPaymentAction(installmentId: string, fd: FormData) {
  await requireStudio();
  const inst = await db.query.installments.findFirst({ where: eq(schema.installments.id, installmentId) });
  if (!inst) redirect("/studio/invoices");
  const back = `/studio/invoices/${inst.invoiceId}`;
  const parsed = payInput.safeParse({
    method: fd.get("method") ?? "",
    reference: fd.get("reference") ?? "",
    date: fd.get("date") ?? "",
  });
  if (!parsed.success) redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the form.")}`);
  const s = await getSettings();
  const today = todayIn(s.business.timezone);
  if (parsed.data.date > today) redirect(`${back}?error=${encodeURIComponent("The payment date can't be in the future.")}`);
  // noon UTC keeps the calendar day stable in every US time zone
  const paidAt = parsed.data.date === today ? new Date() : new Date(`${parsed.data.date}T12:00:00Z`);
  const r = await recordPayment(installmentId, {
    method: parsed.data.method,
    reference: parsed.data.reference,
    paidAt,
  });
  revalidatePath("/studio/invoices");
  revalidatePath(back);
  if (!r.ok) redirect(`${back}?error=${encodeURIComponent(r.error)}`);
  const inv = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, inst.invoiceId) });
  const project = inv ? await db.query.projects.findFirst({ where: eq(schema.projects.id, inv.projectId) }) : undefined;
  if (project) revalidatePath(`/c/${project.portalToken}`, "layout");
  redirect(`${back}?notice=paid`);
}

export async function sendInvoice(invoiceId: string) {
  await requireStudio();
  const inv = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, invoiceId) });
  if (!inv) redirect("/studio/invoices");
  const back = `/studio/invoices/${inv.id}`;
  if (inv.status === "void") redirect(`${back}?error=${encodeURIComponent("A void invoice can't be sent.")}`);
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, inv.projectId) });
  if (!project) redirect(back);
  const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, project.contactId) });
  const link = `${siteUrl()}/c/${project.portalToken}/invoice/${inv.token}`;
  const ctx = await buildMergeContext(project.id, { invoice_link: link });
  const mail = await sendEmail({
    to: contact?.email ?? "",
    subject: renderTemplate(`Invoice ${inv.number} from {{studio_name}}`, ctx),
    body: renderTemplate(
      `Hi {{client_first_name}},\n\nHere is your invoice for ${inv.title} (${money(inv.totalCents)}):\n\n{{invoice_link}}\n\nYou'll find the payment schedule there, and you can pay right from the link.\n\nThank you so much!\n{{photographer_name}}`,
      ctx,
    ),
    projectId: project.id,
    contactId: project.contactId,
  });
  if (inv.status === "draft")
    await db
      .update(schema.invoices)
      .set({ status: "sent", sentAt: new Date() })
      .where(and(eq(schema.invoices.id, inv.id), eq(schema.invoices.status, "draft")));
  else await db.update(schema.invoices).set({ sentAt: new Date() }).where(eq(schema.invoices.id, inv.id));
  await logActivity({
    projectId: project.id,
    contactId: project.contactId,
    kind: "invoice",
    title: `Invoice sent: ${inv.number}`,
    body: mail.status === "sent" ? `Emailed to ${contact?.email}` : `Email ${mail.status}${mail.error ? `: ${mail.error}` : ""}`,
    meta: { invoiceId: inv.id, messageId: mail.id },
  });
  revalidatePath("/studio/invoices");
  revalidatePath(`/c/${project.portalToken}`, "layout");
  redirect(`${back}?notice=sent-${mail.status}`);
}

export async function voidInvoice(invoiceId: string) {
  await requireStudio();
  const inst = await db.query.installments.findMany({ where: eq(schema.installments.invoiceId, invoiceId) });
  const back = `/studio/invoices/${invoiceId}`;
  if (inst.some((i) => i.status === "paid"))
    redirect(`${back}?error=${encodeURIComponent("This invoice has payments recorded, so it can't be voided.")}`);
  const r = await db
    .update(schema.invoices)
    .set({ status: "void" })
    .where(and(eq(schema.invoices.id, invoiceId), inArray(schema.invoices.status, ["draft", "sent", "partial"])))
    .returning({ projectId: schema.invoices.projectId, number: schema.invoices.number });
  if (r.length) {
    const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, r[0].projectId) });
    await logActivity({
      projectId: r[0].projectId,
      contactId: p?.contactId ?? null,
      kind: "invoice",
      title: `Invoice voided: ${r[0].number}`,
      meta: { invoiceId },
    });
    if (p) revalidatePath(`/c/${p.portalToken}`, "layout");
  }
  revalidatePath("/studio/invoices");
  redirect(`${back}?notice=voided`);
}
