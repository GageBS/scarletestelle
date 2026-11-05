import Link from "next/link";
import { cx } from "@/components/studio/ui";

/** "explore all services" style link: script text with a drawn underline. */
export function ScriptLink({
  href,
  children,
  light = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "script inked link-underline inline-block text-[2rem] md:text-[2.4rem]",
        light ? "text-cream" : "text-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}
