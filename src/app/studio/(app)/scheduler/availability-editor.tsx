"use client";
import { useState } from "react";
import type { TimeRange, WeeklyHours } from "@/lib/constants";
import { Button, Field, Input } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";

const DAYS: { key: keyof WeeklyHours; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export function AvailabilityEditor({
  initial,
  numbers,
  action,
  zone,
}: {
  initial: WeeklyHours;
  numbers: { minNoticeHours: number; bufferMin: number; horizonDays: number; maxPerDay: number };
  action: (fd: FormData) => Promise<void>;
  zone: string;
}) {
  const [weekly, setWeekly] = useState<WeeklyHours>(initial);

  const setRanges = (d: keyof WeeklyHours, f: (r: TimeRange[]) => TimeRange[]) =>
    setWeekly((w) => ({ ...w, [d]: f(w[d]) }));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="weekly" value={JSON.stringify(weekly)} />
      <p className="font-sans text-xs text-muted">Hours are in your studio time zone ({zone}).</p>
      <ul className="divide-y divide-rule/70">
        {DAYS.map(({ key, label }) => (
          <li key={key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
            <p className="w-28 shrink-0 pt-2 font-sans text-sm">{label}</p>
            <div className="flex-1 space-y-2">
              {weekly[key].length === 0 && <p className="pt-2 font-sans text-sm text-muted">Unavailable</p>}
              {weekly[key].map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`${label} start`}
                    value={r.start}
                    onChange={(e) =>
                      setRanges(key, (rs) => rs.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))
                    }
                    className="w-32"
                  />
                  <span className="text-muted">to</span>
                  <Input
                    type="time"
                    aria-label={`${label} end`}
                    value={r.end}
                    onChange={(e) =>
                      setRanges(key, (rs) => rs.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))
                    }
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Remove range"
                    onClick={() => setRanges(key, (rs) => rs.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setRanges(key, (rs) => [
                    ...rs,
                    rs.length ? { start: "13:00", end: "17:00" } : { start: "10:00", end: "17:00" },
                  ])
                }
              >
                + Add hours
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Min notice (hours)" hint="How soon before a call can be booked">
          <Input name="minNoticeHours" type="number" inputMode="numeric" min={0} defaultValue={numbers.minNoticeHours} />
        </Field>
        <Field label="Buffer (minutes)" hint="Gap before and after each call">
          <Input name="bufferMin" type="number" inputMode="numeric" min={0} defaultValue={numbers.bufferMin} />
        </Field>
        <Field label="Book up to (days)" hint="How far ahead people can book">
          <Input name="horizonDays" type="number" inputMode="numeric" min={1} defaultValue={numbers.horizonDays} />
        </Field>
        <Field label="Max calls per day" hint="0 = no limit">
          <Input name="maxPerDay" type="number" inputMode="numeric" min={0} defaultValue={numbers.maxPerDay} />
        </Field>
      </div>
      <SubmitButton>Save availability</SubmitButton>
    </form>
  );
}
