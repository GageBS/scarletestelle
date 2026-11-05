"use client";
/* Contract template editor: markdown body, merge-field helper (tap to insert at the
   cursor) and a live preview filled with sample data. */
import { useActionState, useRef, useState } from "react";
import { Field, Input, Notice, Select, Textarea, cx } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { Markdown } from "@/components/money/markdown";
import { fillFields } from "@/lib/billing-math";
import { PROJECT_TYPES } from "@/lib/constants";
import { saveTemplate, type FormState } from "../../actions";

export function TemplateEditor({
  id,
  initial,
  sample,
  fields,
}: {
  id?: string;
  initial: { name: string; projectType: string; body: string };
  sample: Record<string, string>;
  fields: { key: string; label: string; group: string }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(saveTemplate, {});
  const [body, setBody] = useState(initial.body);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (key: string) => {
    const ta = ref.current;
    const token = `{{${key}}}`;
    const start = ta?.selectionStart ?? body.length;
    const end = ta?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    setView("edit");
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const unknown = [...new Set([...body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]))].filter(
    (k) => !(k in sample),
  );
  const groups = [...new Set(fields.map((f) => f.group))];

  return (
    <form action={action} className="flex flex-col gap-5">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
        <Field label="Template name">
          <Input name="name" defaultValue={initial.name} required placeholder="Wedding Photography Agreement" />
        </Field>
        <Field label="Use for">
          <Select name="projectType" defaultValue={initial.projectType}>
            <option value="any">Any session type</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {body.includes("Have a licensed attorney") && (
        <Notice tone="warn">
          This template still has the attorney-review note at the top. Have a licensed attorney in your state review
          it, then delete that line before you send it to clients — it&apos;s part of what they sign.
        </Notice>
      )}
      {unknown.length > 0 && (
        <Notice tone="warn">
          Unknown merge field{unknown.length > 1 ? "s" : ""}: {unknown.map((k) => `{{${k}}}`).join(", ")} — these
          will appear exactly as typed.
        </Notice>
      )}

      {/* mobile: switch between editing and preview */}
      <div className="flex gap-1 lg:hidden">
        {(["edit", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cx(
              "min-h-10 flex-1 rounded-sm border font-sans text-[0.72rem] uppercase tracking-[0.16em]",
              view === v ? "border-ink bg-ink text-cream" : "border-rule text-ink-soft",
            )}
          >
            {v === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cx(view === "preview" && "hidden lg:block")}>
          <Field label="Contract (Markdown)" hint="# Heading · ## Section · - bullet · **bold** · *italic* · > note">
            <Textarea
              ref={ref}
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck
              className="min-h-[60dvh] font-mono text-[0.85rem] leading-relaxed"
            />
          </Field>
          <details className="mt-3 rounded-sm border border-rule bg-cream p-3" open>
            <summary className="label cursor-pointer text-ink-soft">Merge fields — tap to insert</summary>
            <div className="mt-3 flex flex-col gap-3">
              {groups.map((g) => (
                <div key={g}>
                  <p className="label mb-1 text-[0.6rem] text-muted">{g}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {fields
                      .filter((f) => f.group === g)
                      .map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => insert(f.key)}
                          title={f.label}
                          className="min-h-9 rounded-sm border border-rule bg-parchment/60 px-2 font-mono text-[0.72rem] text-wine hover:border-scarlet"
                        >
                          {`{{${f.key}}}`}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className={cx(view === "edit" && "hidden lg:block")}>
          <p className="label mb-1 text-ink-soft">Live preview · sample client</p>
          <div className="max-h-[75dvh] overflow-y-auto rounded-sm border border-rule bg-cream px-5 py-4">
            <Markdown text={fillFields(body, sample)} highlightFields className="doc-prose text-[0.98rem]" />
          </div>
        </div>
      </div>

      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 rounded-sm border border-rule bg-cream/95 p-3 backdrop-blur lg:bottom-4">
        <SubmitButton>{id ? "Save template" : "Create template"}</SubmitButton>
        {state.ok && <span className="font-sans text-sm text-moss-deep">{state.ok} ✓</span>}
        {state.error && <span className="font-sans text-sm text-scarlet">{state.error}</span>}
      </div>
    </form>
  );
}
