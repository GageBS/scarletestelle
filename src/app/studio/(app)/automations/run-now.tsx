"use client";
import { useActionState } from "react";
import { Notice } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { runNowAction, type RunNowState } from "./actions";

export function RunNow() {
  const [state, action] = useActionState<RunNowState, FormData>(() => runNowAction(), null);
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="secondary" pendingText="Running…">
          Run timed automations now
        </SubmitButton>
        <p className="font-sans text-xs text-muted">
          Normally runs by itself once a day. Safe to press — each automation only ever fires once per client.
        </p>
      </form>
      {state?.error && <Notice tone="bad">Something went wrong: {state.error}</Notice>}
      {state?.ran && !state.error && (
        <Notice tone={state.report.some((r) => r.status === "failed") ? "warn" : "ok"}>
          {state.report.length === 0 ? (
            "Nothing was due right now."
          ) : (
            <div>
              <p className="mb-1 font-medium">{state.report.length} automation(s) ran:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {state.report.map((r, i) => (
                  <li key={i}>
                    <strong>{r.automation}</strong> · {r.project} · {r.status} — {r.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Notice>
      )}
    </div>
  );
}
