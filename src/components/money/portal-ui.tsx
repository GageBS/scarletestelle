/* Building blocks for the client-facing portal (/c/...): parchment, Bodoni,
   a hand-inked script accent and lots of air. Server-safe (no hooks). */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/components/studio/ui";

const btn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[2px] px-7 font-sans text-[0.72rem] uppercase tracking-[0.24em] transition disabled:pointer-events-none disabled:opacity-50";
export const portalBtn = {
  primary: `${btn} bg-ink text-cream hover:bg-wine`,
  accent: `${btn} bg-scarlet text-cream hover:bg-wine`,
  outline: `${btn} border border-ink/35 text-ink hover:border-ink`,
  quiet: `${btn} px-3 text-ink-soft hover:text-scarlet`,
};

export function PortalLink({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: keyof typeof portalBtn }) {
  return <Link className={cx(portalBtn[variant], className)} {...rest} />;
}

/** A thin rule with a tiny diamond — the portal's section ornament. */
export function Flourish({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-3 text-rose", className)} aria-hidden>
      <span className="h-px w-12 bg-current sm:w-20" />
      <span className="size-1.5 rotate-45 border border-current" />
      <span className="h-px w-12 bg-current sm:w-20" />
    </div>
  );
}

export function PortalHeading({
  script,
  title,
  children,
  className,
}: {
  script?: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("text-center", className)}>
      {script && <p className="script inked text-[2.6rem] leading-none text-scarlet sm:text-5xl">{script}</p>}
      <h1 className="display mt-2 text-[2.1rem] leading-[1.08] sm:text-5xl">{title}</h1>
      {children && <div className="mx-auto mt-4 max-w-xl text-[1.05rem] text-ink-soft">{children}</div>}
    </header>
  );
}

export function PortalSection({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mt-12 sm:mt-16", className)}>
      {title && <h2 className="label mb-4 text-center text-muted">{title}</h2>}
      {children}
    </section>
  );
}

export function PortalCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-[2px] border border-rule bg-cream/90 p-5 shadow-[0_18px_40px_-28px_rgb(42_18_19/0.45)] sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Pill({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "scarlet" | "moss" | "ink";
  children: ReactNode;
}) {
  const t = {
    muted: "border-rule text-ink-soft",
    scarlet: "border-scarlet/40 text-scarlet",
    moss: "border-moss/50 text-moss-deep",
    ink: "border-ink/40 text-ink",
  }[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-sans text-[0.62rem] uppercase tracking-[0.18em] whitespace-nowrap",
        t,
      )}
    >
      {children}
    </span>
  );
}

/** A tappable document row on the portal home. */
export function DocLink({
  href,
  kicker,
  title,
  meta,
  status,
  cta,
  external,
}: {
  href: string;
  kicker: string;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  cta?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="label text-muted">{kicker}</p>
        <p className="display mt-1 text-[1.35rem] leading-tight">{title}</p>
        {meta && <div className="mt-1 font-sans text-[0.82rem] text-ink-soft">{meta}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {status}
        <span className="font-sans text-[0.68rem] uppercase tracking-[0.22em] text-scarlet">
          {cta ?? "Open"} →
        </span>
      </div>
    </>
  );
  const cls =
    "flex min-h-20 items-center gap-4 rounded-[2px] border border-rule bg-cream/90 px-5 py-4 transition hover:border-rose hover:bg-cream";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} prefetch={false} className={cls}>
      {inner}
    </Link>
  );
}
