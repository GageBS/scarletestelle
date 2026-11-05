"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { QField } from "@/lib/constants";
import { saveDraft, submitQuestionnaire } from "./actions";

type Answers = Record<string, string | string[]>;

export function QuestionnaireForm({
  token,
  qtoken,
  fields,
  initialAnswers,
}: {
  token: string;
  qtoken: string;
  fields: QField[];
  initialAnswers: Answers;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitted, setSubmitted] = useState(false);
  const [pending, start] = useTransition();
  const dirty = useRef(false);
  const latest = useRef(answers);
  useEffect(() => {
    latest.current = answers;
  }, [answers]);

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    try {
      const r = await saveDraft(token, qtoken, latest.current);
      setSaveState(r.ok ? "saved" : "error");
    } catch {
      dirty.current = true;
      setSaveState("error");
    }
  }, [token, qtoken]);

  // debounced autosave
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(flush, 1200);
    return () => clearTimeout(t);
  }, [answers, flush]);

  // save when the tab is hidden / page closed
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  function set(id: string, v: string | string[]) {
    dirty.current = true;
    setSaveState("idle");
    setMissing((m) => m.filter((x) => x !== id));
    setAnswers((a) => ({ ...a, [id]: v }));
  }

  function toggle(id: string, opt: string) {
    const cur = Array.isArray(answers[id]) ? (answers[id] as string[]) : [];
    set(id, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  }

  function isEmpty(f: QField) {
    const v = answers[f.id];
    return Array.isArray(v) ? v.length === 0 : !v || v.trim() === "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lacking = fields.filter((f) => f.type !== "heading" && f.required && isEmpty(f)).map((f) => f.id);
    if (lacking.length) {
      setMissing(lacking);
      setError("Please answer the questions marked with a star.");
      document.getElementById(`q-${lacking[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    start(async () => {
      dirty.current = false;
      const r = await submitQuestionnaire(token, qtoken, answers);
      if (r.ok) {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(r.error);
        if (r.missing) setMissing(r.missing);
      }
    });
  }

  if (submitted) {
    return (
      <div className="mt-10 rounded-sm border border-rule bg-cream px-6 py-12 text-center">
        <p className="script inked text-5xl text-scarlet">Thank you</p>
        <p className="mx-auto mt-4 max-w-md text-[1.08rem] text-ink-soft">
          I have everything I need. I&apos;ll read it all carefully and be in touch soon if I have questions.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="label mt-6 text-scarlet underline underline-offset-4"
        >
          View my answers
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-10 space-y-8 rounded-sm border border-rule bg-cream p-5 sm:p-8">
      {fields.map((f) => {
        if (f.type === "heading")
          return (
            <h2 key={f.id} className="display border-b border-rule pb-2 pt-4 text-2xl first:pt-0">
              {f.label}
            </h2>
          );
        const bad = missing.includes(f.id);
        const v = answers[f.id];
        const text = typeof v === "string" ? v : "";
        return (
          <div key={f.id} id={`q-${f.id}`} className={bad ? "rounded-sm ring-1 ring-scarlet/60 ring-offset-8 ring-offset-cream" : ""}>
            <label htmlFor={`in-${f.id}`} className="block text-[1.08rem] leading-snug">
              {f.label}
              {f.required && <span className="text-scarlet"> *</span>}
            </label>
            {f.help && <p className="mt-1 font-sans text-sm text-muted">{f.help}</p>}
            <div className="mt-2">
              {f.type === "text" && (
                <input id={`in-${f.id}`} className="field" value={text} onChange={(e) => set(f.id, e.target.value)} />
              )}
              {f.type === "textarea" && (
                <textarea id={`in-${f.id}`} className="field" value={text} onChange={(e) => set(f.id, e.target.value)} />
              )}
              {f.type === "date" && (
                <input id={`in-${f.id}`} type="date" className="field" value={text} onChange={(e) => set(f.id, e.target.value)} />
              )}
              {f.type === "time" && (
                <input id={`in-${f.id}`} type="time" className="field" value={text} onChange={(e) => set(f.id, e.target.value)} />
              )}
              {f.type === "select" && (
                <select id={`in-${f.id}`} className="field" value={text} onChange={(e) => set(f.id, e.target.value)}>
                  <option value="">Choose…</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
              {f.type === "checkboxes" && (
                <div className="space-y-1" role="group" aria-labelledby={`q-${f.id}`}>
                  {(f.options ?? []).map((o) => {
                    const on = Array.isArray(v) && v.includes(o);
                    return (
                      <label
                        key={o}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-1 py-1.5 hover:bg-parchment/70"
                      >
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 accent-scarlet"
                          checked={on}
                          onChange={() => toggle(f.id, o)}
                        />
                        <span>{o}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {error && (
        <p role="alert" className="rounded-sm border border-scarlet/40 bg-scarlet/10 px-4 py-3 font-sans text-sm text-scarlet">
          {error}
        </p>
      )}
      <div className="space-y-3 border-t border-rule pt-6">
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-center rounded-sm bg-scarlet px-6 font-sans text-[0.78rem] uppercase tracking-[0.2em] text-cream transition hover:bg-wine disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send to Scarlet"}
        </button>
        <p className="text-center font-sans text-xs text-muted" aria-live="polite">
          {saveState === "saving" && "Saving your progress…"}
          {saveState === "saved" && "Progress saved — you can come back to this link any time."}
          {saveState === "error" && "Couldn't save just now — we'll try again as you type."}
          {saveState === "idle" && "Your answers save automatically as you go."}
        </p>
      </div>
    </form>
  );
}
