import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { getSettings, siteUrl } from "@/lib/settings";
import { MERGE_FIELDS } from "@/lib/merge";
import {
  coupleName,
  formatDay,
  formatInstant,
  formatTime,
  fullName,
  money,
  todayIn,
} from "@/lib/format";
import { LEAD_SOURCES, PROJECT_TYPES, projectTypeLabel } from "@/lib/constants";
import { ConfirmButton, CopyButton } from "@/components/studio/client-ui";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Notice,
  PageHeader,
  StageBadge,
  Select,
  Textarea,
  btnStyles,
} from "@/components/studio/ui";
import { ActionForm } from "../../_crm/action-form";
import { StageMover } from "../../_crm/stage-mover";
import { RowList, SampleBadge, TaskCheck } from "../../_crm/parts";
import { addTask, deleteTask, toggleTask } from "../../tasks/actions";
import {
  addNote,
  deleteProject,
  moveProjectStage,
  previewEmail,
  sendProjectEmail,
  setArchived,
  updateProject,
} from "../actions";
import { EmailComposer } from "./email-composer";

export const dynamic = "force-dynamic";

const SECTIONS = [
  ["overview", "Overview"],
  ["timeline", "Timeline"],
  ["todos", "To-dos"],
  ["email", "Email"],
  ["files", "Files"],
] as const;

