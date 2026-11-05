/**
 * Money logic for proposals → contracts → invoices → payments.
 *
 *  computeTotals / buildSchedule  — pure math (re-exported from lib/billing-math.ts)
 *  nextInvoiceNumber()            — `${invoicePrefix}-${YYYY}-${NNNN}`
 *  acceptProposal(...)            — client signs: freezes the choice, signs the contract,
 *                                   issues the invoice + schedule (one DB transaction)
 *  recordPayment(...)             — marks an installment paid (manual or Stripe), idempotent
 *
 * Rule: inside a transaction only `tx` is used (libSQL gives a transaction its own
 * connection). Timeline entries, automations, emails and stage moves run AFTER commit.
 */
import { createHash } from "node:crypto";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId, newToken } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { fireTrigger } from "@/lib/automations";
import { moveStage } from "@/lib/projects";
import { sendEmail } from "@/lib/email";
import { buildMergeContext, renderTemplate } from "@/lib/merge";
import { getSettings, siteUrl, type StudioSettings } from "@/lib/settings";
import { formatDay, money, todayIn } from "@/lib/format";
import { OPEN_LEAD_STAGES, type LineItem, type PAYMENT_METHODS } from "@/lib/constants";
import {
  buildSchedule,
  computeTotals,
  fillFields,
  planFirstAmountCents,
  selectionMergeValues,
  SELECTION_MERGE_KEYS,
  type ScheduleRow,
} from "@/lib/billing-math";

export * from "@/lib/billing-math";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];
type Proposal = typeof schema.proposals.$inferSelect;
type Pkg = typeof schema.packages.$inferSelect;

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** Where studio alerts go (null = nobody to notify). */
const notifyAddress = (s: StudioSettings) => s.notifications.notifyEmail || s.business.email || null;

/* ───────────────────────── write-lock retries ───────────────────────── */
function isBusy(e: unknown): boolean {
  for (let cur: unknown = e, depth = 0; cur && depth < 5; depth++) {
    const err = cur as { message?: string; code?: string; cause?: unknown };
    if (/SQLITE_BUSY|database is locked/i.test(`${err.code ?? ""} ${err.message ?? ""}`)) return true;
    cur = err.cause;
  }
  return false;
}

/**
 * Run a write (usually a transaction) and retry it when SQLite reports the database is
 * locked by another in-flight write. libSQL's local driver is synchronous with a 0 ms busy
 * timeout, so waiting must happen here, asynchronously, to let the other write finish.
 */
export async function withWriteRetry<T>(fn: () => Promise<T>, attempts = 12): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isBusy(e) || i >= attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 30 * (i + 1)));
    }
  }
}

/** Side effects after a committed money write: retried, and never undo the success. */
async function afterCommit(label: string, fn: () => Promise<unknown>) {
  try {
    await withWriteRetry(fn, 6);
  } catch (e) {
    console.error(`[billing] ${label} failed after commit`, e);
  }
}

