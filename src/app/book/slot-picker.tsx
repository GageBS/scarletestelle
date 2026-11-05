"use client";
/* Date strip + time slots, shown in the studio time zone (always labelled). */
import { useMemo, useState } from "react";
import { dayToDate } from "@/lib/format";
import type { SlotsPayload } from "./actions";

const fmt = (day: string, o: Intl.DateTimeFormatOptions) =>
  dayToDate(day).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });

export function SlotPicker({
  data,
  selected,
  onSelect,
}: {
  data: SlotsPayload;
  selected: number | null;
  onSelect: (startsAt: number) => void;
}) {
  const [day, setDay] = useState<string | null>(data.days[0]?.day ?? null);
  // keep the chosen day valid after a refresh of the slot list
  const active = data.days.find((d) => d.day === day) ?? data.days[0] ?? null;
  const months = useMemo(() => {
    const seen: string[] = [];
    for (const d of data.days) {
      const m = fmt(d.day, { month: "long", year: "numeric" });
      if (!seen.includes(m)) seen.push(m);
    }
    return seen;
  }, [data.days]);

  if (data.days.length === 0) {
    return (
      <div className="rounded-sm border border-rule bg-cream px-5 py-8 text-center">
        <p className="script text-4xl text-scarlet">No openings just now</p>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          Every time is currently taken. Please check back soon, or send me a note and I&apos;ll find a time that
          works.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="label text-muted">{months.join(" · ")}</p>
      <div
        className="no-scrollbar -mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        role="listbox"
        aria-label="Choose a day"
      >
        {data.days.map((d) => {
          const on = active?.day === d.day;
          return (
            <button
              key={d.day}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => setDay(d.day)}
              className={`flex min-h-[4.5rem] w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center rounded-sm border px-2 py-2 font-sans transition ${
                on ? "border-ink bg-ink text-cream" : "border-rule bg-cream text-ink hover:border-ink"
              }`}
            >
              <span className="label text-[0.6rem] opacity-70">{fmt(d.day, { weekday: "short" })}</span>
              <span className="display text-2xl leading-none">{fmt(d.day, { day: "numeric" })}</span>
              <span className="label text-[0.6rem] opacity-70">{fmt(d.day, { month: "short" })}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-6">
          <p className="font-sans text-sm text-ink-soft">
            {fmt(active.day, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {active.slots.map((s) => {
              const on = selected === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelect(s.startsAt)}
                  className={`min-h-12 rounded-sm border px-3 font-sans text-[0.95rem] transition ${
                    on ? "border-scarlet bg-scarlet text-cream" : "border-rule bg-cream text-ink hover:border-scarlet"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="mt-4 font-sans text-xs text-muted">
            All times shown in <strong className="font-medium text-ink-soft">{data.zoneLong}</strong> (
            {data.zoneShort}) — {data.tz.replace("_", " ")}.
          </p>
        </div>
      )}
    </div>
  );
}
