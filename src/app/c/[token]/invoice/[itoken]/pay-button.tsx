"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/components/studio/ui";
import { portalBtn } from "@/components/money/portal-ui";
import { startCheckout, type PayState } from "./actions";

export function PayButton({
  token,
  itoken,
  installmentId,
  label,
  disabled,
}: {
  token: string;
  itoken: string;
  installmentId: string;
  label: string;
  disabled?: boolean;
}) {
  const [state, action] = useActionState<PayState, FormData>(startCheckout, {});
  return (
    <form action={action} className="flex flex-col items-center gap-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="itoken" value={itoken} />
      <input type="hidden" name="installmentId" value={installmentId} />
      <Submit label={label} disabled={disabled} />
      {state.error && (
        <p role="alert" className="max-w-md rounded-[2px] border border-scarlet/40 bg-scarlet/10 px-4 py-3 text-center font-sans text-sm text-scarlet">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={cx(portalBtn.accent, "w-full sm:w-auto")}>
      {pending ? "Opening secure checkout…" : label}
    </button>
  );
}
