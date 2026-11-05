"use client";
/* The pipeline board. Desktop: columns with drag-and-drop. Mobile: stage chips + one list. */
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Badge, cx } from "@/components/studio/ui";
import { StageMover } from "../_crm/stage-mover";

export type BoardCard = {
  id: string;
  title: string;
  type: string; // label
  stage: string;
  date: string; // formatted, "" when TBD
  dateNote: string;
  value: string; // formatted, "" when 0
  daysInStage: number;
  isSample: boolean;
};
export type BoardStage = { value: string; label: string };

type Move = (projectId: string, stage: string, reason?: string) => Promise<{ error?: string }>;

function Card({
  c,
  move,
  draggable,
  onDragStart,
}: {
  c: BoardCard;
  move: Move;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={cx(
        "rounded-sm border border-rule bg-cream p-3 shadow-[0_1px_0_rgb(42_18_19/0.04)]",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <Link href={`/studio/projects/${c.id}`} className="block">
        <p className="font-sans text-[0.95rem] leading-snug text-ink">{c.title}</p>
        <p className="mt-1 font-sans text-xs text-ink-soft">
          {c.type}
          {c.date ? ` · ${c.date}` : c.dateNote ? ` · ${c.dateNote}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-muted">
          {c.value && <span className="text-ink">{c.value}</span>}
          <span>{c.daysInStage === 0 ? "today" : `${c.daysInStage}d in stage`}</span>
          {c.isSample && <Badge>Sample</Badge>}
        </div>
      </Link>
      <div className="mt-3">
        <StageMover projectId={c.id} stage={c.stage} action={move} compact />
      </div>
    </div>
  );
}

export function Board({
  stages,
  cards,
  move,
}: {
  stages: BoardStage[];
  cards: BoardCard[];
  move: Move;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    cards,
    (cur, m: { id: string; stage: string }) =>
      cur.map((c) => (c.id === m.id ? { ...c, stage: m.stage, daysInStage: 0 } : c)),
  );
  const [, start] = useTransition();
  const [active, setActive] = useState(stages[0]?.value ?? "");
  const [over, setOver] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const byStage = (st: string) => optimistic.filter((c) => c.stage === st);

  function drop(stage: string, id: string) {
    setOver(null);
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    setDropError(null);
    start(async () => {
      setOptimistic({ id, stage });
      const r = await move(id, stage);
      if (r?.error) setDropError(r.error);
    });
  }

  return (
    <div>
      {dropError && (
        <p role="alert" className="mb-3 font-sans text-sm text-scarlet">
          {dropError}
        </p>
      )}

      {/* mobile: stage chips */}
      <div className="md:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3" role="tablist" aria-label="Pipeline stages">
          {stages.map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={active === s.value}
              onClick={() => setActive(s.value)}
              className={cx(
                "min-h-11 shrink-0 rounded-full border px-4 font-sans text-xs uppercase tracking-[0.12em] transition",
                active === s.value
                  ? "border-ink bg-ink text-cream"
                  : "border-rule bg-cream text-ink-soft",
              )}
            >
              {s.label} <span className="opacity-70">{byStage(s.value).length}</span>
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {byStage(active).length === 0 ? (
            <p className="rounded-sm border border-dashed border-rule px-4 py-10 text-center font-sans text-sm text-muted">
              Nothing in this stage.
            </p>
          ) : (
            byStage(active).map((c) => <Card key={c.id} c={c} move={move} />)
          )}
        </div>
      </div>

      {/* desktop: columns */}
      <div className="-mx-1 hidden gap-3 overflow-x-auto px-1 pb-4 md:flex">
        {stages.map((s) => {
          const list = byStage(s.value);
          const canDrop = s.value !== "lost";
          return (
            <div
              key={s.value}
              onDragOver={(e) => {
                if (!canDrop) return;
                e.preventDefault();
                setOver(s.value);
              }}
              onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
              onDrop={(e) => {
                if (!canDrop) return;
                e.preventDefault();
                drop(s.value, e.dataTransfer.getData("text/plain"));
              }}
              className={cx(
                "w-72 shrink-0 rounded-sm border bg-linen/50 p-2 transition",
                over === s.value ? "border-scarlet bg-blush/40" : "border-rule",
              )}
            >
              <div className="flex items-center justify-between px-1 pb-2 pt-1">
                <h2 className="label text-ink">{s.label}</h2>
                <span className="font-sans text-xs text-muted">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((c) => (
                  <Card
                    key={c.id}
                    c={c}
                    move={move}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  />
                ))}
                {list.length === 0 && (
                  <p className="px-2 py-6 text-center font-sans text-xs text-muted">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1 hidden font-sans text-xs text-muted md:block">
        Drag a card to another column, or use “Move to…”. Marking a project not booked needs a reason, so use the menu for that.
      </p>
    </div>
  );
}
