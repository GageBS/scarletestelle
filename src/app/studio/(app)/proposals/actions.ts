"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId, newToken } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { fireTrigger } from "@/lib/automations";
import { sendEmail } from "@/lib/email";
import { buildMergeContext, renderTemplate } from "@/lib/merge";
import { moveStage } from "@/lib/projects";
import { getSettings, siteUrl } from "@/lib/settings";
import { parseMoney, todayIn } from "@/lib/format";
import { percentToBps, SELECTION_MERGE_KEYS, fillFields } from "@/lib/billing-math";
import { contractPreMerge } from "@/lib/billing";
import type { PaymentPlan, Stage } from "@/lib/constants";
import { DEFAULT_PROPOSAL_BODY, DEFAULT_PROPOSAL_SUBJECT } from "./defaults";

export type FormState = { error?: string };

const EARLY_STAGES: Stage[] = ["inquiry", "follow_up", "consultation"];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date.");
const num = (lo: number, hi: number, msg: string) =>
  z.coerce.number({ error: msg }).refine((n) => Number.isFinite(n) && n >= lo && n <= hi, msg);

const input = z.object({
  id: z.string().max(64).optional(),
  projectId: z.string().min(1, "Choose a project."),
  intent: z.enum(["save", "send"]),
  title: z.string().trim().min(1, "Give the proposal a title.").max(160),
  message: z.string().trim().max(5000),
  packageIds: z.array(z.string().max(64)).max(3, "Offer at most three collections."),
  addonIds: z.array(z.string().max(64)).max(30),
  contractTemplateId: z.string().max(64),
  planKind: z.enum(["full", "retainer", "installments"]),
  fullDueDays: num(0, 365, "Days after signing must be 0–365."),
  retainerPercent: num(0, 100, "Retainer must be 0–100%."),
  balanceDays: num(0, 730, "Balance days must be 0–730."),
  instCount: num(2, 24, "Number of payments must be 2–24."),
  instFirstPercent: num(0, 100, "First payment must be 0–100%."),
  instFinalDays: num(0, 730, "Final payment days must be 0–730."),
  taxPercent: z.string().max(12),
  discount: z.string().max(20),
  expiresOn: day.or(z.literal("")),
  emailSubject: z.string().trim().max(300),
  emailBody: z.string().trim().max(10000),
});

