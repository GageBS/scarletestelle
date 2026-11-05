import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { formatInstant } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Badge, Card, EmptyState, Notice, PageHeader, cx } from "@/components/studio/ui";
import { projectHref } from "../_crm/parts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Emails" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "logged", label: "Saved, not sent" },
  { value: "failed", label: "Failed" },
] as const;
const tone = { sent: "ok", logged: "warn", failed: "bad" } as const;
const label = { sent: "Sent", logged: "Saved, not sent", failed: "Failed" } as const;

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStudio();
  const sp = (await searchParams).status;
  const status = sp === "sent" || sp === "logged" || sp === "failed" ? sp : "";
  const tz = (await getSettings()).business.timezone;
  const M = schema.messages;
  const rows = await db
    .select({ m: M, projectTitle: schema.projects.title })
    .from(M)
    .leftJoin(schema.projects, eq(M.projectId, schema.projects.id))
    .where(status ? and(eq(M.status, status)) : undefined)
    .orderBy(desc(M.createdAt))
    .limit(300);

  return (
    <>
      <PageHeader eyebrow="Everything the studio sends" title="Emails" />

      {!emailConfigured() ? (
        <div className="mb-5">
          <Notice tone="warn">
            <strong>Email isn’t connected yet.</strong> “Saved, not sent” (logged) means the message was written and kept
            here, but it was <strong>not delivered</strong> to anyone. Once email is connected, new messages will go out
            and show as “Sent”. Older saved messages are not re-sent automatically.
          </Notice>
        </div>
      ) : (
        <div className="mb-5">
          <Notice tone="ok">Email is connected. Messages show “Sent” once the provider accepts them.</Notice>
        </div>
      )}

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/studio/outbox?status=${f.value}` : "/studio/outbox"}
            className={cx(
              "flex min-h-11 shrink-0 items-center rounded-full border px-4 font-sans text-xs uppercase tracking-[0.12em]",
              status === f.value ? "border-ink bg-ink text-cream" : "border-rule bg-cream text-ink-soft",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card pad={false}>
        {rows.length === 0 ? (
          <EmptyState title="No emails here">
            {status ? "Nothing with that status." : "Emails you send or automate will be listed here."}
          </EmptyState>
        ) : (
          <div className="divide-y divide-rule/70">
            {rows.map(({ m, projectTitle }) => (
              <details key={m.id} className="px-4 py-3 md:px-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-sans text-sm text-ink">{m.subject}</span>
                    <span className="block truncate font-sans text-xs text-ink-soft">
                      {m.direction === "in" ? `From ${m.fromEmail}` : `To ${m.toEmail}`} ·{" "}
                      {formatInstant(m.createdAt, tz)}
                    </span>
                  </span>
                  <Badge tone={tone[m.status]}>{label[m.status]}</Badge>
                </summary>
                <div className="mt-3 border-t border-rule/60 pt-3">
                  <p className="whitespace-pre-wrap font-serif text-[0.95rem] leading-relaxed">{m.body}</p>
                  {m.error && <p className="mt-3 font-sans text-xs text-scarlet">Error: {m.error}</p>}
                  {m.status === "logged" && (
                    <p className="mt-3 font-sans text-xs text-[#7a4a12]">Saved only. This was not delivered.</p>
                  )}
                  {m.projectId && (
                    <Link href={projectHref(m.projectId)} className="mt-3 inline-block font-sans text-xs uppercase tracking-[0.14em] text-scarlet hover:underline">
                      Open {projectTitle ?? "project"} →
                    </Link>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
