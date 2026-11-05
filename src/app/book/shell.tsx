/* Shared luxurious frame for the public booking pages. */
import Link from "next/link";
import type { ReactNode } from "react";
import { Monogram } from "@/components/brand";

export function BookShell({
  children,
  eyebrow,
  title,
  script,
  wide = false,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  script?: string;
  wide?: boolean;
}) {
  return (
    <main className="min-h-dvh bg-parchment pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-ink">
      <div className={`mx-auto px-4 sm:px-6 ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
        <header className="flex flex-col items-center text-center">
          <Link href="/" aria-label="Scarlet Estelle home" className="text-ink">
            <Monogram size={64} />
          </Link>
          {eyebrow && <p className="label mt-6 text-muted">{eyebrow}</p>}
          <h1 className="display mt-2 text-[2rem] leading-tight sm:text-5xl">{title}</h1>
          {script && <p className="script inked mt-2 text-4xl text-scarlet sm:text-5xl">{script}</p>}
        </header>
        <div className="mt-8 sm:mt-10">{children}</div>
        <footer className="mt-14 text-center">
          <p className="label text-muted">Scarlet Estelle Photography</p>
        </footer>
      </div>
    </main>
  );
}
