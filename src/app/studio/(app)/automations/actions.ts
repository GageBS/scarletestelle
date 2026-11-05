"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { runTimedAutomations, type RunReport } from "@/lib/automations";
import {
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
  PROJECT_TYPES,
  STAGES,
  type AutomationAction,
  type AutomationTrigger,
  type ProjectType,
  type Stage,
} from "@/lib/constants";

const BASE = "/studio/automations";
const msg = (kind: "ok" | "err", text: string) => `${kind}=${encodeURIComponent(text)}`;

const triggers = AUTOMATION_TRIGGERS.map((t) => t.value) as [AutomationTrigger, ...AutomationTrigger[]];
const actions = AUTOMATION_ACTIONS.map((a) => a.value) as [AutomationAction, ...AutomationAction[]];
const stages = STAGES.map((s) => s.value) as [Stage, ...Stage[]];
const types = PROJECT_TYPES.map((t) => t.value) as [ProjectType, ...ProjectType[]];

const schemaIn = z.object({
  name: z.string().trim().min(1, "Give the automation a name").max(160),
  trigger: z.enum(triggers),
  offsetDays: z.coerce.number().int().min(0).max(1000).default(0),
  stage: z.enum(stages).optional().or(z.literal("")),
  action: z.enum(actions),
  emailTemplateId: z.string().optional(),
  questionnaireTemplateId: z.string().optional(),
  taskTitle: z.string().trim().max(300).optional(),
  toStage: z.enum(stages).optional().or(z.literal("")),
});

export async function saveAutomation(formData: FormData) {
  await requireStudio();
  const id = String(formData.get("id") ?? "new");
  const back = `${BASE}/${id}`;
  const p = schemaIn.safeParse(Object.fromEntries(formData));
  if (!p.success) return redirect(`${back}?${msg("err", p.error.issues[0]?.message ?? "Check the form")}`);
  const v = p.data;
  const def = AUTOMATION_TRIGGERS.find((t) => t.value === v.trigger)!;
  if (v.trigger === "stage_changed" && !v.stage)
    return redirect(`${back}?${msg("err", "Choose which stage this runs for")}`);
  if (v.action === "send_email" && !v.emailTemplateId)
    return redirect(`${back}?${msg("err", "Choose an email template to send")}`);
  if (v.action === "send_questionnaire" && !v.questionnaireTemplateId)
    return redirect(`${back}?${msg("err", "Choose a questionnaire to send")}`);
  if (v.action === "create_task" && !v.taskTitle)
    return redirect(`${back}?${msg("err", "Write the to-do title")}`);
  if (v.action === "move_stage" && !v.toStage)
    return redirect(`${back}?${msg("err", "Choose the stage to move to")}`);
  if (v.trigger === "stage_changed" && v.action === "move_stage" && v.stage === v.toStage)
    return redirect(`${back}?${msg("err", "That would move the project to the stage it is already in")}`);

  const projectTypes = formData
    .getAll("projectTypes")
    .map(String)
    .filter((t): t is ProjectType => (types as string[]).includes(t));
  const row = {
    name: v.name,
    trigger: v.trigger,
    offsetDays: def.timed ? v.offsetDays : 0,
    projectTypes,
    stage: v.trigger === "stage_changed" ? ((v.stage || null) as Stage | null) : null,
    action: v.action,
    emailTemplateId:
      v.action === "send_email" || v.action === "send_questionnaire" ? v.emailTemplateId || null : null,
    questionnaireTemplateId: v.action === "send_questionnaire" ? v.questionnaireTemplateId || null : null,
    taskTitle: v.action === "create_task" ? v.taskTitle || null : null,
    toStage: v.action === "move_stage" ? ((v.toStage || null) as Stage | null) : null,
    active: formData.get("active") === "on",
  };
  if (id === "new") {
    const nid = newId();
    await db.insert(schema.automations).values({ id: nid, ...row });
    revalidatePath(BASE);
    redirect(`${BASE}?${msg("ok", `Created “${v.name}”.`)}`);
  }
  await db.update(schema.automations).set(row).where(eq(schema.automations.id, id));
  revalidatePath(BASE);
  redirect(`${BASE}?${msg("ok", `Saved “${v.name}”.`)}`);
}

export async function toggleAutomation(formData: FormData) {
  await requireStudio();
  const id = String(formData.get("id") ?? "");
  const a = await db.query.automations.findFirst({ where: eq(schema.automations.id, id) });
  if (a) await db.update(schema.automations).set({ active: !a.active }).where(eq(schema.automations.id, id));
  revalidatePath(BASE);
}

export async function deleteAutomation(formData: FormData) {
  await requireStudio();
  await db.delete(schema.automations).where(eq(schema.automations.id, String(formData.get("id") ?? "")));
  revalidatePath(BASE);
  redirect(`${BASE}?${msg("ok", "Automation deleted.")}`);
}

export type RunNowState = { ran: boolean; report: RunReport[]; error?: string } | null;

export async function runNowAction(): Promise<RunNowState> {
  await requireStudio();
  try {
    const report = await runTimedAutomations();
    revalidatePath(BASE);
    return { ran: true, report };
  } catch (e) {
    return { ran: true, report: [], error: e instanceof Error ? e.message : String(e) };
  }
}
