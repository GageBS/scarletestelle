"use client";
import { useState, useTransition } from "react";
import { STAGES } from "@/lib/constants";
import { Input, Select, Button, cx } from "@/components/studio/ui";

type MoveAction = (
  projectId: string,
  stage: string,
  reason?: string,
) => Promise<{ error?: string } | void>;

/** "Move to…" select. Choosing "Not booked" asks for a reason first (no browser dialogs). */
export function StageMover({
  projectId,
  stage,
  action,
  compact = false,
  label = "Move to…",
}: {
  projectId: string;
  stage: string;
  action: MoveAction;
  compact?: boolean;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [sel, setSel] = useState(compact ? "" : stage);
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const base = compact ? "" : stage;

  function run(next: string, why?: string) {
    setError(null);
    start(async () => {
      const r = await action(projectId, next, why);
      if (r && "error" in r && r.error) {
        setError(r.error);
        setSel(base);
      }
      setAskReason(false);
      setReason("");
    });
  }

  return (
    <div className="space-y-2">
      <Select
        aria-label={label}
        value={sel}
        disabled={pending}
        className={cx(compact && "min-h-11 py-1 text-sm md:min-h-9")}
        onChange={(e) => {
          const next = e.target.value;
          setSel(next);
          if (next === "" || next === stage) {
            setAskReason(false);
            return;
          }
          if (next === "lost") {
            setAskReason(true);
            return;
          }
          setAskReason(false);
          run(next);
        }}
      >
        {compact && <option value="">{label}</option>}
        {STAGES.filter((s) => !compact || s.value !== stage).map((s) => (
          <option key={s.value} value={s.value}>
            {!compact && s.value === stage ? `${s.label} (current)` : s.label}
          </option>
        ))}
      </Select>
      {askReason && (
        <div className="space-y-2 rounded-sm border border-rule bg-parchment/60 p-3">
          <label className="label block text-ink-soft" htmlFor={`why-${projectId}`}>
            Why didn’t this one book?
          </label>
          <Input
            id={`why-${projectId}`}
            value={reason}
            maxLength={300}
            placeholder="Budget, date taken, went another way…"
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={pending || !reason.trim()}
              onClick={() => run("lost", reason.trim())}
            >
              {pending ? "Saving…" : "Mark not booked"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAskReason(false);
                setSel(base);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="font-sans text-xs text-scarlet">
          {error}
        </p>
      )}
    </div>
  );
}
