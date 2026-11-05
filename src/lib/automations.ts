/**
 * Automation engine (HoneyBook-style workflows).
 *
 *  fireTrigger(trigger, projectId)   — call right after an event happens
 *     (inquiry_received, proposal_sent, proposal_accepted, payment_received,
 *      questionnaire_submitted, stage_changed)
 *  runTimedAutomations()             — call once a day (cron / "Run now" button)
 *     (before_event, after_event, after_delivery, proposal_unaccepted, installment_due)
 *
 * Each automation runs at most ONCE per (automation, project, subjectKey) — enforced by
 * the unique index on automation_runs — so re-running is always safe. Exceptions, so nothing
 * is silently lost: a run that FAILED is retried the next time it is triggered / swept, and a
 * run whose email was only saved (email not connected → status "skipped") is retried once
 * email is connected (timed automations retry while still inside their window).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId } from "@/lib/ids";
import { emailConfigured, sendEmail } from "@/lib/email";
import { buildMergeContext, renderTemplate } from "@/lib/merge";
import { logActivity } from "@/lib/activity";
import { getSettings, siteUrl } from "@/lib/settings";
import { addDays, formatDay, money, todayIn } from "@/lib/format";
import { BOOKED_STAGES, type AutomationTrigger, type Stage } from "@/lib/constants";
import { createQuestionnaireFromTemplate } from "@/lib/questionnaires";

type Automation = typeof schema.automations.$inferSelect;
type Project = typeof schema.projects.$inferSelect;

const CATCH_UP_DAYS = 3; // timed automations still fire if the daily run was missed

export type RunReport = { automation: string; project: string; status: string; detail: string };

/** Claim the (automation, project, subject) slot. null = already ran (or not retryable). */
async function claim(a: Automation, projectId: string, subjectKey: string) {
  const res = await db
    .insert(schema.automationRuns)
    .values({ id: newId(), automationId: a.id, projectId, subjectKey, status: "done" })
    .onConflictDoNothing()
    .returning({ id: schema.automationRuns.id });
  if (res[0]) return res[0].id;
  const prev = await db.query.automationRuns.findFirst({
    where: and(
      eq(schema.automationRuns.automationId, a.id),
      eq(schema.automationRuns.projectId, projectId),
      eq(schema.automationRuns.subjectKey, subjectKey),
    ),
  });
  if (!prev) return null;
  const retryable = prev.status === "failed" || (prev.status === "skipped" && emailConfigured());
  if (!retryable) return null;
  // flip atomically so two overlapping sweeps can't both retry the same run
  const upd = await db
    .update(schema.automationRuns)
    .set({ status: "done", detail: "retrying…", runAt: new Date() })
    .where(and(eq(schema.automationRuns.id, prev.id), eq(schema.automationRuns.status, prev.status)))
    .returning({ id: schema.automationRuns.id });
  return upd[0]?.id ?? null;
}

const UNFILLED = /\{\{\s*([a-z_]+)\s*\}\}/g;
/** Refuse to send a client anything with a literal {{field}} left in it. */
function assertFilled(...texts: string[]) {
  const left = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(UNFILLED)) left.add(m[1]);
  if (left.size)
    throw new Error(
      `Not sent — these merge fields have no value here: ${[...left].map((f) => `{{${f}}}`).join(", ")}. Edit the template or the automation.`,
    );
}

async function finish(runId: string, status: "done" | "failed" | "skipped", detail: string) {
  await db
    .update(schema.automationRuns)
    .set({ status, detail })
    .where(eq(schema.automationRuns.id, runId));
}

function appliesTo(a: Automation, p: Project) {
  return a.projectTypes.length === 0 || a.projectTypes.includes(p.type);
}

const DEFAULT_Q_SUBJECT = "A few questions before your session — {{questionnaire_title}}";
const DEFAULT_Q_BODY =
  "Hi {{client_first_name}},\n\nSo I can plan every detail with you, please fill out this short questionnaire when you have a moment:\n\n{{questionnaire_link}}\n\nWith love,\n{{photographer_name}}";

