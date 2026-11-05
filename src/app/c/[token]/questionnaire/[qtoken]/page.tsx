import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { formatInstant } from "@/lib/format";
import { QuestionnaireForm } from "./questionnaire-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Questionnaire",
  robots: { index: false, follow: false },
};

export default async function ClientQuestionnaire({
  params,
}: {
  params: Promise<{ token: string; qtoken: string }>;
}) {
  const { token, qtoken } = await params;
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.portalToken, token) });
  if (!project) notFound();
  const q = await db.query.questionnaires.findFirst({
    where: and(eq(schema.questionnaires.token, qtoken), eq(schema.questionnaires.projectId, project.id)),
  });
  if (!q) notFound();
  const s = await getSettings();

  return (
    <div className="bg-parchment px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-10 text-ink sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <p className="label text-muted">{s.business.name}</p>
          <h1 className="display mt-3 text-[2rem] leading-tight sm:text-5xl">{q.title}</h1>
          <p className="script inked mt-2 text-4xl text-scarlet sm:text-5xl">
            {q.status === "submitted" ? "thank you" : "tell me everything"}
          </p>
          {q.intro && q.status !== "submitted" && (
            <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-[1.08rem] leading-relaxed text-ink-soft">
              {q.intro}
            </p>
          )}
        </header>

        {q.status === "submitted" ? (
          <div className="mt-10">
            <p className="mb-8 text-center font-sans text-sm text-ink-soft">
              Submitted {formatInstant(q.submittedAt, s.business.timezone)}. Here&apos;s what you told me — if anything
              changes, just reply to my email.
            </p>
            <dl className="space-y-6 rounded-sm border border-rule bg-cream p-6 sm:p-8">
              {q.fields.map((f) => {
                if (f.type === "heading")
                  return (
                    <h2 key={f.id} className="display border-b border-rule pb-1 pt-4 text-xl first:pt-0">
                      {f.label}
                    </h2>
                  );
                const a = q.answers[f.id];
                const text = Array.isArray(a) ? a.join(", ") : (a ?? "");
                return (
                  <div key={f.id}>
                    <dt className="font-sans text-xs uppercase tracking-[0.14em] text-muted">{f.label}</dt>
                    <dd className="mt-1 whitespace-pre-line text-[1.05rem]">
                      {text || <span className="font-sans text-sm italic text-muted">—</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ) : (
          <QuestionnaireForm
            token={token}
            qtoken={qtoken}
            fields={q.fields}
            initialAnswers={q.answers}
          />
        )}
      </div>
    </div>
  );
}
