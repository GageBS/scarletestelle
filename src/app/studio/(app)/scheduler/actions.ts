"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId, slugify } from "@/lib/ids";
import { getSettings, saveSettings } from "@/lib/settings";
import { cancelMeeting } from "@/lib/scheduler";
import type { WeeklyHours } from "@/lib/constants";

const BASE = "/studio/scheduler";
const done = (ok: string): never => {
  revalidatePath(BASE);
  revalidatePath("/studio/calendar");
  revalidatePath("/book");
  redirect(`${BASE}?ok=${encodeURIComponent(ok)}`);
};
const fail = (err: string): never => redirect(`${BASE}?err=${encodeURIComponent(err)}`);

const typeSchema = z.object({
  name: z.string().trim().min(1, "Give the meeting a name").max(120),
  slug: z.string().trim().max(60).default(""),
  durationMin: z.coerce.number().int().min(5, "Duration must be at least 5 minutes").max(480),
  location: z.enum(["phone", "video", "in_person"]),
  locationDetail: z.string().trim().max(400).default(""),
  description: z.string().trim().max(1000).default(""),
  sort: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveMeetingType(formData: FormData) {
  await requireStudio();
  const id = String(formData.get("id") ?? "");
  const p = typeSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form");
  const v = p.data;
  const slug = slugify(v.slug || v.name);
  if (!slug) return fail("Please give the meeting a link name (letters and numbers)");
  const clash = await db.query.meetingTypes.findFirst({
    where: id
      ? and(eq(schema.meetingTypes.slug, slug), ne(schema.meetingTypes.id, id))
      : eq(schema.meetingTypes.slug, slug),
  });
  if (clash) return fail(`The link name "${slug}" is already used by "${clash.name}"`);
  const active = formData.get("active") === "on";
  const row = { ...v, slug, active };
  if (id) {
    await db.update(schema.meetingTypes).set(row).where(eq(schema.meetingTypes.id, id));
    return done(`Saved "${v.name}".`);
  }
  await db.insert(schema.meetingTypes).values({ id: newId(), ...row });
  return done(`Added "${v.name}".`);
}

export async function deleteMeetingType(formData: FormData) {
  await requireStudio();
  const id = String(formData.get("id") ?? "");
  await db.delete(schema.meetingTypes).where(eq(schema.meetingTypes.id, id));
  return done("Meeting type removed. Existing bookings are kept.");
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use times like 09:00");
const weeklySchema = z.object(
  Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
      d,
      z.array(z.object({ start: hhmm, end: hhmm })).max(6),
    ]),
  ) as Record<keyof WeeklyHours, z.ZodArray<z.ZodObject<{ start: z.ZodString; end: z.ZodString }>>>,
);

export async function saveAvailability(formData: FormData) {
  await requireStudio();
  let weekly: WeeklyHours;
  try {
    weekly = weeklySchema.parse(JSON.parse(String(formData.get("weekly") ?? "{}"))) as WeeklyHours;
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Check your hours") : "Check your hours");
  }
  for (const [day, ranges] of Object.entries(weekly))
    for (const r of ranges) if (r.start >= r.end) return fail(`${day.toUpperCase()}: a range must end after it starts`);
  const n = z.object({
    minNoticeHours: z.coerce.number().int().min(0).max(24 * 60),
    bufferMin: z.coerce.number().int().min(0).max(240),
    horizonDays: z.coerce.number().int().min(1).max(365),
    maxPerDay: z.coerce.number().int().min(0).max(50),
  });
  const p = n.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the numbers");
  await getSettings(); // ensure settings table readable
  await saveSettings("availability", { weekly, ...p.data });
  return done("Availability saved.");
}

export async function addBlockedDate(formData: FormData) {
  await requireStudio();
  const date = String(formData.get("date") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 200);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Choose a date to block");
  const exists = await db.query.blockedDates.findFirst({ where: eq(schema.blockedDates.date, date) });
  if (!exists) await db.insert(schema.blockedDates).values({ id: newId(), date, reason });
  return done("Date blocked.");
}

export async function removeBlockedDate(formData: FormData) {
  await requireStudio();
  await db.delete(schema.blockedDates).where(eq(schema.blockedDates.id, String(formData.get("id") ?? "")));
  return done("Date is open again.");
}

export async function cancelMeetingAction(formData: FormData) {
  await requireStudio();
  const m = await db.query.meetings.findFirst({
    where: eq(schema.meetings.id, String(formData.get("id") ?? "")),
  });
  if (!m) return fail("Meeting not found");
  const r = await cancelMeeting(m, "studio");
  if (!r.ok) return fail(r.error);
  return done("Meeting cancelled and the client was emailed.");
}

export async function completeMeetingAction(formData: FormData) {
  await requireStudio();
  await db
    .update(schema.meetings)
    .set({ status: "completed" })
    .where(eq(schema.meetings.id, String(formData.get("id") ?? "")));
  return done("Marked complete.");
}
