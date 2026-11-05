import type { Metadata } from "next";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings, siteUrl } from "@/lib/settings";
import { formatWhen, hoursAgo, zoneLabel } from "@/lib/scheduler";
import { formatDay } from "@/lib/format";
import {
  Badge,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  Textarea,
} from "@/components/studio/ui";
import { ConfirmButton, CopyButton, SubmitButton } from "@/components/studio/client-ui";
import { AvailabilityEditor } from "./availability-editor";
import {
  addBlockedDate,
  cancelMeetingAction,
  completeMeetingAction,
  deleteMeetingType,
  removeBlockedDate,
  saveAvailability,
  saveMeetingType,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scheduler" };

type MType = typeof schema.meetingTypes.$inferSelect;

function TypeForm({ t }: { t?: MType }) {
  return (
    <form action={saveMeetingType} className="space-y-4">
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <Input name="name" required defaultValue={t?.name} placeholder="Consultation call" />
        </Field>
        <Field label="Link name" hint="Used in the booking link: /book/…  (leave blank to match the name)">
          <Input name="slug" defaultValue={t?.slug} placeholder="consultation" />
        </Field>
        <Field label="Length (minutes)">
          <Input name="durationMin" type="number" inputMode="numeric" min={5} required defaultValue={t?.durationMin ?? 30} />
        </Field>
        <Field label="Where">
          <Select name="location" defaultValue={t?.location ?? "video"}>
            <option value="video">Video call</option>
            <option value="phone">Phone call</option>
            <option value="in_person">In person</option>
          </Select>
        </Field>
      </div>
      <Field label="Where — details" hint="Zoom/Meet link, address, or notes. Included in the confirmation email.">
        <Input name="locationDetail" defaultValue={t?.locationDetail} placeholder="https://zoom.us/j/…" />
      </Field>
      <Field label="Description" hint="Shown on the booking page">
        <Textarea name="description" defaultValue={t?.description} rows={3} />
      </Field>
      <div className="flex flex-wrap items-center gap-6">
        <Checkbox name="active" label="Show on my booking page" defaultChecked={t ? t.active : true} />
        <Field label="Order" className="w-24">
          <Input name="sort" type="number" inputMode="numeric" min={0} defaultValue={t?.sort ?? 0} />
        </Field>
      </div>
      <SubmitButton>{t ? "Save changes" : "Add meeting type"}</SubmitButton>
    </form>
  );
}

export default async function SchedulerPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const s = await getSettings();
  const tz = s.business.timezone;
  const [types, blocked, upcoming] = await Promise.all([
    db.query.meetingTypes.findMany({ orderBy: [asc(schema.meetingTypes.sort), asc(schema.meetingTypes.name)] }),
    db.query.blockedDates.findMany({ orderBy: asc(schema.blockedDates.date) }),
    db.query.meetings.findMany({
      where: and(
        eq(schema.meetings.status, "scheduled"),
        gte(schema.meetings.startsAt, hoursAgo(3)),
      ),
      orderBy: asc(schema.meetings.startsAt),
      limit: 50,
    }),
  ]);
  const publicUrl = `${siteUrl()}/book`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow"
        title="Scheduler"
        description="Let clients book calls with you. Times are in your studio time zone."
      />
      {sp.ok && <Notice tone="ok">{sp.ok}</Notice>}
      {sp.err && <Notice tone="bad">{sp.err}</Notice>}

      <Card title="Your booking link">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <code className="min-w-0 flex-1 break-all rounded-sm bg-linen px-3 py-2 font-sans text-sm">{publicUrl}</code>
          <CopyButton text={publicUrl} />
        </div>
        <p className="mt-2 font-sans text-xs text-muted">
          Studio time zone: {zoneLabel(tz).long} ({tz}). Change it in Settings.
        </p>
      </Card>

      <Card title={`Upcoming meetings (${upcoming.length})`} pad={false}>
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing booked yet">New bookings will appear here and on your calendar.</EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {upcoming.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium">
                    {m.title} · {m.name}
                  </p>
                  <p className="font-sans text-sm text-ink-soft">{formatWhen(m.startsAt.getTime(), tz)}</p>
                  <p className="break-words font-sans text-xs text-muted">
                    {m.email}
                    {m.phone && ` · ${m.phone}`}
                    {m.notes && ` · “${m.notes}”`}
                  </p>
                  <div className="mt-1 flex gap-2">
                    {m.projectId && <Badge tone="ok">linked to a project</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={completeMeetingAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <SubmitButton variant="secondary">Done</SubmitButton>
                  </form>
                  <form action={cancelMeetingAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmButton confirmText="Cancel & email client?">Cancel</ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Meeting types">
        <div className="space-y-4">
          {types.map((t) => (
            <details key={t.id} className="group rounded-sm border border-rule bg-parchment/40">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-sans text-sm font-medium">{t.name}</span>
                  <span className="block font-sans text-xs text-muted">
                    {t.durationMin} min · {t.location.replace("_", " ")} · /book/{t.slug}
                  </span>
                </span>
                {t.active ? <Badge tone="ok">Live</Badge> : <Badge>Hidden</Badge>}
              </summary>
              <div className="space-y-4 border-t border-rule px-4 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <code className="min-w-0 flex-1 break-all rounded-sm bg-linen px-3 py-2 font-sans text-xs">
                    {siteUrl()}/book/{t.slug}
                  </code>
                  <CopyButton text={`${siteUrl()}/book/${t.slug}`} />
                </div>
                <TypeForm t={t} />
                <form action={deleteMeetingType}>
                  <input type="hidden" name="id" value={t.id} />
                  <ConfirmButton confirmText="Tap again to delete">Delete this meeting type</ConfirmButton>
                </form>
              </div>
            </details>
          ))}
          <details className="rounded-sm border border-dashed border-rose" open={types.length === 0}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 font-sans text-sm text-scarlet">
              + Add a meeting type
            </summary>
            <div className="border-t border-rule px-4 py-4">
              <TypeForm />
            </div>
          </details>
        </div>
      </Card>

      <Card title="Weekly availability & booking rules">
        <AvailabilityEditor
          initial={s.availability.weekly}
          numbers={{
            minNoticeHours: s.availability.minNoticeHours,
            bufferMin: s.availability.bufferMin,
            horizonDays: s.availability.horizonDays,
            maxPerDay: s.availability.maxPerDay,
          }}
          action={saveAvailability}
          zone={tz}
        />
        <p className="mt-4 font-sans text-xs text-muted">
          Days that already have a booked session or wedding are automatically unavailable.
        </p>
      </Card>

      <Card title="Days off">
        <form action={addBlockedDate} className="flex flex-col gap-3 md:flex-row md:items-end">
          <Field label="Date">
            <Input type="date" name="date" required />
          </Field>
          <Field label="Reason (just for you)" className="md:flex-1">
            <Input name="reason" placeholder="Vacation, family, …" />
          </Field>
          <SubmitButton>Block date</SubmitButton>
        </form>
        {blocked.length > 0 && (
          <ul className="mt-4 divide-y divide-rule/70">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-sans text-sm">
                  {formatDay(b.date, "long")}
                  {b.reason && <span className="text-muted"> · {b.reason}</span>}
                </span>
                <form action={removeBlockedDate}>
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton variant="ghost">Remove</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
