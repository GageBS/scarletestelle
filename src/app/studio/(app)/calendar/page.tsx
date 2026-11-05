import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BOOKED_STAGES, projectTypeLabel, type Stage } from "@/lib/constants";
import { addDays, dayToDate, formatDay, money, todayIn } from "@/lib/format";
import { dayOf, dayStartMs, formatSlotTime } from "@/lib/scheduler";
import { Badge, Card, EmptyState, LinkButton, PageHeader, cx } from "@/components/studio/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

type Kind = "session" | "meeting" | "payment" | "todo" | "blocked";
type Ev = { day: string; kind: Kind; title: string; sub?: string; time?: string; href?: string; sort: string };

const KIND: Record<Kind, { label: string; dot: string; chip: string }> = {
  session: { label: "Booked", dot: "bg-scarlet", chip: "bg-scarlet text-cream" },
  meeting: { label: "Call", dot: "bg-ink", chip: "bg-ink text-cream" },
  payment: { label: "Payment due", dot: "bg-moss", chip: "bg-moss text-cream" },
  todo: { label: "To-do", dot: "bg-rose", chip: "bg-rose/40 text-wine" },
  blocked: { label: "Day off", dot: "bg-muted", chip: "bg-linen text-ink-soft" },
};

const monthOf = (day: string) => day.slice(0, 7);
function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; view?: string }>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const s = await getSettings();
  const tz = s.business.timezone;
  const today = todayIn(tz);
  const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? "") ? (sp.m as string) : monthOf(today);
  const view = sp.view === "agenda" || sp.view === "grid" ? sp.view : "auto";
  const first = `${m}-01`;
  const nextFirst = `${shiftMonth(m, 1)}-01`;

  const [sessions, meetings, installments, todos, blocked] = await Promise.all([
    db.query.projects.findMany({
      where: and(
        inArray(schema.projects.stage, BOOKED_STAGES as Stage[]),
        eq(schema.projects.archived, false),
        gte(schema.projects.eventDate, first),
        lt(schema.projects.eventDate, nextFirst),
      ),
    }),
    db.query.meetings.findMany({
      where: and(
        ne(schema.meetings.status, "cancelled"),
        gte(schema.meetings.startsAt, new Date(dayStartMs(first, tz))),
        lt(schema.meetings.startsAt, new Date(dayStartMs(nextFirst, tz))),
      ),
    }),
    db
      .select({ inst: schema.installments, inv: schema.invoices, project: schema.projects })
      .from(schema.installments)
      .innerJoin(schema.invoices, eq(schema.installments.invoiceId, schema.invoices.id))
      .innerJoin(schema.projects, eq(schema.invoices.projectId, schema.projects.id))
      .where(
        and(
          eq(schema.installments.status, "due"),
          ne(schema.invoices.status, "void"),
          gte(schema.installments.dueDate, first),
          lt(schema.installments.dueDate, nextFirst),
        ),
      ),
    db.query.tasks.findMany({
      where: and(eq(schema.tasks.done, false), gte(schema.tasks.dueDate, first), lt(schema.tasks.dueDate, nextFirst)),
    }),
    db.query.blockedDates.findMany({
      where: and(gte(schema.blockedDates.date, first), lt(schema.blockedDates.date, nextFirst)),
    }),
  ]);

  const evs: Ev[] = [];
  for (const p of sessions)
    if (p.eventDate)
      evs.push({
        day: p.eventDate,
        kind: "session",
        title: p.title,
        sub: [projectTypeLabel(p.type), p.venue || p.location].filter(Boolean).join(" · "),
        time: p.startTime || undefined,
        href: `/studio/projects/${p.id}`,
        sort: `1${p.startTime || "00:00"}`,
      });
  for (const mt of meetings) {
    const t = formatSlotTime(mt.startsAt.getTime(), tz);
    evs.push({
      day: dayOf(mt.startsAt.getTime(), tz),
      kind: "meeting",
      title: `${mt.title} · ${mt.name}`,
      sub: mt.status === "completed" ? "Completed" : undefined,
      time: t,
      href: "/studio/scheduler",
      sort: `0${String(mt.startsAt.getTime()).padStart(14, "0")}`,
    });
  }
  for (const { inst, inv, project } of installments)
    evs.push({
      day: inst.dueDate,
      kind: "payment",
      title: `${inst.label} ${money(inst.amountCents)}`,
      sub: project.title,
      href: `/studio/invoices/${inv.id}`,
      sort: "2",
    });
  for (const t of todos)
    if (t.dueDate)
      evs.push({
        day: t.dueDate,
        kind: "todo",
        title: t.title,
        href: t.projectId ? `/studio/projects/${t.projectId}` : "/studio/tasks",
        sort: "3",
      });
  for (const b of blocked)
    evs.push({ day: b.date, kind: "blocked", title: b.reason || "Day off", href: "/studio/scheduler", sort: "4" });

  evs.sort((a, b) => (a.day === b.day ? a.sort.localeCompare(b.sort) : a.day.localeCompare(b.day)));
  const byDay = new Map<string, Ev[]>();
  for (const e of evs) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  // grid: weeks starting Sunday
  const lead = dayToDate(first).getUTCDay();
  const daysInMonth = Math.round((dayToDate(nextFirst).getTime() - dayToDate(first).getTime()) / 86_400_000);
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7) cells.push(null);

  const title = dayToDate(first).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const q = (extra: Record<string, string>) =>
    "?" + new URLSearchParams({ m, ...(view !== "auto" ? { view } : {}), ...extra }).toString();
  const agendaDays = [...byDay.keys()];

  const grid = (
    <div className="overflow-hidden rounded-sm border border-rule bg-cream">
      <div className="grid grid-cols-7 border-b border-rule bg-linen/60">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="label px-2 py-2 text-center text-[0.6rem] text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const list = day ? (byDay.get(day) ?? []) : [];
          return (
            <div
              key={i}
              className={cx(
                "min-h-16 border-b border-r border-rule/70 p-1 md:min-h-28 md:p-1.5",
                !day && "bg-parchment/50",
                day === today && "bg-blush/40",
              )}
            >
              {day && (
                <>
                  <p
                    className={cx(
                      "font-sans text-xs",
                      day === today ? "font-semibold text-scarlet" : "text-ink-soft",
                    )}
                  >
                    {Number(day.slice(8))}
                  </p>
                  {/* phones: dots; larger screens: chips */}
                  <div className="mt-1 flex flex-wrap gap-0.5 md:hidden">
                    {list.slice(0, 6).map((e, j) => (
                      <span key={j} className={cx("size-1.5 rounded-full", KIND[e.kind].dot)} />
                    ))}
                  </div>
                  <ul className="mt-1 hidden space-y-1 md:block">
                    {list.slice(0, 3).map((e, j) => (
                      <li key={j}>
                        <Link
                          href={e.href ?? "#"}
                          title={`${e.title}${e.sub ? ` — ${e.sub}` : ""}`}
                          className={cx(
                            "block truncate rounded-sm px-1.5 py-0.5 font-sans text-[0.68rem] leading-tight",
                            KIND[e.kind].chip,
                          )}
                        >
                          {e.time ? `${e.time} ` : ""}
                          {e.title}
                        </Link>
                      </li>
                    ))}
                    {list.length > 3 && (
                      <li className="font-sans text-[0.65rem] text-muted">+{list.length - 3} more</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const agenda =
    agendaDays.length === 0 ? (
      <Card>
        <EmptyState title="A quiet month">Nothing on the calendar for {title}.</EmptyState>
      </Card>
    ) : (
      <div className="space-y-4">
        {agendaDays.map((day) => (
          <section key={day} className="rounded-sm border border-rule bg-cream">
            <h3
              className={cx(
                "border-b border-rule px-4 py-2 font-sans text-sm",
                day === today ? "bg-blush/40 font-medium text-scarlet" : "text-ink-soft",
              )}
            >
              {formatDay(day, "long")}
              {day === today && " · today"}
            </h3>
            <ul className="divide-y divide-rule/70">
              {byDay.get(day)!.map((e, j) => (
                <li key={j}>
                  <Link href={e.href ?? "#"} className="flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-linen/50">
                    <span className={cx("size-2 shrink-0 rounded-full", KIND[e.kind].dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-sans text-sm">
                        {e.time && <span className="mr-2 text-muted">{e.time}</span>}
                        {e.title}
                      </span>
                      {e.sub && <span className="block truncate font-sans text-xs text-muted">{e.sub}</span>}
                    </span>
                    <Badge tone="muted">{KIND[e.kind].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Studio"
        title="Calendar"
        actions={<LinkButton href="/studio/scheduler" variant="secondary">Scheduler</LinkButton>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LinkButton href={q({ m: shiftMonth(m, -1) })} variant="secondary" aria-label="Previous month">
            ←
          </LinkButton>
          <h2 className="display min-w-40 text-center text-2xl">{title}</h2>
          <LinkButton href={q({ m: shiftMonth(m, 1) })} variant="secondary" aria-label="Next month">
            →
          </LinkButton>
          {m !== monthOf(today) && (
            <LinkButton href={q({ m: monthOf(today) })} variant="ghost">
              Today
            </LinkButton>
          )}
        </div>
        <div className="hidden gap-1 md:flex">
          <LinkButton href={q({ view: "grid" })} variant={view !== "agenda" ? "primary" : "secondary"}>
            Month
          </LinkButton>
          <LinkButton href={q({ view: "agenda" })} variant={view === "agenda" ? "primary" : "secondary"}>
            Agenda
          </LinkButton>
        </div>
        <div className="flex gap-1 md:hidden">
          <LinkButton href={q({ view: "agenda" })} variant={view !== "grid" ? "primary" : "secondary"}>
            Agenda
          </LinkButton>
          <LinkButton href={q({ view: "grid" })} variant={view === "grid" ? "primary" : "secondary"}>
            Month
          </LinkButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-ink-soft">
        {(Object.keys(KIND) as Kind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cx("size-2 rounded-full", KIND[k].dot)} /> {KIND[k].label}
          </span>
        ))}
      </div>

      {/* auto: agenda on phones, month grid from md up. Explicit view overrides both. */}
      {view === "grid" && grid}
      {view === "agenda" && agenda}
      {view === "auto" && (
        <>
          <div className="md:hidden">{agenda}</div>
          <div className="hidden md:block">{grid}</div>
        </>
      )}
    </div>
  );
}
