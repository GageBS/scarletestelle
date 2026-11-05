"use client";
/* Client-side studio helpers that need hooks. */
import { useFormStatus } from "react-dom";
import { useState, type ComponentProps, type ReactNode } from "react";
import { btnStyles, cx, type BtnVariant } from "./ui";

/** Submit button that disables + shows a pending label while its form's action runs. */
export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  className,
  ...rest
}: ComponentProps<"button"> & { pendingText?: string; variant?: BtnVariant }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      className={cx(btnStyles[variant], className)}
      {...rest}
    >
      {pending ? pendingText : children}
    </button>
  );
}

/** Two-step button for destructive actions (no browser confirm dialogs). */
export function ConfirmButton({
  children,
  confirmText = "Tap again to confirm",
  variant = "danger",
  className,
  ...rest
}: ComponentProps<"button"> & { confirmText?: ReactNode; variant?: BtnVariant }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  return (
    <button
      {...rest}
      type={armed ? "submit" : "button"}
      disabled={pending}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
        }
      }}
      className={cx(btnStyles[variant], className)}
    >
      {pending ? "Working…" : armed ? confirmText : children}
    </button>
  );
}

/** Copy-to-clipboard button for client links. */
export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btnStyles.secondary}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