/* ───────────────────────── invoice numbers ───────────────────────── */
/** Next free invoice number for this year, e.g. "SE-2026-0007". Pass `exec` inside a transaction. */
export async function nextInvoiceNumber(
  opts: { exec?: Exec; prefix?: string; timezone?: string; now?: Date } = {},
) {
  let { prefix, timezone } = opts;
  if (prefix == null || timezone == null) {
    const s = await getSettings();
    prefix ??= s.business.invoicePrefix;
    timezone ??= s.business.timezone;
  }
  const clean = (prefix || "INV").trim().replace(/[^A-Za-z0-9]+/g, "") || "INV";
  const year = todayIn(timezone, opts.now ?? new Date()).slice(0, 4);
  const head = `${clean}-${year}-`;
  const exec = opts.exec ?? db;
  const rows = await exec
    .select({ number: schema.invoices.number })
    .from(schema.invoices)
    .where(like(schema.invoices.number, `${head}%`));
  let max = 0;
  for (const r of rows) {
    const m = r.number.slice(head.length).match(/^(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${head}${String(max + 1).padStart(4, "0")}`;
}

/* ───────────────────────── proposal helpers ───────────────────────── */
export function proposalStatusForClient(p: Proposal, today: string) {
  if (p.status === "void") return "void" as const;
  if (p.status === "accepted") return "accepted" as const;
  if (p.status === "draft") return "draft" as const;
  if (p.expiresOn && p.expiresOn < today) return "expired" as const;
  return "open" as const;
}

/** Line items for a chosen package + add-ons (prices frozen from the package rows). */
function selectionLineItems(pkg: Pkg, addons: Pkg[]): LineItem[] {
  return [
    { description: pkg.name, quantity: 1, unitCents: pkg.priceCents },
    ...addons.map((a) => ({ description: a.name, quantity: 1, unitCents: a.priceCents })),
  ];
}

/**
 * Contract template merged with every project/studio value, leaving the
 * selection-dependent fields ({{package_name}}, {{total}}, …) for fillFields().
 * The client page and acceptProposal() both use this, so the text the client reads
 * is built exactly like the text that gets signed.
 */
export async function contractPreMerge(projectId: string, templateBody: string) {
  const ctx = await buildMergeContext(projectId);
  for (const k of SELECTION_MERGE_KEYS) delete ctx[k];
  for (const k of ["venue", "location", "event_time", "coverage_hours"]) {
    if (!ctx[k]) ctx[k] = "TBD";
  }
  return renderTemplate(templateBody, ctx);
}

function computeSelection(
  proposal: Pick<Proposal, "discountCents" | "taxRateBps" | "paymentPlan">,
  pkg: Pkg,
  addons: Pkg[],
  opts: { signedDay: string; eventDate: string | null },
) {
  const lineItems = selectionLineItems(pkg, addons);
  const totals = computeTotals(lineItems, {
    discountCents: proposal.discountCents,
    taxRateBps: proposal.taxRateBps,
  });
  const schedule = buildSchedule(proposal.paymentPlan, totals.totalCents, {
    signedDay: opts.signedDay,
    eventDate: opts.eventDate,
  });
  const values = selectionMergeValues({
    packageName: pkg.name,
    packagePriceCents: pkg.priceCents,
    inclusions: pkg.inclusions,
    addons: addons.map((a) => ({ name: a.name, priceCents: a.priceCents })),
    totals,
    schedule,
    signedDay: opts.signedDay,
  });
  return { lineItems, totals, schedule, values };
}

/* ───────────────────────── accept (sign) a proposal ───────────────────────── */
export type AcceptInput = {
  proposalId: string;
  packageId: string;
  addonIds: string[];
  signatureName: string;
  signatureImage: string; // data:image/png;base64,…
  ip: string;
  userAgent: string;
  now?: Date;
};
export type AcceptResult =
  | {
      ok: true;
      contractId: string;
      contractToken: string;
      invoiceId: string;
      invoiceToken: string;
      firstDue: ScheduleRow | null;
      booked: boolean;
    }
  | { ok: false; error: string; code: "not_found" | "not_open" | "invalid" };

const MAX_SIGNATURE_CHARS = 200_000;

export async function acceptProposal(input: AcceptInput): Promise<AcceptResult> {
  const now = input.now ?? new Date();
  const s = await getSettings();
  const today = todayIn(s.business.timezone, now);

  const proposal = await db.query.proposals.findFirst({
    where: eq(schema.proposals.id, input.proposalId),
  });
  if (!proposal) return { ok: false, code: "not_found", error: "This proposal no longer exists." };
  const state = proposalStatusForClient(proposal, today);
  if (state === "accepted")
    return { ok: false, code: "not_open", error: "This proposal has already been signed." };
  if (state !== "open")
    return {
      ok: false,
      code: "not_open",
      error:
        state === "expired"
          ? "This proposal has expired — please reach out and we'll send a fresh one."
          : "This proposal is no longer available.",
    };

  const name = input.signatureName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120)
    return { ok: false, code: "invalid", error: "Please type your full legal name." };
  if (
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.signatureImage) ||
    input.signatureImage.length > MAX_SIGNATURE_CHARS ||
    input.signatureImage.length < 200
  )
    return { ok: false, code: "invalid", error: "Please draw your signature in the box." };

  if (!proposal.packageIds.includes(input.packageId))
    return { ok: false, code: "invalid", error: "Please choose one of the offered collections." };
  const addonIds = [...new Set(input.addonIds)];
  if (addonIds.some((a) => !proposal.addonIds.includes(a)))
    return { ok: false, code: "invalid", error: "One of the add-ons isn't part of this proposal." };

  const pkgRows = await db.query.packages.findMany({
    where: inArray(schema.packages.id, [input.packageId, ...addonIds]),
  });
  const pkg = pkgRows.find((p) => p.id === input.packageId);
  if (!pkg) return { ok: false, code: "invalid", error: "That collection is no longer available." };
  const addons = addonIds.map((id) => pkgRows.find((p) => p.id === id)).filter((p): p is Pkg => !!p);
  if (addons.length !== addonIds.length)
    return { ok: false, code: "invalid", error: "One of the add-ons is no longer available." };

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, proposal.projectId),
  });
  if (!project) return { ok: false, code: "not_found", error: "Project not found." };
  const contact = await db.query.contacts.findFirst({
    where: eq(schema.contacts.id, project.contactId),
  });

  if (!proposal.contractTemplateId)
    return { ok: false, code: "invalid", error: "This proposal has no agreement attached yet." };
  const template = await db.query.contractTemplates.findFirst({
    where: eq(schema.contractTemplates.id, proposal.contractTemplateId),
  });
  if (!template)
    return { ok: false, code: "invalid", error: "The agreement for this proposal is missing." };

  const sel = computeSelection(proposal, pkg, addons, {
    signedDay: today,
    eventDate: project.eventDate,
  });
  const body = fillFields(await contractPreMerge(project.id, template.body), sel.values);
  const bodyHash = sha256(body);
  const contractId = newId();
  const contractToken = newToken();
  const invoiceId = newId();
  const invoiceToken = newToken();

  try {
    await withWriteRetry(() => db.transaction(async (tx) => {
      // claim the proposal first — a second, concurrent acceptance finds nothing to update
      const claimed = await tx
        .update(schema.proposals)
        .set({ status: "accepted", acceptedAt: now })
        .where(
          and(
            eq(schema.proposals.id, proposal.id),
            inArray(schema.proposals.status, ["sent", "viewed"]),
          ),
        )
        .returning({ id: schema.proposals.id });
      if (claimed.length === 0) throw new AlreadyAccepted();

      await tx.insert(schema.contracts).values({
        id: contractId,
        projectId: project.id,
        proposalId: proposal.id,
        token: contractToken,
        title: template.name,
        body,
        bodyHash,
        status: "signed",
        clientSignatureName: name,
        clientSignatureImage: input.signatureImage,
        clientSignedAt: now,
        clientSignedIp: input.ip.slice(0, 100),
        clientSignedUa: input.userAgent.slice(0, 500),
        sentAt: proposal.sentAt ?? now,
      });

      const number = await nextInvoiceNumber({
        exec: tx,
        prefix: s.business.invoicePrefix,
        timezone: s.business.timezone,
        now,
      });
      await tx.insert(schema.invoices).values({
        id: invoiceId,
        projectId: project.id,
        proposalId: proposal.id,
        token: invoiceToken,
        number,
        title: `${pkg.name} — ${project.title}`,
        lineItems: sel.lineItems,
        ...sel.totals,
        status: "sent",
        sentAt: now,
        ...(sel.schedule.length === 0 ? { status: "paid" as const, paidAt: now } : {}),
      });
      if (sel.schedule.length) {
        await tx.insert(schema.installments).values(
          sel.schedule.map((r, i) => ({
            id: newId(),
            invoiceId,
            sort: i,
            label: r.label,
            amountCents: r.amountCents,
            dueDate: r.dueDate,
          })),
        );
      }
      await tx
        .update(schema.proposals)
        .set({
          selectedPackageId: pkg.id,
          selectedAddonIds: addons.map((a) => a.id),
          contractId,
          invoiceId,
        })
        .where(eq(schema.proposals.id, proposal.id));
      await tx
        .update(schema.projects)
        .set({ valueCents: sel.totals.totalCents })
        .where(eq(schema.projects.id, project.id));
    }));
  } catch (e) {
    if (e instanceof AlreadyAccepted)
      return { ok: false, code: "not_open", error: "This proposal has already been signed." };
    throw e;
  }

  // ── after commit: timeline, automations, notifications, stage ──
  const who = contact ? [contact.firstName, contact.partnerFirstName].filter(Boolean).join(" & ") : name;
  await afterCommit("accept: timeline", () =>
    logActivity({
      projectId: project.id,
      contactId: project.contactId,
      kind: "proposal",
      title: `Proposal accepted: ${proposal.title}`,
      body: `${who} chose ${pkg.name}${addons.length ? ` + ${addons.map((a) => a.name).join(", ")}` : ""} — ${money(sel.totals.totalCents)}`,
      meta: { proposalId: proposal.id, packageId: pkg.id, addonIds: addons.map((a) => a.id) },
    }),
  );
  await afterCommit("accept: timeline", () =>
    logActivity({
      projectId: project.id,
      contactId: project.contactId,
      kind: "contract",
      title: `Contract signed: ${template.name}`,
      body: `Signed by ${name}`,
      meta: { contractId, bodyHash, ip: input.ip },
    }),
  );
  await afterCommit("accept: timeline", () =>
    logActivity({
      projectId: project.id,
      contactId: project.contactId,
      kind: "invoice",
      title: `Invoice issued: ${money(sel.totals.totalCents)}`,
      body: sel.schedule.map((r) => `${r.label} ${money(r.amountCents)} due ${r.dueDate}`).join(" · "),
      meta: { invoiceId },
    }),
  );

  await fireTrigger("proposal_accepted", project.id, { subjectKey: proposal.id });

  const to = notifyAddress(s);
  if (to && s.notifications.notifyOnSigned) {
    await afterCommit("accept: notify studio", () => sendEmail({
      to,
      subject: `✦ Signed — ${project.title} (${money(sel.totals.totalCents)})`,
      body: [
        `${who} signed "${template.name}" and chose ${pkg.name}.`,
        addons.length ? `Add-ons: ${addons.map((a) => a.name).join(", ")}` : null,
        `Total: ${money(sel.totals.totalCents)}`,
        sel.schedule[0]
          ? `First payment: ${money(sel.schedule[0].amountCents)} (${sel.schedule[0].label}) due ${formatDay(sel.schedule[0].dueDate, "long")}`
          : "Nothing is due.",
        "",
        `Countersign: ${siteUrl()}/studio/contracts/${contractId}`,
        `Invoice: ${siteUrl()}/studio/invoices/${invoiceId}`,
      ]
        .filter((l): l is string => l !== null)
        .join("\n"),
      logToTimeline: false,
    }));
  }

  // booked now only when nothing is due at signing; otherwise the first payment books it
  const booked = planFirstAmountCents(proposal.paymentPlan, sel.totals.totalCents) === 0;
  if (booked && OPEN_LEAD_STAGES.includes(project.stage)) {
    await afterCommit("accept: book", () =>
      moveStage(project.id, "booked", { by: "client", reason: "Proposal signed" }),
    );
  }

  return {
    ok: true,
    contractId,
    contractToken,
    invoiceId,
    invoiceToken,
    firstDue: sel.schedule[0] ?? null,
    booked,
  };
}
class AlreadyAccepted extends Error {}

/* ───────────────────────── record a payment ───────────────────────── */
export type PaymentResult =
  | {
      ok: true;
      installmentId: string;
      invoiceId: string;
      invoiceStatus: "partial" | "paid";
      projectId: string;
    }
  | {
      ok: false;
      alreadyPaid: boolean;
      error: string;
      existing?: typeof schema.installments.$inferSelect;
    };

export async function recordPayment(
  installmentId: string,
  p: { method: PaymentMethod; reference?: string; paidAt?: Date; allowVoid?: boolean },
): Promise<PaymentResult> {
  const paidAt = p.paidAt ?? new Date();
  const reference = (p.reference ?? "").trim().slice(0, 200);

  type Outcome =
    | { kind: "ok"; inv: typeof schema.invoices.$inferSelect; inst: typeof schema.installments.$inferSelect; status: "partial" | "paid" }
    | { kind: "err"; error: string; alreadyPaid: boolean; existing?: typeof schema.installments.$inferSelect };

  const outcome: Outcome = await withWriteRetry(() => db.transaction(async (tx): Promise<Outcome> => {
    const [inst] = await tx
      .select()
      .from(schema.installments)
      .where(eq(schema.installments.id, installmentId));
    if (!inst) return { kind: "err", error: "Payment not found.", alreadyPaid: false };
    const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, inst.invoiceId));
    if (!inv) return { kind: "err", error: "Invoice not found.", alreadyPaid: false };
    if (inst.status === "paid")
      return { kind: "err", error: "This payment was already recorded.", alreadyPaid: true, existing: inst };
    if (inv.status === "void" && !p.allowVoid)
      return { kind: "err", error: "This invoice is void.", alreadyPaid: false };

    const updated = await tx
      .update(schema.installments)
      .set({ status: "paid", paidAt, method: p.method, reference })
      .where(and(eq(schema.installments.id, inst.id), eq(schema.installments.status, "due")))
      .returning({ id: schema.installments.id });
    if (updated.length === 0)
      return { kind: "err", error: "This payment was already recorded.", alreadyPaid: true, existing: inst };

    const all = await tx
      .select({ status: schema.installments.status })
      .from(schema.installments)
      .where(eq(schema.installments.invoiceId, inv.id));
    const status = all.every((r) => r.status === "paid") ? "paid" : "partial";
    if (inv.status !== "void") {
      await tx
        .update(schema.invoices)
        .set({ status, ...(status === "paid" ? { paidAt } : {}) })
        .where(eq(schema.invoices.id, inv.id));
    }
    return { kind: "ok", inv, inst, status };
  }));

  if (outcome.kind === "err")
    return { ok: false, error: outcome.error, alreadyPaid: outcome.alreadyPaid, existing: outcome.existing };

  const { inv, inst, status } = outcome;
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, inv.projectId) });
  const s = await getSettings();
  const label = `${inst.label} ${money(inst.amountCents)}`;
  await afterCommit("payment: timeline", () =>
    logActivity({
      projectId: inv.projectId,
      contactId: project?.contactId ?? null,
      kind: "payment",
      title: `Payment received: ${label}`,
      body: [`via ${p.method}`, reference && `ref ${reference}`, `invoice ${inv.number}`, status === "paid" ? "paid in full" : ""]
        .filter(Boolean)
        .join(" · "),
      meta: { installmentId: inst.id, invoiceId: inv.id, method: p.method, reference },
    }),
  );

  await fireTrigger("payment_received", inv.projectId, {
    subjectKey: inst.id,
    extra: {
      payment_amount: money(inst.amountCents),
      payment_label: inst.label,
      invoice_link: project ? `${siteUrl()}/c/${project.portalToken}/invoice/${inv.token}` : "",
    },
  });

  if (project && OPEN_LEAD_STAGES.includes(project.stage)) {
    await afterCommit("payment: book", () =>
      moveStage(project.id, "booked", { by: "system", reason: `${inst.label} received` }),
    );
  }

  const to = notifyAddress(s);
  if (to && s.notifications.notifyOnPayment) {
    await afterCommit("payment: notify studio", () => sendEmail({
      to,
      subject: `✦ Payment received — ${money(inst.amountCents)} · ${project?.title ?? inv.title}`,
      body: [
        `${inst.label} of ${money(inst.amountCents)} was received via ${p.method}${reference ? ` (ref ${reference})` : ""}.`,
        `Invoice ${inv.number} is now ${status === "paid" ? "paid in full" : "partially paid"}.`,
        "",
        `${siteUrl()}/studio/invoices/${inv.id}`,
      ].join("\n"),
      logToTimeline: false,
    }));
  }

  return { ok: true, installmentId: inst.id, invoiceId: inv.id, invoiceStatus: status, projectId: inv.projectId };
}

/* ───────────────────────── small readers ───────────────────────── */
export async function installmentsFor(invoiceId: string) {
  return db.query.installments.findMany({
    where: eq(schema.installments.invoiceId, invoiceId),
    orderBy: [asc(schema.installments.sort), asc(schema.installments.dueDate)],
  });
}
