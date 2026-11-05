import Link from "next/link";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  addDays,
  dayToDate,
  daysBetween,
  formatDay,
  formatInstant,
  money,
  todayIn,
} from "@/lib/format";
import { BOOKED_STAGES, OPEN_LEAD_STAGES, projectTypeLabel } from "@/lib/constants";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/studio/ui";
import { ListRow, RowList, TaskCheck, projectHref } from "./_crm/parts";
import { toggleTask } from "./tasks/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

type Attention = {
  key: string;
  href: string;
  title: string;
  detail: string;
  tone: "bad" | "warn" | "rose";
  label: string;
};

function greeting(tz: string) {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date()),
  ) % 24;
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  await requireStudio();
  const s = await getSettings();
  const tz = s.business.timezone;
  const now = new Date();
  const today = todayIn(tz);
  const year = today.slice(0, 4);
  const yearStart = dayToDate(`${year}-01-01`);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000);
  const notArchived = eq(schema.projects.archived, false);
  const P = schema.projects;

  const [
    newInq,
    openLeads,
    booked,
    collected,
    outstanding,
    staleInquiries,
    staleProposals,
    overdueInstallments,
    overdueTasks,
    upcoming,
    meetings,
    todayTasks,
    activity,
  ] = await Promise.all([
    db.select({ n: count() }).from(P).where(and(gte(P.createdAt, weekAgo), notArchived)),
    db.select({ n: count() }).from(P).where(and(inArray(P.stage, OPEN_LEAD_STAGES), notArchived)),
    db
      .select({ n: count(), v: sum(P.valueCents) })
      .from(P)
      .where(and(inArray(P.stage, BOOKED_STAGES), gte(P.bookedAt, yearStart), notArchived)),
    db
      .select({ v: sum(schema.installments.amountCents) })
      .from(schema.installments)
      .where(and(eq(schema.installments.status, "paid"), gte(schema.installments.paidAt, yearStart))),
    db
      .select({ v: sum(schema.installments.amountCents) })
      .from(schema.installments)
      .innerJoin(schema.invoices, eq(schema.installments.invoiceId, schema.invoices.id))
      .where(
        and(eq(schema.installments.status, "due"), inArray(schema.invoices.status, ["sent", "partial"])),
      ),
    db
      .select({ id: P.id, title: P.title, createdAt: P.createdAt })
      .from(P)
      .where(and(eq(P.stage, "inquiry"), notArchived, lt(P.createdAt, dayAgo)))
      .orderBy(asc(P.createdAt)),
    db
      .select({
        id: schema.proposals.id,
        sentAt: schema.proposals.sentAt,
        projectId: P.id,
        title: P.title,
      })
      .from(schema.proposals)
      .innerJoin(P, eq(schema.proposals.projectId, P.id))
      .where(
        and(
          inArray(schema.proposals.status, ["sent", "viewed"]),
          lt(schema.proposals.sentAt, threeDaysAgo),
          notArchived,
        ),
      ),
    db
      .select({
        id: schema.installments.id,
        label: schema.installments.label,
        amount: schema.installments.amountCents,
        dueDate: schema.installments.dueDate,
        projectId: P.id,
        title: P.title,
      })
      .from(schema.installments)
      .innerJoin(schema.invoices, eq(schema.installments.invoiceId, schema.invoices.id))
      .innerJoin(P, eq(schema.invoices.projectId, P.id))
      .where(
        and(
          eq(schema.installments.status, "due"),
          lt(schema.installments.dueDate, today),
          inArray(schema.invoices.status, ["sent", "partial"]),
        ),
      )
      .orderBy(asc(schema.installments.dueDate)),
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        dueDate: schema.tasks.dueDate,
        projectId: schema.tasks.projectId,
        projectTitle: P.title,
      })
      .from(schema.tasks)
      .leftJoin(P, eq(schema.tasks.projectId, P.id))
      .where(and(eq(schema.tasks.done, false), lt(schema.tasks.dueDate, today)))
      .orderBy(asc(schema.tasks.dueDate)),
    db
      .select({
        id: P.id,
        title: P.title,
        type: P.type,
        stage: P.stage,
        eventDate: P.eventDate,
        venue: P.venue,
      })
      .from(P)
      .where(
        and(
          inArray(
            P.stage,
            BOOKED_STAGES.filter((x) => x !== "completed"),
          ),
          gte(P.eventDate, today),
          lte(P.eventDate, addDays(today, 60)),
          notArchived,
        ),
      )
      .orderBy(asc(P.eventDate)),
    db
      .select()
      .from(schema.meetings)
      .where(
        and(
          eq(schema.meetings.status, "scheduled"),
          gte(schema.meetings.startsAt, now),
          lte(schema.meetings.startsAt, new Date(now.getTime() + 30 * 86_400_000)),
        ),
      )
      .orderBy(asc(schema.meetings.startsAt))
      .limit(6),
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        projectId: schema.tasks.projectId,
        projectTitle: P.title,
      })
      .from(schema.tasks)
      .leftJoin(P, eq(schema.tasks.projectId, P.id))
      .where(and(eq(schema.tasks.done, false), eq(schema.tasks.dueDate, today))),
    db
      .select({
        id: schema.activities.id,
        projectId: schema.activities.projectId,
        kind: schema.activities.kind,
        title: schema.activities.title,
        body: schema.activities.body,
        createdAt: schema.activities.createdAt,
        projectTitle: P.title,
      })
      .from(schema.activities)
      .leftJoin(P, eq(schema.activities.projectId, P.id))
      .orderBy(desc(schema.activities.createdAt))
      .limit(12),
  ]);

  /* inquiries nobody has answered: no hand-written email and no note since they came in */
  const staleIds = staleInquiries.map((i) => i.id);
  const touched = new Set<string>();
  if (staleIds.length) {
    const [msgs, notes] = await Promise.all([
      db
        .select({ projectId: schema.messages.projectId })
        .from(schema.messages)
        .where(and(inArray(schema.messages.projectId, staleIds), isNull(schema.messages.automationId))),
      db
        .select({ projectId: schema.activities.projectId })
        .from(schema.activities)
        .where(and(inArray(schema.activities.projectId, staleIds), eq(schema.activities.kind, "note"))),
    ]);
    for (const m of [...msgs, ...notes]) if (m.projectId) touched.add(m.projectId);
  }

  const attention: Attention[] = [
    ...staleInquiries
      .filter((i) => !touched.has(i.id))
      .map((i) => {
        const hrs = Math.round((now.getTime() - i.createdAt.getTime()) / 3_600_000);
        return {
          key: `inq-${i.id}`,
          href: projectHref(i.id),
          title: i.title,
          detail: `Inquiry waiting ${hrs >= 48 ? `${Math.floor(hrs / 24)} days` : `${hrs} hours`} for a reply`,
          tone: "bad" as const,
          label: "Reply",
        };
      }),
    ...staleProposals.map((p) => ({
      key: `prop-${p.id}`,
      href: projectHref(p.projectId),
      title: p.title,
      detail: `Proposal sent ${p.sentAt ? Math.floor((now.getTime() - p.sentAt.getTime()) / 86_400_000) : "3+"} days ago, not signed`,
      tone: "warn" as const,
      label: "Nudge",
    })),
    ...overdueInstallments.map((i) => ({
      key: `inst-${i.id}`,
      href: projectHref(i.projectId),
      title: i.title,
      detail: `${i.label} ${money(i.amount)} was due ${formatDay(i.dueDate, "short")}`,
      tone: "bad" as const,
      label: "Overdue",
    })),
    ...overdueTasks.map((t) => ({
      key: `task-${t.id}`,
      href: t.projectId ? projectHref(t.projectId) : "/studio/tasks",
      title: t.title,
      detail: `To-do overdue since ${formatDay(t.dueDate, "short")}${t.projectTitle ? ` · ${t.projectTitle}` : ""}`,
      tone: "rose" as const,
      label: "To-do",
    })),
  ];

  return (
    <>
      <PageHeader
        eyebrow={formatDay(today, "long")}
        title={`${greeting(tz)}, Scarlet`}
        description="Here’s where everything stands."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="New inquiries" value={newInq[0].n} hint="last 7 days" href="/studio/pipeline" />
        <Stat label="Open leads" value={openLeads[0].n} hint="not booked yet" href="/studio/pipeline" />
        <Stat
          label={`Booked ${year}`}
          value={booked[0].n}
          hint={money(Number(booked[0].v ?? 0))}
          href="/studio/pipeline"
        />
        <Stat label="Collected" value={money(Number(collected[0].v ?? 0))} hint={`paid in ${year}`} />
        <div className="col-span-2 lg:col-span-1">
          <Stat label="Outstanding" value={money(Number(outstanding[0].v ?? 0))} hint="invoiced, not yet paid" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Needs your attention" pad={false}>
            {attention.length === 0 ? (
              <EmptyState title="All caught up">
                No unanswered inquiries, unsigned proposals, or overdue payments or to-dos.
              </EmptyState>
            ) : (
              <RowList>
                {attention.slice(0, 10).map((a) => (
                  <ListRow
                    key={a.key}
                    href={a.href}
                    title={a.title}
                    sub={a.detail}
                    right={<Badge tone={a.tone}>{a.label}</Badge>}
                  />
                ))}
                {attention.length > 10 && (
                  <p className="px-5 py-3 font-sans text-xs text-muted">
                    + {attention.length - 10} more. Work through these and the rest will show up.
                  </p>
                )}
              </RowList>
            )}
          </Card>

          <Card title="Coming up · next 60 days" pad={false}>
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing on the calendar">
                Booked sessions and weddings in the next 60 days will appear here.
              </EmptyState>
            ) : (
              <RowList>
                {upcoming.map((u) => {
                  const days = daysBetween(today, u.eventDate!);
                  return (
                    <ListRow
                      key={u.id}
                      href={projectHref(u.id)}
                      title={u.title}
                      sub={`${projectTypeLabel(u.type)}${u.venue ? ` · ${u.venue}` : ""}`}
                      right={
                        <>
                          <span className="block text-ink">{formatDay(u.eventDate, "medium")}</span>
                          <span>{days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}</span>
                        </>
                      }
                    />
                  );
                })}
              </RowList>
            )}
          </Card>

          <Card title="Recent activity" pad={false}>
            {activity.length === 0 ? (
              <EmptyState title="Quiet so far">Everything that happens on a project shows up here.</EmptyState>
            ) : (
              <RowList>
                {activity.map((a) => {
                  const inner = (
                    <>
                      <span className="block truncate font-sans text-sm text-ink">{a.title}</span>
                      <span className="block truncate font-sans text-xs text-ink-soft">
                        {a.projectTitle ?? "General"}
                        {a.body ? ` · ${a.body.slice(0, 80)}` : ""}
                      </span>
                    </>
                  );
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
                      {a.projectId ? (
                        <Link href={projectHref(a.projectId)} className="min-w-0 hover:underline">
                          {inner}
                        </Link>
                      ) : (
                        <div className="min-w-0">{inner}</div>
                      )}
                      <span className="shrink-0 font-sans text-xs text-muted">
                        {formatInstant(a.createdAt, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </RowList>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Today’s to-dos" pad={false}>
            {todayTasks.length === 0 ? (
              <EmptyState title="Nothing due today">
                <Link href="/studio/tasks" className="underline">
                  Add a to-do
                </Link>
              </EmptyState>
            ) : (
              <RowList>
                {todayTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-1 px-2 py-1">
                    <TaskCheck id={t.id} done={false} action={toggleTask} />
                    <div className="min-w-0 py-2">
                      <p className="truncate font-sans text-[0.95rem]">{t.title}</p>
                      {t.projectId && (
                        <Link href={projectHref(t.projectId)} className="block truncate font-sans text-xs text-ink-soft hover:underline">
                          {t.projectTitle}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </RowList>
            )}
          </Card>

          <Card title="Upcoming meetings" pad={false}>
            {meetings.length === 0 ? (
              <EmptyState title="No calls booked">Scheduled consultations will appear here.</EmptyState>
            ) : (
              <RowList>
                {meetings.map((m) => (
                  <ListRow
                    key={m.id}
                    href={m.projectId ? projectHref(m.projectId) : "/studio/scheduler"}
                    title={m.title}
                    sub={m.name}
                    right={formatInstant(m.startsAt, tz, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  />
                ))}
              </RowList>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
