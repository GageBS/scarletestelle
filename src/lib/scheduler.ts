/**
 * Scheduler: available slots, booking, cancel/reschedule.
 *
 * All wall-clock math happens in the studio time zone (settings.business.timezone, IANA)
 * using only Intl — DST-safe (a local time that does not exist, e.g. 2:30 AM on the
 * spring-forward day, simply yields no slot). Instants are stored as ms (Date) in the DB.
 *
 * computeSlots() is PURE (no DB) so it can be tested for any zone/date.
 * bookMeeting()/rescheduleMeetingByToken() re-check the slot INSIDE a write transaction.
 */
import { and, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId, newToken } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email";
import { getSettings, siteUrl, type AvailabilitySettings, type StudioSettings } from "@/lib/settings";
import { addDays, dayToDate, formatInstant, todayIn } from "@/lib/format";
import { BOOKED_STAGES, type Stage } from "@/lib/constants";

type MeetingType = typeof schema.meetingTypes.$inferSelect;
type Meeting = typeof schema.meetings.$inferSelect;

const DAY_MS = 86_400_000;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/* ───────────────────────── time-zone math (Intl only) ───────────────────────── */

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

/** Offset (local − UTC) in ms of `tz` at the instant `ms`. */
export function tzOffsetMs(ms: number, tz: string): number {
  const parts = dtf(tz).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = n("hour") % 24;
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), h, n("minute"), n("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Wall-clock "YYYY-MM-DD" + "HH:MM" in `tz` → UTC ms. null when that local time does not exist. */
export function localToUtc(day: string, hhmm: string, tz: string): number | null {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMs(guess, tz);
  const off2 = tzOffsetMs(t, tz);
  if (guess - off2 !== t) t = guess - off2;
  if (t + tzOffsetMs(t, tz) !== guess) return null; // falls in a DST gap
  return t;
}

/** Calendar day (studio zone) of an instant. */
export const dayOf = (ms: number, tz: string) => todayIn(tz, new Date(ms));

/** Start of a local day as UTC ms (falls back to 01:00 where midnight does not exist). */
export function dayStartMs(day: string, tz: string): number {
  return localToUtc(day, "00:00", tz) ?? localToUtc(day, "01:00", tz) ?? dayToDate(day).getTime();
}

export function formatSlotTime(ms: number, tz: string) {
  return formatInstant(ms, tz, { hour: "numeric", minute: "2-digit" });
}
/** "Tuesday, March 10, 2026 at 3:00 PM MST" */
export function formatWhen(ms: number, tz: string) {
  return formatInstant(ms, tz, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
/** {short: "MST", long: "Mountain Standard Time"} for the zone at that instant. */
export function zoneLabel(tz: string, ms: number = Date.now()) {
  const pick = (style: "short" | "long") =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style })
      .formatToParts(new Date(ms))
      .find((p) => p.type === "timeZoneName")?.value ?? tz;
  return { short: pick("short"), long: pick("long") };
}

/** True when an instant is already behind us (kept here so pages stay pure). */
export const isPast = (ms: number) => ms < Date.now();
/** Instant `hours` ago. */
export const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

/* ───────────────────────── pure slot computation ───────────────────────── */

export type Slot = { startsAt: number; endsAt: number; label: string };
export type SlotDay = { day: string; slots: Slot[] };

export type SlotInput = {
  tz: string;
  availability: AvailabilitySettings;
  blockedDays: Set<string>;
  bookedEventDays: Set<string>;
  busy: { startsAt: number; endsAt: number }[]; // scheduled meetings
  durationMin: number;
  now: number;
  fromDay?: string;
  toDay?: string;
};

export function computeSlots(inp: SlotInput): SlotDay[] {
  const { tz, availability: av, durationMin } = inp;
  const today = todayIn(tz, new Date(inp.now));
  const first = inp.fromDay && inp.fromDay > today ? inp.fromDay : today;
  const horizonEnd = addDays(today, av.horizonDays);
  const last = inp.toDay && inp.toDay < horizonEnd ? inp.toDay : horizonEnd;
  const earliest = inp.now + av.minNoticeHours * 3_600_000;
  const dur = durationMin * 60_000;
  const buf = av.bufferMin * 60_000;
  const step = (durationMin < 30 ? 15 : 30) * 60_000;

  const perDay = new Map<string, number>();
  for (const b of inp.busy) {
    const d = dayOf(b.startsAt, tz);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  const out: SlotDay[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (inp.blockedDays.has(day) || inp.bookedEventDays.has(day)) continue;
    if (av.maxPerDay > 0 && (perDay.get(day) ?? 0) >= av.maxPerDay) continue;
    const ranges = av.weekly[WEEKDAYS[dayToDate(day).getUTCDay()]] ?? [];
    const slots: Slot[] = [];
    for (const r of ranges) {
      const rs = localToUtc(day, r.start, tz);
      const re = localToUtc(day, r.end, tz);
      if (rs == null || re == null) continue;
      for (let t = rs; t + dur <= re; t += step) {
        if (t < earliest) continue;
        const e = t + dur;
        if (inp.busy.some((b) => t < b.endsAt + buf && e + buf > b.startsAt)) continue;
        if (slots.some((s) => s.startsAt === t)) continue;
        slots.push({ startsAt: t, endsAt: e, label: formatSlotTime(t, tz) });
      }
    }
    if (slots.length) out.push({ day, slots: slots.sort((a, b) => a.startsAt - b.startsAt) });
  }
  return out;
}

/* ───────────────────────── DB-backed ───────────────────────── */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

/**
 * Booking operations run one at a time inside this process (queue shared across route bundles
 * via globalThis). Local SQLite has no busy-wait, so two overlapping writers get SQLITE_BUSY
 * (and a failed BEGIN/COMMIT can leave a stray lock). The slot re-check inside the transaction
 * is what guarantees no double booking; this queue just keeps writers orderly. A BUSY caused by
 * some other writer is retried a few times.
 */
const wq = globalThis as unknown as { __seBookingQueue?: Promise<unknown> };
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = (wq.__seBookingQueue ?? Promise.resolve()).then(fn);
  wq.__seBookingQueue = run.catch(() => undefined);
  return run;
}
async function writeTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await db.transaction(fn);
    } catch (e) {
      const m = e instanceof Error ? `${e.message} ${String((e as { code?: unknown }).code ?? "")}` : "";
      if (n >= 6 || !/SQLITE_BUSY|database is locked/i.test(m)) throw e;
      await new Promise((r) => setTimeout(r, 50 * (n + 1)));
    }
  }
}

