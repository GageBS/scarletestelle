"use client";
/* A <form> that runs a server action via useActionState, shows its error / success
   inline, and (unlike a plain form action) keeps what you typed when validation fails. */
import { useActionState, useEffect, useRef, startTransition, type ReactNode } from "react";
import { Notice, btnStyles, cx, type BtnVariant } from "@/components/studio/ui";
import type { FormState } from "./shared";

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  pendingLabel = "Saving…",
  variant = "primary",
  reset = false,
  className,
  footer,
  submitClassName,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel?: ReactNode;
  pendingLabel?: string;
  variant?: BtnVariant;
  reset?: boolean;
  className?: string;
  footer?: ReactNode;
  submitClassName?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (reset && state?.ok) ref.current?.reset();
  }, [state, reset]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
    >
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={cx(btnStyles[variant], submitClassName)}
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        {footer}
      </div>
      {state?.error && (
        <div className="mt-3" role="alert">
          <Notice tone="bad">{state.error}</Notice>
        </div>
      )}
      {state?.ok && (
        <div className="mt-3" role="status">
          <Notice tone="ok">{state.ok}</Notice>
        </div>
      )}
    </form>
  );
}
