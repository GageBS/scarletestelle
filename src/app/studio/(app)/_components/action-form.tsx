"use client";
/* A <form> wired to a server action that returns {ok, error, message}.
   Shows the result inline (never silent). */
import { useActionState, type ReactNode } from "react";
import { Notice } from "@/components/studio/ui";

export type FormState = { ok?: boolean; error?: string; message?: string } | null;
export type FormAction = (prev: FormState, fd: FormData) => Promise<FormState>;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div role="status" aria-live="polite" className="empty:hidden">
        {state?.error && <Notice tone="bad">{state.error}</Notice>}
        {state?.ok && <Notice tone="ok">{state.message ?? "Saved."}</Notice>}
      </div>
    </form>
  );
}
