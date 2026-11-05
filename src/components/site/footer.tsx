import Link from "next/link";
import { Monogram } from "@/components/brand";
import { brand, nav } from "@/content/site";
import { Photo, type PhotoLike } from "./photo";

export function SiteFooter({ strip = [] }: { strip?: PhotoLike[] }) {
  const year = new Date().getFullYear();
  const half = Math.ceil(nav.length / 2);
  return (
    <footer className="bg-noir text-cream">
      {strip.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6">
          {strip.slice(0, 6).map((p, i) => (
            <div key={p.src + i} className="relative aspect-square overflow-hidden">
              <Photo photo={p} fill sizes="(min-width: 768px) 17vw, 34vw" className="opacity-90 transition duration-700 hover:scale-105 hover:opacity-100" quality={70} />
            </div>
          ))}
        </div>
      )}
      <div className="mx-auto max-w-6xl px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-14 md:px-10">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_auto_1fr]">
          <nav className="hidden flex-wrap justify-end gap-8 md:flex">
            {nav.slice(0, half).map((n) => (
              <Link key={n.href} href={n.href} className="label text-cream/80 hover:text-cream">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/" className="mx-auto" aria-label="Home">
            <Monogram size={96} />
          </Link>
          <nav className="hidden flex-wrap gap-8 md:flex">
            {nav.slice(half).map((n) => (
              <Link key={n.href} href={n.href} className="label text-cream/80 hover:text-cream">
                {n.label}
              </Link>
            ))}
            <Link href="/inquire" className="label text-cream/80 hover:text-cream">
              Inquire
            </Link>
          </nav>
          {/* mobile nav */}
          <nav className="grid grid-cols-2 gap-x-6 gap-y-4 text-center md:hidden">
            {[...nav, { href: "/inquire", label: "Inquire" }].map((n) => (
              <Link key={n.href} href={n.href} className="label py-1 text-cream/80">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <p className="script inked text-4xl text-blush">documentary &amp; artful</p>
          <p className="label text-cream/60">{brand.serving}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-6">
            <a
              href={`https://instagram.com/${brand.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="label text-cream/80 hover:text-cream"
            >
              Instagram · @{brand.instagram}
            </a>
            {brand.email && (
              <a href={`mailto:${brand.email}`} className="label text-cream/80 hover:text-cream">
                {brand.email}
              </a>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-cream/10 pt-6 md:flex-row">
          <p className="font-sans text-[0.7rem] uppercase tracking-[0.2em] text-cream/45">
            © {year} {brand.legalName}
          </p>
          <div className="flex gap-6">
            <Link href="/book" className="font-sans text-[0.7rem] uppercase tracking-[0.2em] text-cream/45 hover:text-cream">
              Book a call
            </Link>
            <Link href="/studio" className="font-sans text-[0.7rem] uppercase tracking-[0.2em] text-cream/30 hover:text-cream">
              Studio
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
