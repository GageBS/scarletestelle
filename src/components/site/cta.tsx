import Link from "next/link";
import { home } from "@/content/site";
import { Photo, type PhotoLike } from "./photo";
import { Reveal } from "./reveal";

/** Dark "Let's create something timeless" band that ends most pages. */
export function InquireBand({ photo }: { photo?: PhotoLike | null }) {
  return (
    <section className="grain relative overflow-hidden bg-noir text-cream">
      {photo && (
        <div className="absolute inset-0 opacity-35">
          <Photo photo={photo} fill sizes="100vw" quality={70} className="grayscale" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-noir/40 via-noir/20 to-noir/70" />
      <Reveal className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-28 text-center md:py-40">
        <h2 className="script inked text-[3.4rem] leading-[1.05] text-cream md:text-[5.6rem]">
          {home.ctaScript}
        </h2>
        <p className="label mt-5 text-cream/80">{home.ctaLine}</p>
        <Link
          href="/inquire"
          className="label mt-10 border border-cream/70 px-9 py-4 transition hover:bg-cream hover:text-ink"
        >
          Inquire with me
        </Link>
      </Reveal>
    </section>
  );
}
