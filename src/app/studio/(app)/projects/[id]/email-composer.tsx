"use client";
import { useActionState, useState, useTransition, startTransition, useRef } from "react";
import { Button, Field, Input, Notice, Select, Textarea, btnStyles } from "@/components/studio/ui";
import type { FormState } from "../../_crm/shared";
import type { EmailPreview } from "../actions";

export type TemplateOption = { id: string; name: string; subject: string; body: string };

export function EmailComposer({
  projectId,
  recipients,
  templates,
  send,
  preview,
  mergeKeys,
}: {
  projectId: string;
  recipients: { label: string; email: string }[];
  templates: TemplateOption[];
  send: (prev: FormState, fd: FormData) => Promise<FormState>;
  preview: (projectId: string, subject: string, body: string) => Promise<EmailPreview>;
  mergeKeys: string[];
}) {
  const [state, run, sending] = useActionState(send, null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState(recipients[0]?.email ?? "");
  const [pv, setPv] = useState<EmailPreview | null>(null);
  const [previewing, startPreview] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setSubject("");
      setBody("");
      setPv(null);
    }
  }

  function pickTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body);
    setPv(null);
  }

  function insertField(key: string) {
    if (!key) return;
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (el) {
      const a = el.selectionStart ?? body.length;
      const b = el.selectionEnd ?? body.length;
      setBody(body.slice(0, a) + token + body.slice(b));
    } else setBody(body + token);
    setPv(null);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          await run(fd);
        });
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start from a template">
          <Select defaultValue="" onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">{templates.length ? "Write from scratch" : "No templates yet"}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To">
          {recipients.length > 1 ? (
            <Select name="to" value={to} onChange={(e) => setTo(e.target.value)}>
              {recipients.map((r) => (
                <option key={r.email} value={r.email}>
                  {r.label} · {r.email}
                </option>
              ))}
            </Select>
          ) : (
            <Input name="to" type="email" inputMode="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@email.com" />
          )}
        </Field>
      </div>
      <Field label="Subject">
        <Input name="subject" value={subject} onChange={(e) => { setSubject(e.target.value); setPv(null); }} />
      </Field>
      <Field label="Message">
        <Textarea
          ref={bodyRef}
          name="body"
          rows={9}
          value={body}
          onChange={(e) => { setBody(e.target.value); setPv(null); }}
          placeholder={"Hi {{client_first_name}},\n\n…"}
        />
      </Field>
      <Field label="Insert a merge field">
        <Select value="" onChange={(e) => insertField(e.target.value)}>
          <option value="">Choose one…</option>
          {mergeKeys.map((k) => (
            <option key={k} value={k}>
              {`{{${k}}}`}
            </option>
          ))}
        </Select>
      </Field>

      {pv && (
        <div className="rounded-sm border border-rule bg-parchment/60 p-4">
          {!("missing" in pv) ? (
            <p className="font-sans text-sm text-scarlet">{pv.error}</p>
          ) : (
            <>
              <p className="label text-muted">Preview</p>
              <p className="mt-1 font-sans text-sm font-medium">{pv.subject}</p>
              <p className="mt-2 whitespace-pre-wrap font-serif text-[0.95rem] leading-relaxed">{pv.body}</p>
              {pv.missing.length > 0 && (
                <div className="mt-3">
                  <Notice tone="warn">
                    No value yet for {pv.missing.map((m) => `{{${m}}}`).join(", ")}. Fill in or remove before sending.
                  </Notice>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={sending} className={btnStyles.primary}>
          {sending ? "Sending…" : "Send email"}
        </button>
        <Button
          type="button"
          variant="secondary"
          disabled={previewing || !body.trim()}
          onClick={() => startPreview(async () => setPv(await preview(projectId, subject, body)))}
        >
          {previewing ? "Rendering…" : "Preview"}
        </Button>
      </div>
      {state?.error && (
        <div role="alert">
          <Notice tone="bad">{state.error}</Notice>
        </div>
      )}
      {state?.ok && (
        <div role="status">
          <Notice tone={state.ok.startsWith("Sent") ? "ok" : "warn"}>{state.ok}</Notice>
        </div>
      )}
    </form>
  );
}
