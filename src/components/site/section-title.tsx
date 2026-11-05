import { cx } from "@/components/studio/ui";

/** Script heading with a small spaced-caps line under it (Janie-style), optionally centered. */
export function SectionTitle({
  script,
  label,
  center = false,
  light = false,
  className,
  size = "lg",
}: {
  script: string;
  label?: string;
  center?: boolean;
  light?: boolean;
  className?: string;
  size?: "md" | "lg" | "xl";
}) {
  const s = {
    md: "text-[2.6rem] md:text-[3.4rem]",
    lg: "text-[3.2rem] md:text-[4.6rem]",
    xl: "text-[3.8rem] md:text-[6rem]",
  }[size];
  return (
    <div className={cx(center && "text-center", className)}>
      <h2 className={cx("script inked", s, light ? "text-blush" : "text-scarlet")}>{script}</h2>
      {label && (
        <p className={cx("label mt-3", light ? "text-cream/80" : "text-ink-soft", center && "mx-auto")}>
          {label}
        </p>
      )}
    </div>
  );
}
