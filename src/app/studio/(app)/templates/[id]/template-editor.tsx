"use client";
import { useRef, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";

type FieldDef = { key: string; label: string };

const fill = (tpl: string, ctx: Record<string, string>) =>
  tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in ctx && ctx[k] ? ctx[k] : m));

export function TemplateEditor({
  id,
  initial,
  fields,
  sample,
  save,
  sendTest,
}: {
  id: string;
  initial: { name: string; subject: string; body: string };
  fields: FieldDef[];
  sample: Record<string, string>;
  save: (fd: FormData) => Promise<void>;
  sendTest: (fd: FormData) => Promise<void>;
}) {
  const [name, setName] = useState(initial.name);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<"body" | "subject">("body");

  function insert(key: string) {
    const token = `{{${key}}}`;
    if (target === "subject") {
      const el = subjectRef.current;
      const s = el?.selectionStart ?? subject.length;
      const e = el?.selectionEnd ?? s;
      const next = subject.slice(0, s) + token + subject.slice(e);
      setSubject(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(s + token.length, s + token.length);
      });
      return;
    }
    const el = bodyRef.current;
    const s = el?.selectionStart ?? body.length;
    const e = el?.selectionEnd ?? s;
    const next = body.slice(0, s) + token + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + token.length, s + token.length);
    });
  }

  return (
    <form action={save} className="grid gap-6 lg:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-5">
        <Field label="Template name (just for you)">
          <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Subject">
          <Input
            ref={subjectRef}
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setTarget("subject")}
            required
          />
        </Field>
        <Field label="Message">
          <Textarea
            ref={bodyRef}
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setTarget("body")}
            rows={16}
            className="font-serif text-[1.02rem] leading-relaxed"
            required
          />
        </Field>
        <div>
          <p className="label mb-1.5 text-ink-soft">
            Insert a merge field into the {target === "subject" ? "subject" : "message"}
          </p>
          <div className="flex gap-2">
            <Select
              aria-label="Merge field"
              value=""
              onChange={(e) => {
                if (e.target.value) insert(e.target.value);
              }}
            >
              <option value="">Choose a field…</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label} — {`{{${f.key}}}`}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["client_first_name", "couple_names", "event_date", "photographer_name", "booking_link"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => insert(k)}
                className="min-h-9 rounded-full border border-rule bg-cream px-3 font-sans text-xs hover:border-ink"
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton>Save template</SubmitButton>
          <SubmitButton formAction={sendTest} variant="secondary" pendingText="Sending…">
            Send test to my email
          </SubmitButton>
        </div>
      </div>

      <div>
        <p className="label mb-1.5 text-ink-soft">Preview (with sample values)</p>
        <div className="rounded-sm border border-rule bg-linen p-3 md:p-5">
          <div className="mx-auto max-w-[34rem] bg-cream px-5 py-6 shadow-sm md:px-8 md:py-8">
            <p className="font-sans text-xs text-muted">Subject</p>
            <p className="font-sans text-sm font-medium">{fill(subject, sample)}</p>
            <hr className="my-4 border-rule" />
            <div className="whitespace-pre-wrap text-[1.02rem] leading-relaxed text-ink">{fill(body, sample)}</div>
          </div>
          <p className="mt-3 font-sans text-xs text-muted">
            Any {"{{field}}"} still showing in curly braces has no value yet — that&apos;s normal for fields only some
            automations provide.
          </p>
        </div>
      </div>
    </form>
  );
}
