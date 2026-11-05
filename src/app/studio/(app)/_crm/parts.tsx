/* Small server-rendered pieces shared by the CRM screens. */
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/studio/ui";

export const projectHref = (id: string) => `/studio/projects/${id}`;

/** A tappable list row (44px+ target) used for every "item → project" list. */
export function ListRow({
  href,
  title,
  sub,
  right,
}: {
  href: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition hover:bg-linen/60 md:px-5"
    >
      <span className="min-w-0">
        <span className="block truncate font-sans text-[0.95rem] text-ink">{title}</span>
        {sub && <span className="mt-0.5 block truncate font-sans text-xs text-ink-soft">{sub}</span>}
      </span>
      {right && <span className="shrink-0 text-right font-sans text-xs text-ink-soft">{right}</span>}
    </Link>
  );
}

export function RowList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-rule/70">{children}</div>;
}

export function SampleBadge() {
  return (
    <span className="rounded-full border border-rule px-2 py-0.5 font-sans text-[0.62rem] uppercase tracking-[0.14em] text-muted">
      Sample
    </span>
  );
}

/** A round done-checkbox that submits a server action (no client state needed). */
export function TaskCheck({
  id,
  done,
  action,
}: {
  id: string;
  done: boolean;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={done ? "Mark not done" : "Mark done"}
        className="grid size-11 place-items-center rounded-full"
      >
        <span
          className={cx(
            "grid size-6 place-items-center rounded-full border text-[0.8rem] transition",
            done
              ? "border-moss bg-moss text-cream"
              : "border-ink/40 text-transparent hover:border-scarlet hover:text-scarlet/50",
          )}
        >
          ✓
        </span>
      </button>
    </form>
  );
}