async function loadInput(
  x: Exec,
  durationMin: number,
  opts: { fromDay?: string; toDay?: string; excludeMeetingId?: string; now?: number; settings?: StudioSettings } = {},
): Promise<SlotInput> {
  const e = x as typeof db;
  const s = opts.settings ?? (await getSettings());
  const tz = s.business.timezone;
  const now = opts.now ?? Date.now();
  const today = todayIn(tz, new Date(now));
  const from = opts.fromDay && opts.fromDay > today ? opts.fromDay : today;
  const horizonEnd = addDays(today, s.availability.horizonDays);
  const to = opts.toDay && opts.toDay < horizonEnd ? opts.toDay : horizonEnd;

  const [blocked, events, meetings] = await Promise.all([
    e.select({ date: schema.blockedDates.date }).from(schema.blockedDates),
    e
      .select({ d: schema.projects.eventDate })
      .from(schema.projects)
      .where(
        and(
          inArray(schema.projects.stage, BOOKED_STAGES as Stage[]),
          eq(schema.projects.archived, false),
          gte(schema.projects.eventDate, from),
          lt(schema.projects.eventDate, addDays(to, 1)),
        ),
      ),
    e
      .select({ id: schema.meetings.id, startsAt: schema.meetings.startsAt, endsAt: schema.meetings.endsAt })
      .from(schema.meetings)
      .where(
        and(
          eq(schema.meetings.status, "scheduled"),
          gte(schema.meetings.startsAt, new Date(dayStartMs(from, tz) - DAY_MS)),
          lt(schema.meetings.startsAt, new Date(dayStartMs(to, tz) + 2 * DAY_MS)),
        ),
      ),
  ]);
  return {
    tz,
    availability: s.availability,
    blockedDays: new Set(blocked.map((b) => b.date)),
    bookedEventDays: new Set(events.map((r) => r.d).filter((d): d is string => !!d)),
    busy: meetings
      .filter((m) => m.id !== opts.excludeMeetingId)
      .map((m) => ({ startsAt: m.startsAt.getTime(), endsAt: m.endsAt.getTime() })),
    durationMin,
    now,
    fromDay: from,
    toDay: to,
  };
}

