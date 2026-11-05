"use client";
import { useState } from "react";
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
import { Checkbox, Field, Input, Select } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";

export type AutoInit = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  offsetDays: number;
  projectTypes: ProjectType[];
  stage: Stage | null;
  action: AutomationAction;
  emailTemplateId: string | null;
  questionnaireTemplateId: string | null;
  taskTitle: string | null;
  toStage: Stage | null;
  active: boolean;
};

const DAYS_LABEL: Partial<Record<AutomationTrigger, { label: string; hint: string }>> = {
  before_event: { label: "Days before the session", hint: "e.g. 7 = one week before the session or wedding day" },
  after_event: { label: "Days after the session", hint: "e.g. 1 = the day after the session or wedding" },
  after_delivery: { label: "Days after the gallery is delivered", hint: "e.g. 14 = two weeks after delivery" },
  proposal_unaccepted: {
    label: "Days after the proposal was sent (still unsigned)",
    hint: "e.g. 3 = three days after sending, if it hasn't been signed",
  },
  installment_due: { label: "Days before a payment is due", hint: "e.g. 3 = three days before the due date" },
};

export function AutomationForm({
  init,
  emailTemplates,
  questionnaireTemplates,
  save,
}: {
  init: AutoInit;
  emailTemplates: { id: string; name: string }[];
  questionnaireTemplates: { id: string; name: string }[];
  save: (fd: FormData) => Promise<void>;
}) {
  const [trigger, setTrigger] = useState<AutomationTrigger>(init.trigger);
  const [action, setAction] = useState<AutomationAction>(init.action);
  const timed = AUTOMATION_TRIGGERS.find((t) => t.value === trigger)?.timed ?? false;
  const days = DAYS_LABEL[trigger];

  return (
    <form action={save} className="space-y-6">
      <input type="hidden" name="id" value={init.id} />
      <Field label="Name (just for you)">
        <Input name="name" required defaultValue={init.name} placeholder="Session prep guide, 7 days before" />
      </Field>

      <fieldset className="space-y-4 rounded-sm border border-rule p-4">
        <legend className="label px-2 text-ink">When this happens…</legend>
        <Field label="Trigger">
          <Select name="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}>
            {AUTOMATION_TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.timed ? `⏱ ${t.label}` : t.label}
              </option>
            ))}
          </Select>
        </Field>
        {timed && days && (
          <Field label={days.label} hint={days.hint} className="max-w-xs">
            <Input name="offsetDays" type="number" inputMode="numeric" min={0} required defaultValue={init.offsetDays} />
          </Field>
        )}
        {trigger === "stage_changed" && (
          <Field label="…the project moves to this stage" className="max-w-xs">
            <Select name="stage" defaultValue={init.stage ?? ""} required>
              <option value="" disabled>
                Choose a stage…
              </option>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div>
          <p className="label mb-1.5 text-ink-soft">Only for these project types</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {PROJECT_TYPES.map((t) => (
              <span key={t.value} className="min-h-9 py-1">
                <Checkbox
                  name="projectTypes"
                  value={t.value}
                  defaultChecked={init.projectTypes.includes(t.value)}
                  label={t.label}
                />
              </span>
            ))}
          </div>
          <p className="mt-1 font-sans text-xs text-muted">Leave all unchecked to run for every project type.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-sm border border-rule p-4">
        <legend className="label px-2 text-ink">…do this</legend>
        <Field label="Action">
          <Select name="action" value={action} onChange={(e) => setAction(e.target.value as AutomationAction)}>
            {AUTOMATION_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        {action === "send_email" && (
          <Field label="Email template">
            <Select name="emailTemplateId" defaultValue={init.emailTemplateId ?? ""} required>
              <option value="" disabled>
                Choose a template…
              </option>
              {emailTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {action === "send_questionnaire" && (
          <>
            <Field label="Questionnaire">
              <Select name="questionnaireTemplateId" defaultValue={init.questionnaireTemplateId ?? ""} required>
                <option value="" disabled>
                  Choose a questionnaire…
                </option>
                {questionnaireTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Email to send it with (optional)" hint="The questionnaire link is added automatically.">
              <Select name="emailTemplateId" defaultValue={init.emailTemplateId ?? ""}>
                <option value="">Standard note</option>
                {emailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {action === "create_task" && (
          <Field label="To-do title" hint="Merge fields work here, e.g. Finalize timeline with {{couple_names}}">
            <Input name="taskTitle" required defaultValue={init.taskTitle ?? ""} />
          </Field>
        )}
        {action === "move_stage" && (
          <Field label="Move the project to" className="max-w-xs">
            <Select name="toStage" defaultValue={init.toStage ?? ""} required>
              <option value="" disabled>
                Choose a stage…
              </option>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </fieldset>

      <Checkbox name="active" label="Turned on" defaultChecked={init.active} />
      <div>
        <SubmitButton>{init.id === "new" ? "Create automation" : "Save automation"}</SubmitButton>
      </div>
    </form>
  );
}