export async function saveProposal(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const parsed = input.safeParse({
    id: (fd.get("id") as string) || undefined,
    projectId: fd.get("projectId") ?? "",
    intent: fd.get("intent") === "send" ? "send" : "save",
    title: fd.get("title") ?? "",
    message: fd.get("message") ?? "",
    packageIds: fd.getAll("packageIds").map(String).filter(Boolean),
    addonIds: fd.getAll("addonIds").map(String).filter(Boolean),
    contractTemplateId: fd.get("contractTemplateId") ?? "",
    planKind: fd.get("planKind") ?? "retainer",
    fullDueDays: fd.get("fullDueDays") || 0,
    retainerPercent: fd.get("retainerPercent") || 0,
    balanceDays: fd.get("balanceDays") || 0,
    instCount: fd.get("instCount") || 3,
    instFirstPercent: fd.get("instFirstPercent") || 0,
    instFinalDays: fd.get("instFinalDays") || 0,
    taxPercent: fd.get("taxPercent") ?? "",
    discount: fd.get("discount") ?? "",
    expiresOn: fd.get("expiresOn") ?? "",
    emailSubject: fd.get("emailSubject") ?? "",
    emailBody: fd.get("emailBody") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const v = parsed.data;

  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, v.projectId) });
  if (!project) return { error: "That project no longer exists." };
  const taxRateBps = percentToBps(v.taxPercent);
  if (taxRateBps == null) return { error: "Tax must be a percentage between 0 and 100." };
  const discountCents = v.discount.trim() ? parseMoney(v.discount) : 0;
  if (discountCents == null || discountCents < 0) return { error: "Enter the discount as an amount, like 250." };

  const packageIds = [...new Set(v.packageIds)];
  const addonIds = [...new Set(v.addonIds)];
  const rows = packageIds.length + addonIds.length
    ? await db.query.packages.findMany({ where: inArray(schema.packages.id, [...packageIds, ...addonIds]) })
    : [];
  if (packageIds.some((id) => !rows.find((r) => r.id === id && !r.isAddon)))
    return { error: "One of the collections no longer exists." };
  if (addonIds.some((id) => !rows.find((r) => r.id === id && r.isAddon)))
    return { error: "One of the add-ons no longer exists." };
  const template = v.contractTemplateId
    ? await db.query.contractTemplates.findFirst({ where: eq(schema.contractTemplates.id, v.contractTemplateId) })
    : undefined;
  if (v.contractTemplateId && !template) return { error: "That contract template no longer exists." };

  const plan: PaymentPlan =
    v.planKind === "full"
      ? { kind: "full", dueDaysAfterSigning: Math.round(v.fullDueDays) }
      : v.planKind === "retainer"
        ? {
            kind: "retainer",
            retainerPercent: Math.round(v.retainerPercent * 100) / 100,
            balanceDueDaysBeforeEvent: Math.round(v.balanceDays),
          }
        : {
            kind: "installments",
            count: Math.round(v.instCount),
            firstPercent: Math.round(v.instFirstPercent * 100) / 100,
            finalDueDaysBeforeEvent: Math.round(v.instFinalDays),
          };

  const s = await getSettings();
  const today = todayIn(s.business.timezone);
  if (v.intent === "send") {
    if (packageIds.length === 0) return { error: "Choose at least one collection before sending." };
    if (!template) return { error: "Choose a contract template before sending." };
    if (v.expiresOn && v.expiresOn < today) return { error: "The expiry date is in the past." };
    // the client must never sign a contract with a literal {{field}} in it
    const placeholder = Object.fromEntries(SELECTION_MERGE_KEYS.map((k) => [k, "·"]));
    const merged = fillFields(await contractPreMerge(project.id, template.body), placeholder);
    const left = [...new Set([...merged.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]))];
    if (left.length)
      return {
        error: `The contract has merge fields with no value for this project: ${left
          .map((f) => `{{${f}}}`)
          .join(", ")}. Fix the template in Contracts (or fill in the project details) before sending.`,
      };
  }

  const values = {
    projectId: project.id,
    title: v.title,
    message: v.message,
    packageIds,
    addonIds,
    contractTemplateId: template?.id ?? null,
    paymentPlan: plan,
    taxRateBps,
    discountCents,
    expiresOn: v.expiresOn || null,
  };

  let id = v.id;
  let token: string;
  if (id) {
    const existing = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
    if (!existing) return { error: "That proposal no longer exists." };
    if (existing.status !== "draft" && existing.status !== "sent")
      return { error: `This proposal is ${existing.status} and can no longer be edited.` };
    const r = await db
      .update(schema.proposals)
      .set(values)
      .where(and(eq(schema.proposals.id, id), inArray(schema.proposals.status, ["draft", "sent"])))
      .returning({ id: schema.proposals.id });
    if (!r.length) return { error: "The client opened this proposal a moment ago, so it can no longer be edited." };
    token = existing.token;
  } else {
    id = newId();
    token = newToken();
    await db.insert(schema.proposals).values({ id, token, status: "draft", ...values });
    await logActivity({
      projectId: project.id,
      contactId: project.contactId,
      kind: "proposal",
      title: `Proposal drafted: ${v.title}`,
      meta: { proposalId: id },
    });
  }

  let notice = "saved";
  if (v.intent === "send") {
    const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, project.contactId) });
    const link = `${siteUrl()}/c/${project.portalToken}/proposal/${token}`;
    const ctx = await buildMergeContext(project.id, { proposal_link: link, proposal_title: v.title });
    let body = v.emailBody || DEFAULT_PROPOSAL_BODY;
    if (!body.includes("{{proposal_link}}") && !body.includes(link)) body += "\n\n{{proposal_link}}";
    const mail = await sendEmail({
      to: contact?.email ?? "",
      subject: renderTemplate(v.emailSubject || DEFAULT_PROPOSAL_SUBJECT, ctx),
      body: renderTemplate(body, ctx),
      projectId: project.id,
      contactId: project.contactId,
    });
    await db
      .update(schema.proposals)
      .set({ status: "sent", sentAt: new Date() })
      .where(and(eq(schema.proposals.id, id), inArray(schema.proposals.status, ["draft", "sent"])));
    await logActivity({
      projectId: project.id,
      contactId: project.contactId,
      kind: "proposal",
      title: `Proposal sent: ${v.title}`,
      body: mail.status === "sent" ? `Emailed to ${contact?.email}` : `Email ${mail.status}${mail.error ? `: ${mail.error}` : ""}`,
      meta: { proposalId: id, messageId: mail.id },
    });
    await fireTrigger("proposal_sent", project.id, { subjectKey: id });
    if (EARLY_STAGES.includes(project.stage))
      await moveStage(project.id, "proposal_sent", { by: "studio", reason: "Proposal sent" });
    notice = `sent-${mail.status}`;
  }

  revalidatePath("/studio/proposals");
  revalidatePath(`/c/${project.portalToken}`, "layout");
  redirect(`/studio/proposals/${id}?notice=${notice}`);
}

export async function voidProposal(id: string) {
  await requireStudio();
  const r = await db
    .update(schema.proposals)
    .set({ status: "void" })
    .where(and(eq(schema.proposals.id, id), ne(schema.proposals.status, "accepted")))
    .returning({ projectId: schema.proposals.projectId, title: schema.proposals.title });
  if (r.length) {
    const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, r[0].projectId) });
    await logActivity({
      projectId: r[0].projectId,
      contactId: p?.contactId ?? null,
      kind: "proposal",
      title: `Proposal voided: ${r[0].title}`,
      meta: { proposalId: id },
    });
    if (p) revalidatePath(`/c/${p.portalToken}`, "layout");
  }
  revalidatePath("/studio/proposals");
  redirect(`/studio/proposals/${id}?notice=${r.length ? "voided" : "cannot-void"}`);
}
