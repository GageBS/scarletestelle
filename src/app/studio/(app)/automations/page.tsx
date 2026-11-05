import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AUTOMATION_TRIGGERS, projectTypeLabel, stageLabel } from "@/lib/constants";
import { formatInstant } from "@/lib/format";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader, cx } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { toggleAutomation } from "./actions";
import { RunNow } from "./run-now";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Automations" };

type Auto = typeof schema.automations.$inferSelect;

function whenText(a: Auto) {
  const n = a.offsetDays;
  const d = `${n} day${n === 1 ? "" : "s"}`;
  switch (a.trigger) {
    case "before_event":
      return `${d} before the session`;
    case "after_event":
      return `${d} after the session`;
    case "after_delivery":
      return `${d} after the gallery is delivered`;
    case "proposal_unaccepted":
      return `${d} after a proposal is sent and still unsigned`;
    case "installment_due":
      return `${d} before a payment is due`;
    case "stage_changed":
      return `When a project moves to “${a.stage ? stageLabel(a.stage) : "?"}”`;
    default:
      return AUTOMATION_TRIGGERS.find((t) => t.value === a.trigger)?.label ?? a.trigger;
  }
}

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const tz = (await getSettings()).business.timezone;
  const [autos, emailT, qT, runs] = await Promise.all([
    db.query.automations.findMany({ orderBy: [desc(schema.automations.active), schema.automations.name] }),
    db.query.emailTemplates.findMany(),
    db.query.questionnaireTemplates.findMany(),
    db
      .select({ run: schema.automationRuns, auto: schema.automations, project: schema.projects })
      .from(schema.automationRuns)
      .innerJoin(schema.automations, eq(schema.automationRuns.automationId, schema.automations.id))
      .innerJoin(schema.projects, eq(schema.automationRuns.projectId, schema.projects.id))
      .orderBy(desc(schema.automationRuns.runAt))
      .limit(40),
  ]);
  const eName = new Map(emailT.map((t) => [t.id, t.name]));
  const qName = new Map(qT.map((t) => [t.id, t.name]));

  function doText(a: Auto) {
    switch (a.action) {
      case "send_email":
        return `Email “${(a.emailTemplateId && eName.get(a.emailTemplateId)) || "(template missing)"}”`;
      case "send_questionnaire":
        return `Send questionnaire “${(a.questionnaireTemplateId && qName.get(a.questionnaireTemplateId)) || "(missing)"}”`;
      case "create_task":
        return `Create to-do “${a.taskTitle}”`;
      case "move_stage":
        return `Move to “${a.toStage ? stageLabel(a.toStage) : "?"}”`;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow"
        title="Automations"
        description="Things that happen on their own — so nothing slips through the cracks."
        actions={<LinkButton href="/studio/automations/new">New automation</LinkButton>}
      />
      {sp.ok && <Notice tone="ok">{sp.ok}</Notice>}
      {sp.err && <Notice tone="bad">{sp.err}</Notice>}

      <Card title="Timed automations">
        <RunNow />
      </Card>

      <Card title="Your automations" pad={false}>
        {autos.length === 0 ? (
          <EmptyState title="Nothing automated yet">Create one, or run the seed to load the starter set.</EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {autos.map((a) => (
              <li key={a.id} className={cx("flex items-center gap-3 px-4 py-3 md:px-5", !a.active && "opacity-60")}>
                <Link href={`/studio/automations/${a.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-sm font-medium">{a.name}</span>
                  <span className="block font-sans text-xs text-ink-soft">
                    {whenText(a)} → {doText(a)}
                  </span>
                  <span className="block font-sans text-xs text-muted">
                    {a.projectTypes.length ? a.projectTypes.map(projectTypeLabel).join(", ") : "All project types"}
                  </span>
                </Link>
                <form action={toggleAutomation}>
                  <input type="hidden" name="id" value={a.id} />
                  <SubmitButton
                    variant={a.active ? "secondary" : "ghost"}
                    pendingText="…"
                    aria-label={a.active ? "Turn off" : "Turn on"}
                    className="min-w-16"
                  >
                    {a.active ? "On" : "Off"}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recent runs" pad={false}>
        {runs.length === 0 ? (
          <EmptyState title="No runs yet">Runs will be listed here as they happen.</EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {runs.map(({ run, auto, project }) => (
              <li key={run.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                <Badge tone={run.status === "done" ? "ok" : run.status === "failed" ? "bad" : "muted"}>
                  {run.status}
                </Badge>
                <div className="min-w-0 flex-1 font-sans text-sm">
                  <p className="truncate">
                    {auto.name} ·{" "}
                    <Link href={`/studio/projects/${project.id}`} className="underline underline-offset-2">
                      {project.title}
                    </Link>
                  </p>
                  <p className="break-words text-xs text-muted">
                    {run.detail || "—"} · {formatInstant(run.runAt, tz)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
