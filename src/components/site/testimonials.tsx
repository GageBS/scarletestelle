"use client";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/studio/ui";

export type Quote = {
  id: string;
  name: string;
  sessionType: string;
  quote: string;
  pullQuote: string;
  isDemo: boolean;
};

/** Swipeable kind-words carousel with a 01/03 counter (Janie-style), snap-scrolling on phones. */
export function TestimonialCarousel({ quotes, light = false }: { quotes: Quote[]; light?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setI(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);
  const go = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const n = (i + d + quotes.length) % quotes.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  if (quotes.length === 0) return null;

  return (
    <div className={light ? "text-cream" : "text-ink"}>
      <div ref={ref} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {quotes.map((q) => (
          <figure key={q.id} className="w-full shrink-0 snap-center px-2 text-center md:px-16">
            {q.pullQuote && (
              <p className={cx("script inked text-[2.6rem] leading-tight md:text-[3.6rem]", light ? "text-blush" : "text-scarlet")}>
                “{q.pullQuote}”
              </p>
            )}
            <blockquote className="mx-auto mt-5 max-w-2xl font-serif text-[1.15rem] leading-relaxed md:text-[1.3rem]">
              {q.quote}
            </blockquote>
            <figcaption className="label mt-6 opacity-80">
              — {q.name}
              {q.sessionType && <span className="opacity-70"> · {q.sessionType}</span>}
              {q.isDemo && (
                <span className="ml-2 rounded-full border border-current px-2 py-0.5 text-[0.55rem] opacity-60">
                  sample review
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      {quotes.length > 1 && (
        <div className="mt-8 flex items-center justify-center gap-8">
          <button onClick={() => go(-1)} aria-label="Previous review" className="h-11 px-3 text-xl opacity-70 hover:opacity-100">
            ⟵
          </button>
          <span className="label opacity-70">
            {String(i + 1).padStart(2, "0")}/{String(quotes.length).padStart(2, "0")}
          </span>
          <button onClick={() => go(1)} aria-label="Next review" className="h-11 px-3 text-xl opacity-70 hover:opacity-100">
            ⟶
          </button>
        </div>
      )}
    </div>
  );
}
