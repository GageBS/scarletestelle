"use client";
import { useRef, useState } from "react";
import type { QField } from "@/lib/constants";
import { Button, Field, Input, Select, Textarea, cx } from "@/components/studio/ui";

const TYPES: { value: QField["type"]; label: string }[] = [
  { value: "text", label: "Short answer" },
  { value: "textarea", label: "Long answer" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "select", label: "Pick one (dropdown)" },
  { value: "checkboxes", label: "Pick any (checkboxes)" },
  { value: "heading", label: "Section heading" },
];

function Preview({ title, intro, fields }: { title: string; intro: string; fields: QField[] }) {
  return (
    <div className="rounded-sm border border-rule bg-parchment p-5">
      <p className="script text-4xl text-scarlet">{title || "Questionnaire"}</p>
      {intro && <p className="mt-3 whitespace-pre-line text-ink-soft">{intro}</p>}
      <div className="mt-6 space-y-5">
        {fields.map((f) =>
          f.type === "heading" ? (
            <h3 key={f.id} className="display border-b border-rule pb-1 pt-3 text-xl">
              {f.label}
            </h3>
          ) : (
            <div key={f.id}>
              <p className="font-sans text-sm">
                {f.label}
                {f.required && <span className="text-scarlet"> *</span>}
              </p>
              {f.help && <p className="font-sans text-xs text-muted">{f.help}</p>}
              <div className="mt-1.5">
                {f.type === "textarea" ? (
                  <div className="h-20 rounded-sm border border-rose bg-cream/60" />
                ) : f.type === "checkboxes" ? (
                  <ul className="space-y-1 font-sans text-sm">
                    {(f.options ?? []).map((o) => (
                      <li key={o}>☐ {o}</li>
                    ))}
                  </ul>
                ) : f.type === "select" ? (
                  <div className="rounded-sm border-b border-rose py-1.5 font-sans text-sm text-muted">
                    Choose… ({(f.options ?? []).join(" / ")})
                  </div>
                ) : (
                  <div className="h-8 border-b border-rose" />
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export function FieldsEditor({
  initial,
  title,
  intro,
}: {
  initial: QField[];
  title: string;
  intro: string;
}) {
  const [fields, setFields] = useState<QField[]>(initial);
  const [preview, setPreview] = useState(false);
  const counter = useRef(0);
  const [liveTitle, setLiveTitle] = useState(title);
  const [liveIntro, setLiveIntro] = useState(intro);

  const patch = (i: number, p: Partial<QField>) =>
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const c = [...fs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const add = (type: QField["type"]) =>
    setFields((fs) => [
      ...fs,
      {
        id: `f${Date.now().toString(36)}${counter.current++}`,
        label: type === "heading" ? "New section" : "New question",
        type,
        ...(type === "select" || type === "checkboxes" ? { options: ["Option 1", "Option 2"] } : {}),
      },
    ]);

  return (
    <div className="space-y-5">
      {/* these two mirror the server-form inputs for the live preview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title (clients see this)">
          <Input name="name" required defaultValue={title} onChange={(e) => setLiveTitle(e.target.value)} />
        </Field>
        <Field label="Intro (optional)" className="md:row-span-1">
          <Textarea
            name="intro"
            rows={3}
            defaultValue={intro}
            onChange={(e) => setLiveIntro(e.target.value)}
            placeholder="A short, warm note shown above the questions."
          />
        </Field>
      </div>

      <input type="hidden" name="fields" value={JSON.stringify(fields)} />

      <div className="flex items-center justify-between">
        <h3 className="label text-ink">Questions ({fields.filter((f) => f.type !== "heading").length})</h3>
        <Button type="button" variant="secondary" onClick={() => setPreview((p) => !p)}>
          {preview ? "Back to editing" : "Preview"}
        </Button>
      </div>

      {preview ? (
        <Preview title={liveTitle} intro={liveIntro} fields={fields} />
      ) : (
        <>
          <ol className="space-y-3">
            {fields.map((f, i) => (
              <li
                key={f.id}
                className={cx(
                  "rounded-sm border bg-parchment/40 p-3 md:p-4",
                  f.type === "heading" ? "border-rose" : "border-rule",
                )}
              >
                <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
                  <Field label={f.type === "heading" ? "Heading" : "Question"}>
                    <Input value={f.label} onChange={(e) => patch(i, { label: e.target.value })} />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={f.type}
                      onChange={(e) => {
                        const type = e.target.value as QField["type"];
                        patch(i, {
                          type,
                          options:
                            type === "select" || type === "checkboxes" ? (f.options?.length ? f.options : ["Option 1", "Option 2"]) : undefined,
                        });
                      }}
                    >
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {f.type !== "heading" && (
                  <Field label="Helper text (optional)" className="mt-3">
                    <Input value={f.help ?? ""} onChange={(e) => patch(i, { help: e.target.value })} />
                  </Field>
                )}
                {(f.type === "select" || f.type === "checkboxes") && (
                  <Field label="Options — one per line" className="mt-3">
                    <Textarea
                      rows={4}
                      defaultValue={(f.options ?? []).join("\n")}
                      onChange={(e) =>
                        patch(i, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
                      }
                    />
                  </Field>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {f.type !== "heading" ? (
                    <label className="inline-flex min-h-10 items-center gap-2 font-sans text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-scarlet"
                        checked={!!f.required}
                        onChange={(e) => patch(i, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={i === fields.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Move down"
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}
                      aria-label="Remove"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => add("text")}>
              + Question
            </Button>
            <Button type="button" variant="secondary" onClick={() => add("textarea")}>
              + Long answer
            </Button>
            <Button type="button" variant="secondary" onClick={() => add("checkboxes")}>
              + Checkboxes
            </Button>
            <Button type="button" variant="secondary" onClick={() => add("select")}>
              + Dropdown
            </Button>
            <Button type="button" variant="secondary" onClick={() => add("heading")}>
              + Section heading
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