/** Open slots for a meeting type over the booking horizon (or a sub-range). */
export async function getAvailableSlots(
  type: Pick<MeetingType, "durationMin">,
  range: { fromDay?: string; toDay?: string; excludeMeetingId?: string } = {},
) {
  const inp = await loadInput(db, type.durationMin, range);
  return { tz: inp.tz, zone: zoneLabel(inp.tz, inp.now), days: computeSlots(inp) };
}

export async function getActiveMeetingType(slug: string) {
  const t = await db.query.meetingTypes.findFirst({ where: eq(schema.meetingTypes.slug, slug) });
  return t && t.active ? t : null;
}

const bookingSchema = z.object({
  name: z.string().trim().min(1, "Please share your name").max(120),
  email: z.string().trim().toLowerCase().email("Please use a valid email").max(200),
  phone: z.string().trim().max(40).default(""),
  notes: z.string().trim().max(2000).default(""),
  startsAt: z.number().int().positive(),
});
export type BookingInput = z.input<typeof bookingSchema> & { meetingTypeId: string };
export type BookResult =
  | { ok: true; meeting: Meeting; manageUrl: string; emailStatus: string }
  | { ok: false; error: string; slotTaken?: boolean };

const SLOT_TAKEN = "That time was just taken — please pick another.";

function locationLine(t: Pick<MeetingType, "location" | "locationDetail">, phone = "") {
  if (t.location === "phone")
    return phone ? `Phone call — I'll ring you at ${phone}.` : "Phone call — I'll call the number you gave me.";
  if (t.location === "video")
    return t.locationDetail ? `Video call — ${t.locationDetail}` : "Video call — I'll send the link before we meet.";
  return t.locationDetail ? `In person — ${t.locationDetail}` : "In person — I'll confirm the spot with you.";
}

/** Find an existing contact + their most recent open project by email. */
async function findLink(x: Exec, email: string) {
  const e = x as typeof db;
  const contact = await e.query.contacts.findFirst({
    where: eq(schema.contacts.email, email),
    orderBy: desc(schema.contacts.createdAt),
  });
  if (!contact) return { contactId: null as string | null, projectId: null as string | null };
  const projects = await e.query.projects.findMany({
    where: and(eq(schema.projects.contactId, contact.id), eq(schema.projects.archived, false)),
    orderBy: desc(schema.projects.createdAt),
  });
  const open = projects.find((p) => p.stage !== "lost" && p.stage !== "completed");
  return { contactId: contact.id, projectId: open?.id ?? null };
}

async function notifyStudio(subject: string, body: string, ids: { projectId: string | null; contactId: string | null }) {
  const s = await getSettings();
  const to = s.notifications.notifyEmail || s.business.email;
  if (!to) return;
  await sendEmail({ to, subject, body, logToTimeline: false, ...ids });
}

export const bookMeeting = (input: BookingInput): Promise<BookResult> => exclusive(() => bookMeetingNow(input));

