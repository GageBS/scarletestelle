"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Monogram } from "@/components/brand";
import { cx } from "@/components/studio/ui";
import { nav } from "@/content/site";

/**
 * Desktop: links split left / right around the centered SE monogram.
 * Mobile: monogram left, "Inquire" + menu right, full-screen menu.
 * `overlay` = transparent over a full-bleed hero (home page) until scrolled.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const overlay = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // close the menu when the route changes (state adjusted during render, no effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);

  const clear = overlay && !scrolled && !open;
  const left = nav.slice(0, 3);
  const right = nav.slice(3);
  const linkCls = (href: string) =>
    cx(
      "label transition-opacity hover:opacity-60",
      pathname.startsWith(href) && "underline decoration-1 underline-offset-[6px]",
    );

  return (
    <>
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-40 transition-colors duration-500",
          clear ? "bg-transparent text-cream" : "bg-parchment/92 text-ink backdrop-blur-sm",
          !clear && scrolled && "shadow-[0_1px_0_var(--color-rule)]",
        )}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-24 md:px-10">
          {/* desktop left links */}
          <nav className="hidden flex-1 items-center gap-9 md:flex">
            {left.map((n) => (
              <Link key={n.href} href={n.href} className={linkCls(n.href)}>
                {n.label}
              </Link>
            ))}
          </nav>

          <Link href="/" aria-label="Scarlet Estelle — home" className="md:mx-8">
            <span className="md:hidden">
              <Monogram size={clear ? 60 : 50} />
            </span>
            <span className="hidden md:inline">
              <Monogram size={scrolled ? 58 : 72} />
            </span>
          </Link>

          {/* desktop right links */}
          <nav className="hidden flex-1 items-center justify-end gap-9 md:flex">
            {right.map((n) => (
              <Link key={n.href} href={n.href} className={linkCls(n.href)}>
                {n.label}
              </Link>
            ))}
            <Link
              href="/inquire"
              className={cx(
                "label border px-5 py-2.5 transition",
                clear
                  ? "border-cream/70 hover:bg-cream hover:text-ink"
                  : "border-ink bg-ink text-cream hover:bg-wine hover:border-wine",
              )}
            >
              Inquire
            </Link>
          </nav>

          {/* mobile right */}
          <div className="flex items-center gap-1 md:hidden">
            <Link
              href="/inquire"
              className={cx(
                "label px-3 py-2",
                clear ? "text-cream" : "text-ink",
              )}
            >
              Inquire
            </Link>
            <button
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="grid size-11 place-items-center"
            >
              <span className="relative block h-3 w-7">
                <span
                  className={cx(
                    "absolute left-0 top-0 h-px w-full bg-current transition",
                    open && "top-1.5 rotate-45",
                  )}
                />
                <span
                  className={cx(
                    "absolute bottom-0 left-0 h-px w-full bg-current transition",
                    open && "bottom-1.5 -rotate-45",
                  )}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* mobile full-screen menu */}
      <div
        className={cx(
          "grain fixed inset-0 z-30 flex flex-col bg-parchment px-6 pb-10 text-ink transition-all duration-500 md:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 6rem)" }}
      >
        <nav className="relative z-10 flex flex-1 flex-col justify-center gap-5">
          {[{ href: "/", label: "Home" }, ...nav, { href: "/inquire", label: "Inquire" }].map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-baseline gap-4"
              style={{ transitionDelay: open ? `${80 + i * 40}ms` : "0ms" }}
            >
              <span className="label w-6 text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="display text-[2.4rem] uppercase tracking-[0.06em]">{n.label}</span>
            </Link>
          ))}
        </nav>
        <p className="script inked relative z-10 text-center text-4xl text-scarlet">
          film &amp; digital
        </p>
      </div>
    </>
  );
}
