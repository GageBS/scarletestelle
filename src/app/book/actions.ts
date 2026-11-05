"use server";
/* Public (no login) booking actions — everything is re-validated server side. */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  bookMeeting,
  cancelMeetingByToken,
  getAvailableSlots,
  getMeetingByToken,
  rescheduleMeetingByToken,
  type SlotDay,
} from "@/lib/scheduler";
import { formatWhen } from "@/lib/scheduler";
import { getSettings } from "@/lib/settings";

export type SlotsPayload = { days: SlotDay[]; tz: string; zoneShort: string; zoneLong: string };

async function slotsFor(durationMin: number, excludeMeetingId?: string): Promise<SlotsPayload> {
  const r = await getAvailableSlots({ durationMin }, { excludeMeetingId });
  return { days: r.days, tz: r.tz, zoneShort: r.zone.short, zoneLong: r.zone.long };
}

export async function loadSlots(slug: string): Promise<SlotsPayload | null> {
  const t = await db.query.meetingTypes.findFirst({ where: eq(schema.meetingTypes.slug, slug) });
  if (!t || !t.active) return null;
  return slotsFor(t.durationMin);
}

export async function loadSlotsForManage(token: string): Promise<SlotsPayload | null> {
  const f = await getMeetingByToken(token);
  if (!f || f.meeting.status !== "scheduled") return null;
  const dur =
    f.type?.durationMin ?? Math.round((f.meeting.endsAt.getTime() - f.meeting.startsAt.getTime()) / 60_000);
  return slotsFor(dur, f.meeting.id);
}

export type BookState =
  | { ok: true; when: string; manageUrl: string; emailStatus: string; typeName: string }
  | { ok: false; error: string; slotTaken?: boolean };

export async function bookAction(input: {
  meetingTypeId: string;
  startsAt: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
}): Promise<BookState> {
  const r = await bookMeeting(input);
  if (!r.ok) return { ok: false, error: r.error, slotTaken: r.slotTaken };
  revalidatePath("/studio/scheduler");
  revalidatePath("/studio/calendar");
  const tz = (await getSettings()).business.timezone;
  return {
    ok: true,
    when: formatWhen(r.meeting.startsAt.getTime(), tz),
    manageUrl: r.manageUrl,
    emailStatus: r.emailStatus,
    typeName: r.meeting.title,
  };
}

export type ManageState = { ok: true; when?: string } | { ok: false; error: string; slotTaken?: boolean };

export async function cancelAction(token: string): Promise<ManageState> {
  const r = await cancelMeetingByToken(token);
  revalidatePath("/studio/scheduler");
  revalidatePath("/studio/calendar");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function rescheduleAction(token: string, startsAt: number): Promise<ManageState> {
  const r = await rescheduleMeetingByToken(token, startsAt);
  revalidatePath("/studio/scheduler");
  revalidatePath("/studio/calendar");
  if (!r.ok) return { ok: false, error: r.error, slotTaken: r.slotTaken };
  const tz = (await getSettings()).business.timezone;
  return { ok: true, when: formatWhen(r.meeting.startsAt.getTime(), tz) };
}