async function bookMeetingNow(input: BookingInput): Promise<BookResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details" };
  const v = parsed.data;
  const type = await db.query.meetingTypes.findFirst({
    where: eq(schema.meetingTypes.id, input.meetingTypeId),
  });
  if (!type || !type.active) return { ok: false, error: "That kind of call isn't available right now." };

  const settings = await getSettings();
  const tz = settings.business.timezone;
  const day = dayOf(v.startsAt, tz);
  const id = newId();
  const manageToken = newToken();

  const created = await writeTx(async (tx) => {
    // re-check inside the write transaction: no double booking
    const inp = await loadInput(tx, type.durationMin, { fromDay: day, toDay: day, settings });
    const ok = computeSlots(inp).some((d) => d.slots.some((s) => s.startsAt === v.startsAt));
    if (!ok) return null;
    const link = await findLink(tx, v.email);
    const projectId = link.projectId;
    let contactId = link.contactId;
    if (!contactId) {
      const [first, ...rest] = v.name.split(/\s+/);
      contactId = newId();
      await tx.insert(schema.contacts).values({
        id: contactId,
        firstName: first,
        lastName: rest.join(" "),
        email: v.email,
        phone: v.phone,
        source: "Booked a call",
      });
    }
    const row = {
      id,
      meetingTypeId: type.id,
      projectId,
      contactId,
      title: type.name,
      name: v.name,
      email: v.email,
      phone: v.phone,
      startsAt: new Date(v.startsAt),
      endsAt: new Date(v.startsAt + type.durationMin * 60_000),
      notes: v.notes,
      status: "scheduled" as const,
      manageToken,
    };
    await tx.insert(schema.meetings).values(row);
    return { ...row, createdAt: new Date() } satisfies Meeting;
  });
  if (!created) return { ok: false, error: SLOT_TAKEN, slotTaken: true };

  const manageUrl = `${siteUrl()}/book/manage/${manageToken}`;
  const when = formatWhen(v.startsAt, tz);
  await logActivity({
    projectId: created.projectId,
    contactId: created.contactId,
    kind: "meeting",
    title: `${type.name} booked for ${when}`,
    body: v.notes,
    meta: { meetingId: id },
  });
  const s = await getSettings();
  const first = v.name.split(/\s+/)[0];
  const mail = await sendEmail({
    to: v.email,
    subject: `You're booked — ${type.name}, ${when}`,
    body: [
      `Hi ${first},`,
      `I'm so glad you booked time with me. Here are the details:`,
      `**${type.name}** (${type.durationMin} minutes)\n${when}\n${locationLine(type, v.phone)}`,
      `Need to change something? You can reschedule or cancel any time here:\n${manageUrl}`,
      `I can't wait to hear all about it.`,
      `With love,\n${s.business.photographer}`,
    ].join("\n\n"),
    projectId: created.projectId,
    contactId: created.contactId,
    replyTo: s.business.email || undefined,
  });
  await notifyStudio(
    `✦ New booking — ${type.name}, ${when}`,
    [
      `${v.name} booked a ${type.name}.`,
      "",
      `When: ${when}`,
      `Email: ${v.email}`,
      v.phone ? `Phone: ${v.phone}` : null,
      v.notes ? `Notes: ${v.notes}` : null,
      "",
      `Manage it in your studio: ${siteUrl()}/studio/scheduler`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n"),
    { projectId: created.projectId, contactId: created.contactId },
  );
  return { ok: true, meeting: created, manageUrl, emailStatus: mail.status };
}

export async function getMeetingByToken(token: string) {
  const meeting = await db.query.meetings.findFirst({ where: eq(schema.meetings.manageToken, token) });
  if (!meeting) return null;
  const type = meeting.meetingTypeId
    ? ((await db.query.meetingTypes.findFirst({ where: eq(schema.meetingTypes.id, meeting.meetingTypeId) })) ?? null)
    : null;
  return { meeting, type };
}

/** Cancel a meeting (studio or client) and tell the other side. */
export async function cancelMeeting(meeting: Meeting, by: "client" | "studio") {
  if (meeting.status !== "scheduled") return { ok: false as const, error: "This meeting is no longer scheduled." };
  await db.update(schema.meetings).set({ status: "cancelled" }).where(eq(schema.meetings.id, meeting.id));
  const s = await getSettings();
  const tz = s.business.timezone;
  const when = formatWhen(meeting.startsAt.getTime(), tz);
  await logActivity({
    projectId: meeting.projectId,
    contactId: meeting.contactId,
    kind: "meeting",
    title: `${meeting.title} cancelled (${by === "client" ? "by client" : "by studio"}) — was ${when}`,
    meta: { meetingId: meeting.id },
  });
  const ids = { projectId: meeting.projectId, contactId: meeting.contactId };
  if (by === "client") {
    await notifyStudio(`Cancelled — ${meeting.title} with ${meeting.name}`, `${meeting.name} cancelled their ${meeting.title} (${when}).`, ids);
  } else {
    await sendEmail({
      to: meeting.email,
      subject: `Your ${meeting.title} on ${when} has been cancelled`,
      body: `Hi ${meeting.name.split(/\s+/)[0]},\n\nI'm so sorry — I need to cancel our ${meeting.title} scheduled for ${when}. You're welcome to pick a new time any time:\n\n${siteUrl()}/book\n\nWith love,\n${s.business.photographer}`,
      ...ids,
    });
  }
  return { ok: true as const };
}

