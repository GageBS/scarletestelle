/* Brand marks: the SE blackletter monogram, the wordmark, and the ink filter. */
import { cx } from "@/components/studio/ui";

/**
 * SVG filter that roughens edges so type looks hand-inked on paper.
 * Rendered once in the root layout; apply with className="inked".
 */
export function InkFilterDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <filter id="se-ink" x="-5%" y="-20%" width="110%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n"
          scale="1.6"
          xChannelSelector="R"
          yChannelSelector="G"
          result="d"
        />
        <feGaussianBlur in="d" stdDeviation="0.25" result="b" />
        <feComposite in="b" in2="d" operator="over" />
      </filter>
    </svg>
  );
}

/**
 * The SE monogram — blackletter S and E interlaced inside a fine double oval.
 * `size` is the rendered height in px.
 */
export function Monogram({
  size = 64,
  className,
  framed = true,
  title = "Scarlet Estelle",
}: {
  size?: number;
  className?: string;
  framed?: boolean;
  title?: string;
}) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cx("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size * 0.82, height: size }}
    >
      {framed && (
        <svg
          viewBox="0 0 82 100"
          className="absolute inset-0 h-full w-full"
          fill="none"
          stroke="currentColor"
          aria-hidden
        >
          <ellipse cx="41" cy="50" rx="39" ry="48" strokeWidth="0.9" />
          <ellipse cx="41" cy="50" rx="35.5" ry="44.5" strokeWidth="0.45" />
          {/* tiny flourish dots at the poles */}
          <circle cx="41" cy="2" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="41" cy="98" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      )}
      <span
        className="gothic relative leading-none"
        style={{ fontSize: size * 0.5, transform: `translateY(${size * 0.02}px)` }}
      >
        <span className="relative" style={{ left: size * 0.03 }}>
          S
        </span>
        <span className="relative" style={{ marginLeft: -size * 0.1, top: size * 0.09 }}>
          E
        </span>
      </span>
    </span>
  );
}

/** "Scarlet Estelle" wordmark with optional "photography" script line. */
export function Wordmark({
  className,
  sub = true,
  size = "md",
}: {
  className?: string;
  sub?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const s = {
    sm: "text-[1.05rem]",
    md: "text-[1.35rem]",
    lg: "text-[2.4rem] md:text-[3.2rem]",
    xl: "text-[3rem] sm:text-[4.2rem] md:text-[6rem]",
  }[size];
  return (
    <span className={cx("inline-flex flex-col items-center leading-none", className)}>
      <span className={cx("display uppercase tracking-[0.28em]", s)}>Scarlet&nbsp;Estelle</span>
      {sub && (
        <span
          className={cx(
            "script inked -mt-[0.15em] text-scarlet",
            size === "xl" ? "text-[2.2rem] md:text-[3.6rem]" : size === "lg" ? "text-[1.8rem] md:text-[2.3rem]" : "text-[1.15rem]",
          )}
        >
          photography
        </span>
      )}
    </span>
  );
}
