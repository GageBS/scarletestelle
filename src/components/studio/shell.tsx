"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Monogram } from "@/components/brand";
import { Icon } from "./icon";
import { STUDIO_NAV } from "./nav-items";
import { cx } from "./ui";

function isActive(pathname: string, href: string) {
  return href === "/studio" ? pathname === "/studio" : pathname.startsWith(href);
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const groups = [...new Set(STUDIO_NAV.map((n) => n.group))];
  return (
    <nav className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="label mb-1.5 px-3 text-[0.62rem] text-cream/45">{g}</p>
          <ul className="flex flex-col">
            {STUDIO_NAV.filter((n) => n.group === g).map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={onNavigate}
                    className={cx(
                      "flex items-center gap-3 rounded-sm px-3 py-2 font-sans text-[0.9rem] transition",
                      active ? "bg-cream/12 text-cream" : "text-cream/70 hover:bg-cream/6 hover:text-cream",
                    )}
                  >
                    <Icon name={n.icon} className="size-[18px]" />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function StudioShell({
  children,
  emailConnected,
  logout,
}: {
  children: ReactNode;
  emailConnected: boolean;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // close the menu when the route changes (state adjusted during render, no effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const bar = STUDIO_NAV.filter((n) => n.mobileBar);

  return (
    <div className="min-h-dvh bg-parchment font-sans">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-noir px-3 py-5 text-cream lg:flex">
        <Link href="/studio" className="mb-6 flex items-center gap-3 px-3 text-cream">
          <Monogram size={44} />
          <span className="leading-tight">
            <span className="display block text-sm uppercase tracking-[0.25em]">Scarlet Estelle</span>
            <span className="label text-[0.6rem] text-cream/50">Studio</span>
          </span>
        </Link>
        <NavList pathname={pathname} />
        <div className="mt-auto flex flex-col gap-1 pt-6">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-sm px-3 py-2 text-[0.85rem] text-cream/60 hover:text-cream"
          >
            <Icon name="external" className="size-4" /> View website
          </Link>
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-[0.85rem] text-cream/60 hover:text-cream">
              <Icon name="logout" className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-parchment/95 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <Link href="/studio" className="flex items-center gap-2 text-ink">
          <Monogram size={34} />
          <span className="label">Studio</span>
        </Link>
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-sm text-ink"
        >
          <Icon name="menu" />
        </button>
      </header>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-noir/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col overflow-y-auto bg-noir px-3 pb-8 pt-[max(1rem,env(safe-area-inset-top))] text-cream">
            <div className="mb-4 flex items-center justify-between px-3">
              <Monogram size={36} />
              <button aria-label="Close" onClick={() => setOpen(false)} className="grid size-10 place-items-center">
                <Icon name="x" />
              </button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="mt-6 flex flex-col gap-1 border-t border-cream/10 pt-4">
              <Link href="/" className="px-3 py-2 text-sm text-cream/70">View website</Link>
              <form action={logout}>
                <button className="px-3 py-2 text-left text-sm text-cream/70">Sign out</button>
              </form>
            </div>
          </div>
        </div>
      )}

      <main className="lg:pl-60">
        {!emailConnected && (
          <div className="border-b border-[#d9b47a] bg-[#f6e8cf] px-4 py-2 text-center text-xs text-[#6b4210] lg:px-8">
            Email isn’t connected yet — messages are saved in <Link className="underline" href="/studio/outbox">Emails</Link> but not delivered.
            {" "}Add RESEND_API_KEY + EMAIL_FROM to connect.
          </div>
        )}
        <div className="studio-main mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:pb-12">{children}</div>
      </main>

      {/* mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-rule bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {bar.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cx(
              "flex flex-col items-center gap-0.5 py-2 text-[0.62rem] uppercase tracking-[0.12em]",
              isActive(pathname, n.href) ? "text-scarlet" : "text-ink-soft",
            )}
          >
            <Icon name={n.icon} className="size-5" />
            {n.label}
          </Link>
        ))}
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[0.62rem] uppercase tracking-[0.12em] text-ink-soft"
        >
          <Icon name="dots" className="size-5" />
          More
        </button>
      </nav>
    </div>
  );
}