export async function cancelMeetingByToken(token: string) {
  const found = await getMeetingByToken(token);
  if (!found) return { ok: false as const, error: "We couldn't find that booking." };
  if (found.meeting.startsAt.getTime() < Date.now())
    return { ok: false as const, error: "This meeting has already happened." };
  return cancelMeeting(found.meeting, "client");
}

export const rescheduleMeetingByToken = (token: string, newStartsAt: number): Promise<BookResult> =>
  exclusive(() => rescheduleNow(token, newStartsAt));

async function rescheduleNow(token: string, newStartsAt: number): Promise<BookResult> {
  const found = await getMeetingByToken(token);
  if (!found) return { ok: false, error: "We couldn't find that booking." };
  const { meeting, type } = found;
  if (meeting.status !== "scheduled") return { ok: false, error: "This meeting is no longer scheduled." };
  if (meeting.startsAt.getTime() < Date.now()) return { ok: false, error: "This meeting has already happened." };
  const durationMin = type?.durationMin ?? Math.round((meeting.endsAt.getTime() - meeting.startsAt.getTime()) / 60_000);
  const settings = await getSettings();
  const tz = settings.business.timezone;
  const day = dayOf(newStartsAt, tz);

  const ok = await writeTx(async (tx) => {
    const inp = await loadInput(tx, durationMin, { fromDay: day, toDay: day, excludeMeetingId: meeting.id, settings });
    if (!computeSlots(inp).some((d) => d.slots.some((s) => s.startsAt === newStartsAt))) return false;
    await tx
      .update(schema.meetings)
      .set({ startsAt: new Date(newStartsAt), endsAt: new Date(newStartsAt + durationMin * 60_000) })
      .where(and(eq(schema.meetings.id, meeting.id), ne(schema.meetings.status, "cancelled")));
    return true;
  });
  if (!ok) return { ok: false, error: SLOT_TAKEN, slotTaken: true };

  const updated: Meeting = {
    ...meeting,
    startsAt: new Date(newStartsAt),
    endsAt: new Date(newStartsAt + durationMin * 60_000),
  };
  const manageUrl = `${siteUrl()}/book/manage/${token}`;
  const was = formatWhen(meeting.startsAt.getTime(), tz);
  const when = formatWhen(newStartsAt, tz);
  await logActivity({
    projectId: meeting.projectId,
    contactId: meeting.contactId,
    kind: "meeting",
    title: `${meeting.title} rescheduled to ${when}`,
    body: `Was ${was}`,
    meta: { meetingId: meeting.id },
  });
  const s = await getSettings();
  const mail = await sendEmail({
    to: meeting.email,
    subject: `Rescheduled — ${meeting.title}, ${when}`,
    body: `Hi ${meeting.name.split(/\s+/)[0]},\n\nAll set — your ${meeting.title} is now:\n\n**${when}**\n${type ? locationLine(type, meeting.phone) : ""}\n\nChange it again any time:\n${manageUrl}\n\nWith love,\n${s.business.photographer}`,
    projectId: meeting.projectId,
    contactId: meeting.contactId,
    replyTo: s.business.email || undefined,
  });
  await notifyStudio(
    `Rescheduled — ${meeting.title} with ${meeting.name}`,
    `${meeting.name} moved their ${meeting.title}.\n\nNow: ${when}\nWas: ${was}`,
    { projectId: meeting.projectId, contactId: meeting.contactId },
  );
  return { ok: true, meeting: updated, manageUrl, emailStatus: mail.status };
}
