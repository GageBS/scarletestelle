import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { Card, LinkButton, Notice, PageHeader } from "@/components/studio/ui";
import { ConfirmButton } from "@/components/studio/client-ui";
import { deleteAutomation, saveAutomation } from "../actions";
import { AutomationForm, type AutoInit } from "./automation-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Automation" };

export default async function EditAutomation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  await requireStudio();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [emailTemplates, qTemplates] = await Promise.all([
    db.select({ id: schema.emailTemplates.id, name: schema.emailTemplates.name }).from(schema.emailTemplates).orderBy(asc(schema.emailTemplates.name)),
    db
      .select({ id: schema.questionnaireTemplates.id, name: schema.questionnaireTemplates.name })
      .from(schema.questionnaireTemplates)
      .orderBy(asc(schema.questionnaireTemplates.name)),
  ]);

  let init: AutoInit;
  if (id === "new") {
    init = {
      id: "new",
      name: "",
      trigger: "inquiry_received",
      offsetDays: 0,
      projectTypes: [],
      stage: null,
      action: "send_email",
      emailTemplateId: null,
      questionnaireTemplateId: null,
      taskTitle: null,
      toStage: null,
      active: true,
    };
  } else {
    const a = await db.query.automations.findFirst({ where: eq(schema.automations.id, id) });
    if (!a) notFound();
    init = a;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automations"
        title={id === "new" ? "New automation" : init.name}
        actions={
          <LinkButton href="/studio/automations" variant="ghost">
            ← All automations
          </LinkButton>
        }
      />
      {sp.err && <Notice tone="bad">{sp.err}</Notice>}
      <Card className="max-w-3xl">
        <AutomationForm
          // remount when switching between records so defaults reset
          key={id}
          init={init}
          emailTemplates={emailTemplates}
          questionnaireTemplates={qTemplates}
          save={saveAutomation}
        />
      </Card>
      {id !== "new" && (
        <form action={deleteAutomation}>
          <input type="hidden" name="id" value={id} />
          <ConfirmButton confirmText="Tap again to delete">Delete automation</ConfirmButton>
        </form>
      )}
    </div>
  );
}
