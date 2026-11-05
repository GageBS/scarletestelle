"use client";
import { useState, type ReactNode } from "react";
import { cx } from "@/components/studio/ui";

type Side = { title: string; points: string[] };

/**
 * Film vs Digital comparison. Laptop: side by side with "both" underneath.
 * iPhone: a three-way toggle (Film · Digital · Both) so it never feels long.
 */
export function FilmDigitalCompare({
  film,
  digital,
  both,
  filmVisual,
  digitalVisual,
}: {
  film: Side;
  digital: Side;
  both: { title: string; body: string };
  filmVisual: ReactNode;
  digitalVisual: ReactNode;
}) {
  const [tab, setTab] = useState<"film" | "digital" | "both">("film");

  const column = (s: Side, visual: ReactNode, tone: "film" | "digital") => (
    <div className="flex flex-col gap-6">
      {visual}
      <div>
        <h3 className="display text-[2rem] uppercase tracking-[0.08em]">{s.title}</h3>
        <ul className="mt-4 space-y-3">
          {s.points.map((p) => (
            <li key={p} className="flex gap-3 text-[1.1rem] leading-snug">
              <span aria-hidden className={cx("mt-2 size-1.5 shrink-0 rounded-full", tone === "film" ? "bg-scarlet" : "bg-ink")} />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div>
      {/* mobile toggle */}
      <div className="mb-8 flex justify-center gap-1 md:hidden" role="tablist">
        {(["film", "digital", "both"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx(
              "label rounded-full px-5 py-2.5 transition",
              tab === t ? "bg-ink text-cream" : "text-ink-soft",
            )}
          >
            {t === "film" ? "Film" : t === "digital" ? "Digital" : "Both"}
          </button>
        ))}
      </div>
      <div className="md:hidden">
        {tab === "film" && column(film, filmVisual, "film")}
        {tab === "digital" && column(digital, digitalVisual, "digital")}
        {tab === "both" && (
          <div className="border border-rule bg-cream p-6">
            <h3 className="script inked text-[2.6rem] text-scarlet">{both.title}</h3>
            <p className="mt-4 text-[1.15rem] leading-relaxed">{both.body}</p>
          </div>
        )}
      </div>

      {/* laptop: side by side */}
      <div className="hidden gap-16 md:grid md:grid-cols-2">
        {column(film, filmVisual, "film")}
        <div className="md:mt-24">{column(digital, digitalVisual, "digital")}</div>
      </div>
      <div className="mx-auto mt-16 hidden max-w-3xl border-y border-rule py-10 text-center md:block">
        <h3 className="script inked text-[3.4rem] leading-none text-scarlet">{both.title}</h3>
        <p className="mt-5 text-[1.25rem] leading-relaxed">{both.body}</p>
      </div>
    </div>
  );
}
