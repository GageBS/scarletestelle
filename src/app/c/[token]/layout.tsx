import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Monogram } from "@/components/brand";
import { Flourish } from "@/components/money/portal-ui";
import { getSettings } from "@/lib/settings";
import { getPortalProject } from "./portal-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Your client portal", template: "%s · Scarlet Estelle" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portal = await getPortalProject(token);
  if (!portal) notFound();
  const s = await getSettings();
  const b = s.business;
  const ig = b.instagram.replace(/^@/, "");

  return (
    <div className="min-h-dvh bg-parchment text-ink">
      <header className="flex flex-col items-center px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-2 print:hidden">
        <Link href={`/c/${token}`} aria-label="Your portal home" className="text-ink transition hover:text-scarlet">
          <Monogram size={64} />
        </Link>
        <p className="label mt-3 text-[0.62rem] text-muted">{b.name}</p>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-8 sm:pt-10">{children}</main>

      <footer className="border-t border-rule bg-cream/60 px-5 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center print:hidden">
        <Flourish />
        <p className="script inked mt-5 text-4xl text-scarlet">with love,</p>
        <p className="display mt-1 text-xl">{b.photographer}</p>
        <div className="mt-4 flex flex-col items-center gap-1 font-sans text-sm text-ink-soft">
          {b.email && (
            <a className="link-underline" href={`mailto:${b.email}`}>
              {b.email}
            </a>
          )}
          {b.phone && (
            <a className="link-underline" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>
              {b.phone}
            </a>
          )}
          {ig && (
            <a className="link-underline" href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">
              @{ig}
            </a>
          )}
        </div>
        <p className="label mt-8 text-[0.6rem] text-muted">
          This page is private to you · please don&apos;t share the link
        </p>
      </footer>
    </div>
  );
}