const msgTone = { sent: "ok", logged: "warn", failed: "bad" } as const;
const msgLabel = { sent: "Sent", logged: "Saved, not sent", failed: "Failed" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule/60 py-2 last:border-0">
      <dt className="label shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-sans text-sm text-ink">{children}</dd>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  return { title: p?.title ?? "Project" };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStudio();
  const { id } = await params;
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  if (!p) notFound();
  const c = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, p.contactId) });
  if (!c) notFound();
  const tz = (await getSettings()).business.timezone;
  const today = todayIn(tz);

  const [
    activities,
    tasks,
    messages,
    templates,
    proposals,
    contracts,
    invoices,
    questionnaires,
    meetings,
  ] = await Promise.all([
    db.select().from(schema.activities).where(eq(schema.activities.projectId, id)).orderBy(desc(schema.activities.createdAt)).limit(150),
    db.select().from(schema.tasks).where(eq(schema.tasks.projectId, id)).orderBy(asc(schema.tasks.done), asc(schema.tasks.dueDate)),
    db.select().from(schema.messages).where(eq(schema.messages.projectId, id)).orderBy(desc(schema.messages.createdAt)).limit(50),
    db.select().from(schema.emailTemplates).orderBy(asc(schema.emailTemplates.name)),
    db.select().from(schema.proposals).where(eq(schema.proposals.projectId, id)).orderBy(desc(schema.proposals.createdAt)),
    db.select().from(schema.contracts).where(eq(schema.contracts.projectId, id)).orderBy(desc(schema.contracts.createdAt)),
    db.select().from(schema.invoices).where(eq(schema.invoices.projectId, id)).orderBy(desc(schema.invoices.createdAt)),
    db.select().from(schema.questionnaires).where(eq(schema.questionnaires.projectId, id)).orderBy(desc(schema.questionnaires.createdAt)),
    db.select().from(schema.meetings).where(eq(schema.meetings.projectId, id)).orderBy(desc(schema.meetings.startsAt)),
  ]);
  const installments = invoices.length
    ? await db
        .select()
        .from(schema.installments)
        .where(inArray(schema.installments.invoiceId, invoices.map((i) => i.id)))
    : [];
  const paidFor = (invoiceId: string) =>
    installments.filter((i) => i.invoiceId === invoiceId && i.status === "paid").reduce((a, i) => a + i.amountCents, 0);

  const portal = `${siteUrl()}/c/${p.portalToken}`;
  const recipients = [
    c.email && { label: c.firstName, email: c.email },
    c.partnerEmail && { label: c.partnerFirstName || "Partner", email: c.partnerEmail },
  ].filter(Boolean) as { label: string; email: string }[];
  const igHandle = c.instagram.replace(/^@/, "");
  const answers = Object.entries(p.inquiryData ?? {}).filter(([, v]) => v);
  const when = (d: Date) =>
    formatInstant(d, tz, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <Link href="/studio/pipeline" className="mb-3 inline-flex min-h-10 items-center font-sans text-xs uppercase tracking-[0.14em] text-ink-soft hover:text-ink">
        ← Pipeline
      </Link>

      {p.archived && (
        <div className="mb-4">
          <Notice tone="warn">
            This project is archived and hidden from the pipeline and dashboard.
            <form action={setArchived} className="mt-2">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="archived" value="0" />
              <button className={btnStyles.secondary}>Restore project</button>
            </form>
          </Notice>
        </div>
      )}

      <PageHeader
        eyebrow={`${projectTypeLabel(p.type)}${p.isSample ? " · sample" : ""}`}
        title={p.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StageBadge stage={p.stage} />
            <span>{p.eventDate ? formatDay(p.eventDate, "long") : p.eventDateNote || "Date to be decided"}</span>
            {p.valueCents > 0 && <span>{money(p.valueCents)}</span>}
            {p.isSample && <SampleBadge />}
          </span>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
        <div>
          <p className="label mb-1 text-ink-soft">Stage</p>
          <StageMover key={p.stage} projectId={p.id} stage={p.stage} action={moveProjectStage} />
          {p.stage === "lost" && p.lostReason && (
            <p className="mt-2 font-sans text-xs text-ink-soft">Reason: {p.lostReason}</p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <span className="mr-2 font-sans text-sm text-ink">
            {c.partnerFirstName ? coupleName(c) : fullName(c)}
          </span>
          {c.phone && (
            <a href={`tel:${c.phone}`} className={btnStyles.secondary}>
              Call
            </a>
          )}
          {c.phone && (
            <a href={`sms:${c.phone}`} className={btnStyles.secondary}>
              Text
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className={btnStyles.secondary}>
              Email
            </a>
          )}
          {igHandle && (
            <a href={`https://instagram.com/${igHandle}`} target="_blank" rel="noreferrer" className={btnStyles.secondary}>
              Instagram
            </a>
          )}
          <Link href={`/studio/clients/${c.id}`} className={btnStyles.ghost}>
            Client profile
          </Link>
        </div>
      </div>

      <nav aria-label="Sections" className="sticky top-0 z-10 -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-rule bg-parchment/95 px-4 backdrop-blur md:static md:mx-0 md:px-0">
        {SECTIONS.map(([k, label]) => (
          <a key={k} href={`#${k}`} className="flex min-h-11 shrink-0 items-center px-3 font-sans text-xs uppercase tracking-[0.14em] text-ink-soft hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ───── overview ───── */}
          <section id="overview" className="scroll-mt-16">
            <Card title="Overview">
              <ActionForm action={updateProject} submitLabel="Save details">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title" className="sm:col-span-2">
                    <Input name="title" defaultValue={p.title} required />
                  </Field>
                  <Field label="Type">
                    <Select name="type" defaultValue={p.type}>
                      {PROJECT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Lead source">
                    <Input name="leadSource" defaultValue={p.leadSource} list="lead-sources" />
                    <datalist id="lead-sources">
                      {LEAD_SOURCES.map((l) => (
                        <option key={l} value={l} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Date">
                    <Input name="eventDate" type="date" defaultValue={p.eventDate ?? ""} />
                  </Field>
                  <Field label="Date note" hint="If the date isn’t set yet">
                    <Input name="eventDateNote" defaultValue={p.eventDateNote} />
                  </Field>
                  <Field label="Start time">
                    <Input name="startTime" type="time" defaultValue={p.startTime} />
                  </Field>
                  <Field label="End time">
                    <Input name="endTime" type="time" defaultValue={p.endTime} />
                  </Field>
                  <Field label="Venue">
                    <Input name="venue" defaultValue={p.venue} />
                  </Field>
                  <Field label="Location">
                    <Input name="location" defaultValue={p.location} />
                  </Field>
                  <Field label="Guest count">
                    <Input name="guestCount" inputMode="numeric" defaultValue={p.guestCount ?? ""} />
                  </Field>
                  <Field label="Coverage hours">
                    <Input name="coverageHours" inputMode="decimal" defaultValue={p.coverageHours ?? ""} />
                  </Field>
                  <Field label="Budget (their range)">
                    <Input name="budget" defaultValue={p.budget} />
                  </Field>
                  <Field label="Booked value">
                    <Input name="value" inputMode="decimal" defaultValue={p.valueCents ? (p.valueCents / 100).toString() : ""} placeholder="$0" />
                  </Field>
                  <Field label="Gallery link" className="sm:col-span-2">
                    <Input name="galleryUrl" type="url" inputMode="url" defaultValue={p.galleryUrl} placeholder="https://…" />
                  </Field>
                  <Field label="Notes" className="sm:col-span-2" hint="Only you see these.">
                    <Textarea name="notes" defaultValue={p.notes} rows={4} />
                  </Field>
                </div>
              </ActionForm>
            </Card>

            {answers.length > 0 && (
              <Card title="Their inquiry" className="mt-6">
                <dl>
                  {answers.map(([k, v]) => (
                    <div key={k} className="border-b border-rule/60 py-3 last:border-0">
                      <dt className="label text-muted">{k}</dt>
                      <dd className="mt-1 whitespace-pre-wrap font-serif text-[0.95rem] leading-relaxed">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}
          </section>

          {/* ───── timeline ───── */}
          <section id="timeline" className="scroll-mt-16">
            <Card title="Timeline">
              <ActionForm action={addNote} reset submitLabel="Add note" pendingLabel="Adding…">
                <input type="hidden" name="projectId" value={p.id} />
                <Field label="Add a note">
                  <Textarea name="note" rows={3} placeholder="Called her back, she’d like Saturday golden hour…" required />
                </Field>
              </ActionForm>
              <div className="mt-6">
                {activities.length === 0 ? (
                  <EmptyState title="Nothing yet">Notes, emails, stage moves and payments will build up here.</EmptyState>
                ) : (
                  <ol className="relative space-y-4 border-l border-rule pl-5">
                    {activities.map((a) => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[1.62rem] top-1.5 size-2 rounded-full bg-scarlet" />
                        <p className="font-sans text-sm text-ink">
                          {a.title}{" "}
                          <span className="ml-1 align-middle">
                            <Badge>{a.kind}</Badge>
                          </span>
                        </p>
                        {a.body && (
                          <p className="mt-1 whitespace-pre-wrap font-serif text-[0.95rem] leading-relaxed text-ink-soft">{a.body}</p>
                        )}
                        <p className="mt-1 font-sans text-xs text-muted">{when(a.createdAt)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>
          </section>

          {/* ───── to-dos ───── */}
          <section id="todos" className="scroll-mt-16">
            <Card title="To-dos" pad={false}>
              <div className="p-4 md:p-5">
                <ActionForm action={addTask} reset submitLabel="Add to-do" pendingLabel="Adding…">
                  <input type="hidden" name="projectId" value={p.id} />
                  <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                    <Field label="New to-do">
                      <Input name="title" required placeholder="Send questionnaire" />
                    </Field>
                    <Field label="Due">
                      <Input name="dueDate" type="date" />
                    </Field>
                  </div>
                </ActionForm>
              </div>
              {tasks.length === 0 ? (
                <p className="border-t border-rule px-5 py-6 text-center font-sans text-sm text-muted">No to-dos for this project.</p>
              ) : (
                <div className="border-t border-rule">
                  <RowList>
                    {tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-1 px-2 py-1">
                        <TaskCheck id={t.id} done={t.done} action={toggleTask} />
                        <div className="min-w-0 flex-1 py-2">
                          <p className={t.done ? "truncate font-sans text-[0.95rem] text-muted line-through" : "truncate font-sans text-[0.95rem]"}>
                            {t.title}
                          </p>
                          {t.dueDate && (
                            <p className={!t.done && t.dueDate < today ? "font-sans text-xs text-scarlet" : "font-sans text-xs text-ink-soft"}>
                              {!t.done && t.dueDate < today ? "Overdue · " : ""}
                              {formatDay(t.dueDate, "medium")}
                            </p>
                          )}
                        </div>
                        <form action={deleteTask}>
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmButton variant="ghost" confirmText="Delete?" className="min-h-11">
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    ))}
                  </RowList>
                </div>
              )}
            </Card>
          </section>

          {/* ───── email ───── */}
          <section id="email" className="scroll-mt-16">
            <Card title="Email">
              {!emailConfigured() && (
                <div className="mb-4">
                  <Notice tone="warn">
                    Email isn’t connected yet. Messages you write here are saved in your emails list as “Saved, not sent”
                    and are <strong>not delivered</strong> to the client.
                  </Notice>
                </div>
              )}
              {recipients.length === 0 ? (
                <Notice tone="info">
                  {c.firstName} has no email address yet. Add one on the{" "}
                  <Link href={`/studio/clients/${c.id}`} className="underline">
                    client profile
                  </Link>{" "}
                  to email from here.
                </Notice>
              ) : (
                <EmailComposer
                  projectId={p.id}
                  recipients={recipients}
                  templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))}
                  send={sendProjectEmail}
                  preview={previewEmail}
                  mergeKeys={MERGE_FIELDS.map((m) => m.key)}
                />
              )}
              <h3 className="label mb-2 mt-8 text-muted">Past messages</h3>
              {messages.length === 0 ? (
                <p className="font-sans text-sm text-muted">No emails for this project yet.</p>
              ) : (
                <div className="divide-y divide-rule/70 border-y border-rule/70">
                  {messages.map((m) => (
                    <details key={m.id} className="group py-3">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-sans text-sm text-ink">{m.subject}</span>
                          <span className="block truncate font-sans text-xs text-ink-soft">
                            {m.direction === "in" ? "From" : "To"} {m.direction === "in" ? m.fromEmail : m.toEmail} · {when(m.createdAt)}
                          </span>
                        </span>
                        <Badge tone={msgTone[m.status]}>{msgLabel[m.status]}</Badge>
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap font-serif text-[0.95rem] leading-relaxed">{m.body}</p>
                      {m.error && <p className="mt-2 font-sans text-xs text-scarlet">{m.error}</p>}
                    </details>
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>

        {/* ───── side column: files, portal, danger ───── */}
        <div className="space-y-6">
          <section id="files" className="scroll-mt-16">
            <Card title="Files" pad={false}>
              <div className="grid grid-cols-1 gap-2 p-4">
                <LinkButton href={`/studio/proposals/new?project=${p.id}`} variant="secondary">
                  New proposal
                </LinkButton>
                <LinkButton href={`/studio/invoices/new?project=${p.id}`} variant="secondary">
                  New invoice
                </LinkButton>
                <LinkButton href={`/studio/questionnaires/send?project=${p.id}`} variant="secondary">
                  Send questionnaire
                </LinkButton>
              </div>
              <FileGroup title="Proposals" empty="No proposals yet">
                {proposals.map((x) => (
                  <FileLink key={x.id} href={`/studio/proposals/${x.id}`} title={x.title} badge={<Badge tone={x.status === "accepted" ? "ok" : x.status === "void" ? "muted" : "warn"}>{x.status}</Badge>} />
                ))}
              </FileGroup>
              <FileGroup title="Contracts" empty="No contracts yet">
                {contracts.map((x) => (
                  <FileLink key={x.id} href={`/studio/contracts/${x.id}`} title={x.title} badge={<Badge tone={x.status === "countersigned" || x.status === "signed" ? "ok" : x.status === "void" ? "muted" : "warn"}>{x.status}</Badge>} />
                ))}
              </FileGroup>
              <FileGroup title="Invoices" empty="No invoices yet">
                {invoices.map((x) => {
                  const paid = paidFor(x.id);
                  return (
                    <FileLink
                      key={x.id}
                      href={`/studio/invoices/${x.id}`}
                      title={`${x.number} · ${x.title}`}
                      sub={`${money(paid)} paid of ${money(x.totalCents)}`}
                      badge={<Badge tone={x.status === "paid" ? "ok" : x.status === "void" ? "muted" : x.status === "partial" ? "warn" : "muted"}>{x.status}</Badge>}
                    />
                  );
                })}
              </FileGroup>
              <FileGroup title="Questionnaires" empty="None sent yet">
                {questionnaires.map((x) => (
                  <FileLink key={x.id} href={`/studio/questionnaires/sent/${x.id}`} title={x.title} badge={<Badge tone={x.status === "submitted" ? "ok" : "warn"}>{x.status}</Badge>} />
                ))}
              </FileGroup>
              <FileGroup title="Meetings" empty="No meetings">
                {meetings.map((x) => (
                  <div key={x.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-sans text-sm">{x.title}</span>
                      <span className="block font-sans text-xs text-ink-soft">{when(x.startsAt)}</span>
                    </span>
                    <Badge tone={x.status === "scheduled" ? "warn" : x.status === "completed" ? "ok" : "muted"}>{x.status}</Badge>
                  </div>
                ))}
              </FileGroup>
            </Card>
          </section>

          <Card title="Client portal">
            <p className="mb-3 break-all font-sans text-xs text-ink-soft">{portal}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={portal} />
              <a href={portal} target="_blank" rel="noreferrer" className={btnStyles.ghost}>
                Open
              </a>
            </div>
            {c.partnerFirstName && (
              <p className="mt-3 font-sans text-xs text-muted">
                Contacts: {fullName(c)} &amp; {[c.partnerFirstName, c.partnerLastName].filter(Boolean).join(" ")}
              </p>
            )}
          </Card>

          <Card title="Project details">
            <dl>
              <Row label="Venue">{p.venue || "—"}</Row>
              <Row label="Location">{p.location || "—"}</Row>
              <Row label="Time">{p.startTime ? `${formatTime(p.startTime)}${p.endTime ? ` – ${formatTime(p.endTime)}` : ""}` : "—"}</Row>
              <Row label="Source">{p.leadSource || "—"}</Row>
              <Row label="Created">{when(p.createdAt)}</Row>
            </dl>
          </Card>

          <Card title="Archive or delete">
            <p className="mb-3 font-sans text-sm text-ink-soft">
              Archiving hides the project but keeps everything. Deleting removes its timeline, to-dos, files and emails for good.
            </p>
            <div className="flex flex-wrap gap-2">
              {!p.archived && (
                <form action={setArchived}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="archived" value="1" />
                  <ConfirmButton variant="secondary" confirmText="Tap again to archive">
                    Archive
                  </ConfirmButton>
                </form>
              )}
              <form action={deleteProject}>
                <input type="hidden" name="id" value={p.id} />
                <ConfirmButton confirmText="Tap again to delete forever">Delete project</ConfirmButton>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function FileGroup({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="border-t border-rule">
      <p className="label px-4 pb-1 pt-3 text-muted">{title}</p>
      {children.length === 0 ? <p className="px-4 pb-3 font-sans text-xs text-muted">{empty}</p> : <div className="pb-1">{children}</div>}
    </div>
  );
}

function FileLink({ href, title, sub, badge }: { href: string; title: string; sub?: string; badge: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 transition hover:bg-linen/60">
      <span className="min-w-0">
        <span className="block truncate font-sans text-sm text-ink">{title}</span>
        {sub && <span className="block font-sans text-xs text-ink-soft">{sub}</span>}
      </span>
      {badge}
    </Link>
  );
}
