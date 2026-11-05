/* Studio UI kit — small, consistent building blocks for every CRM screen.
   Server-safe (no hooks) except SubmitButton/ConfirmButton in ./client-ui.tsx. */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { STAGES } from "@/lib/constants";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ── layout ─────────────────────────────────────────── */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="label text-muted">{eyebrow}</p>}
        <h1 className="display text-3xl md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl font-sans text-sm text-ink-soft">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
  pad = true,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-sm border border-rule bg-cream shadow-[0_1px_0_rgb(42_18_19/0.04)]",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 md:px-5">
          {title && <h2 className="label text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={cx(pad && "p-4 md:p-5")}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="script text-5xl text-scarlet">{title}</p>
      {children && <p className="mt-3 max-w-md font-sans text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <p className="label text-muted">{label}</p>
      <p className="display mt-1 text-3xl">{value}</p>
      {hint && <p className="mt-1 font-sans text-xs text-ink-soft">{hint}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-sm border border-rule bg-cream p-4 transition hover:border-rose"
    >
      {inner}
    </Link>
  ) : (
    <div className="rounded-sm border border-rule bg-cream p-4">{inner}</div>
  );
}

/* ── buttons ────────────────────────────────────────── */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-sm font-sans text-[0.72rem] uppercase tracking-[0.18em] transition disabled:opacity-50 disabled:pointer-events-none min-h-10 px-4";
export const btnStyles = {
  primary: `${btnBase} bg-ink text-cream hover:bg-wine`,
  accent: `${btnBase} bg-scarlet text-cream hover:bg-wine`,
  secondary: `${btnBase} border border-ink/30 bg-transparent text-ink hover:border-ink`,
  ghost: `${btnBase} text-ink-soft hover:text-ink hover:bg-linen`,
  danger: `${btnBase} border border-scarlet/50 text-scarlet hover:bg-scarlet hover:text-cream`,
};
export type BtnVariant = keyof typeof btnStyles;

export function Button({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button className={cx(btnStyles[variant], className)} {...rest} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={cx(btnStyles[variant], className)} {...rest} />;
}

/* ── form fields ────────────────────────────────────── */
const inputCls =
  "w-full rounded-sm border border-rule bg-parchment/60 px-3 py-2 font-sans text-[0.95rem] text-ink outline-none transition focus:border-ink focus:bg-cream placeholder:text-muted";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="label mb-1 block text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block font-sans text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(inputCls, "min-h-10", className)} {...rest} />;
}
export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "min-h-28", className)} {...rest} />;
}
export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cx(inputCls, "min-h-10 pr-8", className)} {...rest} />;
}
export function Checkbox({ label, ...rest }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 font-sans text-sm">
      <input type="checkbox" className="size-4 accent-scarlet" {...rest} />
      {label}
    </label>
  );
}

/* ── badges ─────────────────────────────────────────── */
const tones: Record<string, string> = {
  scarlet: "bg-scarlet text-cream",
  rose: "bg-rose/40 text-wine",
  blush: "bg-blush text-wine",
  moss: "bg-moss text-cream",
  ink: "bg-ink text-cream",
  muted: "bg-linen text-ink-soft",
  ok: "bg-moss/20 text-moss-deep",
  warn: "bg-[#f1dcc0] text-[#7a4a12]",
  bad: "bg-scarlet/15 text-scarlet",
};
export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: keyof typeof tones | string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-sans text-[0.68rem] uppercase tracking-[0.12em] whitespace-nowrap",
        tones[tone] ?? tones.muted,
        className,
      )}
    >
      {children}
    </span>
  );
}
export function StageBadge({ stage }: { stage: string }) {
  const s = STAGES.find((x) => x.value === stage);
  return <Badge tone={s?.tone ?? "muted"}>{s?.label ?? stage}</Badge>;
}

/* ── table ──────────────────────────────────────────── */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto md:mx-0">
      <table className="w-full min-w-[560px] border-collapse font-sans text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        "label border-b border-rule px-3 py-2 text-left font-normal text-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("border-b border-rule/70 px-3 py-2.5 align-top", className)}>{children}</td>;
}

/* ── notices ────────────────────────────────────────── */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "ok" | "bad";
  children: ReactNode;
}) {
  const t = {
    info: "border-rose/50 bg-blush/40 text-wine",
    warn: "border-[#d9b47a] bg-[#f6e8cf] text-[#6b4210]",
    ok: "border-moss/40 bg-moss/10 text-moss-deep",
    bad: "border-scarlet/40 bg-scarlet/10 text-scarlet",
  }[tone];
  return <div className={cx("rounded-sm border px-4 py-3 font-sans text-sm", t)}>{children}</div>;
}