async function execute(
  a: Automation,
  p: Project,
  subjectKey: string,
  extra: Record<string, string> = {},
): Promise<RunReport | null> {
  const runId = await claim(a, p.id, subjectKey);
  if (!runId) return null; // already ran
  try {
    const contact = await db.query.contacts.findFirst({
      where: eq(schema.contacts.id, p.contactId),
    });
    let detail = "";
    let outcome: "done" | "skipped" = "done";
    switch (a.action) {
      case "send_email": {
        if (!a.emailTemplateId) throw new Error("No email template chosen");
        const t = await db.query.emailTemplates.findFirst({
          where: eq(schema.emailTemplates.id, a.emailTemplateId),
        });
        if (!t) throw new Error("Email template was deleted");
        const ctx = await buildMergeContext(p.id, extra);
        const subject = renderTemplate(t.subject, ctx);
        const body = renderTemplate(t.body, ctx);
        assertFilled(subject, body);
        const r = await sendEmail({
          to: contact?.email ?? "",
          subject,
          body,
          projectId: p.id,
          contactId: p.contactId,
          automationId: a.id,
        });
        if (r.status === "failed") throw new Error(r.error ?? "email failed");
        if (r.status === "logged") outcome = "skipped";
        detail = r.status === "logged" ? `saved to Outbox (email not connected): ${t.name}` : `email sent: ${t.name}`;
        break;
      }
      case "send_questionnaire": {
        if (!a.questionnaireTemplateId) throw new Error("No questionnaire chosen");
        // on a retry, reuse the copy already created rather than sending a second one
        const existingQ = await db.query.questionnaires.findFirst({
          where: and(
            eq(schema.questionnaires.projectId, p.id),
            eq(schema.questionnaires.templateId, a.questionnaireTemplateId),
            eq(schema.questionnaires.status, "sent"),
          ),
        });
        const q = existingQ ?? (await createQuestionnaireFromTemplate(p.id, a.questionnaireTemplateId));
        const link = `${siteUrl()}/c/${p.portalToken}/questionnaire/${q.token}`;
        const ctx = await buildMergeContext(p.id, {
          ...extra,
          questionnaire_link: link,
          questionnaire_title: q.title,
        });
        let subject = DEFAULT_Q_SUBJECT;
        let body = DEFAULT_Q_BODY;
        if (a.emailTemplateId) {
          const t = await db.query.emailTemplates.findFirst({
            where: eq(schema.emailTemplates.id, a.emailTemplateId),
          });
          if (t) {
            subject = t.subject;
            body = t.body.includes("{{questionnaire_link}}")
              ? t.body
              : `${t.body}\n\n{{questionnaire_link}}`;
          }
        }
        const subj = renderTemplate(subject, ctx);
        const text = renderTemplate(body, ctx);
        assertFilled(subj, text);
        const r = await sendEmail({
          to: contact?.email ?? "",
          subject: subj,
          body: text,
          projectId: p.id,
          contactId: p.contactId,
          automationId: a.id,
        });
        if (r.status === "failed") throw new Error(r.error ?? "email failed");
        if (r.status === "logged") outcome = "skipped";
        detail = `questionnaire ready (${q.title}); email ${r.status === "logged" ? "saved to Outbox — email not connected" : "sent"}`;
        break;
      }
      case "create_task": {
        const ctx = await buildMergeContext(p.id, extra);
        const s = await getSettings();
        await db.insert(schema.tasks).values({
          id: newId(),
          projectId: p.id,
          title: renderTemplate(a.taskTitle || a.name, ctx),
          dueDate: todayIn(s.business.timezone),
          source: "automation",
        });
        detail = "to-do created";
        break;
      }
      case "move_stage": {
        if (!a.toStage) throw new Error("No stage chosen");
        // dynamic import avoids a module cycle (projects → automations → projects)
        const { moveStage } = await import("@/lib/projects");
        await moveStage(p.id, a.toStage, { by: "automation" });
        detail = `moved to ${a.toStage}`;
        break;
      }
    }
    await finish(runId, outcome, detail);
    await logActivity({
      projectId: p.id,
      contactId: p.contactId,
      kind: "automation",
      title: outcome === "skipped" ? `Automation saved (email not connected): ${a.name}` : `Automation ran: ${a.name}`,
      body: detail,
      meta: { automationId: a.id },
    });
    return { automation: a.name, project: p.title, status: outcome, detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finish(runId, "failed", msg);
    await logActivity({
      projectId: p.id,
      contactId: p.contactId,
      kind: "automation",
      title: `Automation FAILED: ${a.name}`,
      body: msg,
      meta: { automationId: a.id },
    });
    return { automation: a.name, project: p.title, status: "failed", detail: msg };
  }
}

/** Event-driven automations. Never throws — failures are recorded on the timeline. */
export async function fireTrigger(
  trigger: AutomationTrigger,
  projectId: string,
  opts: { stage?: Stage; subjectKey?: string; extra?: Record<string, string> } = {},
): Promise<RunReport[]> {
  try {
    const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
    if (!p || p.archived) return [];
    const list = await db.query.automations.findMany({
      where: and(eq(schema.automations.active, true), eq(schema.automations.trigger, trigger)),
    });
    const out: RunReport[] = [];
    for (const a of list) {
      if (!appliesTo(a, p)) continue;
      if (trigger === "stage_changed" && a.stage && a.stage !== opts.stage) continue;
      const r = await execute(a, p, opts.subjectKey ?? "", opts.extra);
      if (r) out.push(r);
    }
    return out;
  } catch (e) {
    console.error("[automations] fireTrigger failed", trigger, projectId, e);
    return [];
  }
}

const inWindow = (today: string, target: string) =>
  today >= target && today <= addDays(target, CATCH_UP_DAYS);

/** Daily sweep for time-based automations. Safe to run many times a day. */
export async function runTimedAutomations(now = new Date()): Promise<RunReport[]> {
  const s = await getSettings();
  const today = todayIn(s.business.timezone, now);
  const autos = await db.query.automations.findMany({
    where: and(
      eq(schema.automations.active, true),
      inArray(schema.automations.trigger, [
        "before_event",
        "after_event",
        "after_delivery",
        "proposal_unaccepted",
        "installment_due",
      ]),
    ),
  });
  if (autos.length === 0) return [];
  const projects = await db.query.projects.findMany({
    where: eq(schema.projects.archived, false),
  });
  const byId = new Map(projects.map((p) => [p.id, p]));
  const out: RunReport[] = [];
  const push = (r: RunReport | null) => {
    if (r) out.push(r);
  };

  for (const a of autos) {
    if (a.trigger === "before_event" || a.trigger === "after_event") {
      for (const p of projects) {
        if (!p.eventDate || !appliesTo(a, p) || !BOOKED_STAGES.includes(p.stage)) continue;
        const target =
          a.trigger === "before_event"
            ? addDays(p.eventDate, -a.offsetDays)
            : addDays(p.eventDate, a.offsetDays);
        const due =
          a.trigger === "before_event"
            ? today >= target && today <= p.eventDate
            : inWindow(today, target);
        if (due) push(await execute(a, p, `event:${p.eventDate}`));
      }
    } else if (a.trigger === "after_delivery") {
      for (const p of projects) {
        if (!p.deliveredAt || !appliesTo(a, p)) continue;
        const d = todayIn(s.business.timezone, p.deliveredAt);
        if (inWindow(today, addDays(d, a.offsetDays))) push(await execute(a, p, `delivered:${d}`));
      }
    } else if (a.trigger === "proposal_unaccepted") {
      const props = await db.query.proposals.findMany({
        where: inArray(schema.proposals.status, ["sent", "viewed"]),
      });
      for (const pr of props) {
        const p = byId.get(pr.projectId);
        if (!p || !pr.sentAt || !appliesTo(a, p) || p.stage === "lost") continue;
        const sent = todayIn(s.business.timezone, pr.sentAt);
        if (inWindow(today, addDays(sent, a.offsetDays)))
          push(await execute(a, p, `proposal:${pr.id}`));
      }
    } else if (a.trigger === "installment_due") {
      const rows = await db
        .select({ inst: schema.installments, inv: schema.invoices })
        .from(schema.installments)
        .innerJoin(schema.invoices, eq(schema.installments.invoiceId, schema.invoices.id))
        .where(
          and(
            eq(schema.installments.status, "due"),
            inArray(schema.invoices.status, ["sent", "partial"]),
          ),
        );
      for (const { inst, inv } of rows) {
        const p = byId.get(inv.projectId);
        if (!p || !appliesTo(a, p)) continue;
        const target = addDays(inst.dueDate, -a.offsetDays);
        if (today >= target && today <= inst.dueDate) {
          push(
            await execute(a, p, `installment:${inst.id}`, {
              payment_amount: money(inst.amountCents),
              payment_label: inst.label,
              payment_due_date: formatDay(inst.dueDate, "long"),
              invoice_link: `${siteUrl()}/c/${p.portalToken}/invoice/${inv.token}`,
            }),
          );
        }
      }
    }
  }
  return out;
}
