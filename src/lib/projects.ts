import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity } from "@/lib/activity";
import { stageLabel, type Stage } from "@/lib/constants";
import { fireTrigger } from "@/lib/automations";

/**
 * The ONE way to change a project's stage: records the timeline entry,
 * stamps bookedAt / deliveredAt, and fires the `stage_changed` automations.
 */
export async function moveStage(
  projectId: string,
  stage: Stage,
  opts: { reason?: string; by?: "studio" | "automation" | "client" | "system" } = {},
) {
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!p || p.stage === stage) return p;
  const now = new Date();
  await db
    .update(schema.projects)
    .set({
      stage,
      stageChangedAt: now,
      ...(stage === "booked" && !p.bookedAt ? { bookedAt: now } : {}),
      ...(stage === "delivered" && !p.deliveredAt ? { deliveredAt: now } : {}),
      ...(stage === "lost" && opts.reason ? { lostReason: opts.reason } : {}),
    })
    .where(eq(schema.projects.id, projectId));
  await logActivity({
    projectId,
    contactId: p.contactId,
    kind: "stage",
    title: `Moved to ${stageLabel(stage)}`,
    body: opts.reason ?? "",
    meta: { from: p.stage, to: stage, by: opts.by ?? "studio" },
  });
  await fireTrigger("stage_changed", projectId, { stage, subjectKey: `stage:${stage}` });
  return { ...p, stage };
}
