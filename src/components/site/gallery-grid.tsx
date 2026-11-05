"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/studio/ui";

export type GridPhoto = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  medium?: "film" | "digital" | null;
};

/**
 * Masonry grid + full-screen viewer. Built to be EASY to look through:
 * tap any image → swipe / arrow keys / buttons, with a counter, and
 * optional Film · Digital filter chips.
 */
export function GalleryGrid({
  photos,
  filters = true,
  columns = "columns-2 md:columns-3",
}: {
  photos: GridPhoto[];
  filters?: boolean;
  columns?: string;
}) {
  const [filter, setFilter] = useState<"all" | "film" | "digital">("all");
  const list = useMemo(
    () => (filter === "all" ? photos : photos.filter((p) => p.medium === filter)),
    [photos, filter],
  );
  const [open, setOpen] = useState<number | null>(null);
  const hasFilm = photos.some((p) => p.medium === "film");
  const hasDigital = photos.some((p) => p.medium === "digital");

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback(
    (d: number) => setOpen((i) => (i == null ? i : (i + d + list.length) % list.length)),
    [list.length],
  );

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, close, go]);

  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <div>
      {filters && hasFilm && hasDigital && (
        <div className="mb-8 flex justify-center gap-2">
          {(["all", "film", "digital"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cx(
                "label rounded-full border px-4 py-2 transition",
                filter === f ? "border-ink bg-ink text-cream" : "border-rule text-ink-soft hover:border-ink",
              )}
            >
              {f === "all" ? "All" : f === "film" ? "On film" : "On digital"}
            </button>
          ))}
        </div>
      )}

      <div className={cx(columns, "gap-3 md:gap-5 [&>*]:mb-3 md:[&>*]:mb-5")}>
        {list.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setOpen(i)}
            className="group relative block w-full break-inside-avoid overflow-hidden bg-linen"
            aria-label={`Open photo ${i + 1}${p.alt ? `: ${p.alt}` : ""}`}
          >
            <Image
              src={p.src}
              alt={p.alt}
              width={p.width}
              height={p.height}
              sizes="(min-width: 768px) 33vw, 50vw"
              quality={80}
              className="h-auto w-full transition duration-700 group-hover:scale-[1.03]"
            />
            {p.medium === "film" && (
              <span className="label absolute bottom-2 left-2 bg-noir/60 px-2 py-0.5 text-[0.58rem] text-cream opacity-0 transition group-hover:opacity-100">
                film
              </span>
            )}
          </button>
        ))}
      </div>

      {open != null && list[open] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-50 flex flex-col bg-noir/97 text-cream"
          onTouchStart={(e) => {
            touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            const t = touch.current;
            if (!t) return;
            const dx = e.changedTouches[0].clientX - t.x;
            const dy = e.changedTouches[0].clientY - t.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
            else if (dy > 90) close();
            touch.current = null;
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 md:px-8"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <span className="label text-cream/70">
              {String(open + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
            </span>
            <button onClick={close} className="label grid h-11 place-items-center px-2 text-cream/80 hover:text-cream">
              Close ✕
            </button>
          </div>
          <div className="relative flex-1">
            <Image
              key={list[open].id}
              src={list[open].src}
              alt={list[open].alt}
              fill
              sizes="100vw"
              quality={90}
              className="object-contain"
              preload
            />
            <button
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute inset-y-0 left-0 hidden w-1/4 items-center justify-start pl-6 text-3xl text-cream/60 hover:text-cream md:flex"
            >
              ←
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute inset-y-0 right-0 hidden w-1/4 items-center justify-end pr-6 text-3xl text-cream/60 hover:text-cream md:flex"
            >
              →
            </button>
          </div>
          <div
            className="flex items-center justify-between gap-4 px-4 py-4 md:px-8"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <button onClick={() => go(-1)} className="label h-11 px-2 text-cream/80 md:hidden">
              ← Prev
            </button>
            <p className="font-sans text-xs text-cream/50">
              {list[open].medium ? `On ${list[open].medium}` : ""}
              {list[open].caption ? ` · ${list[open].caption}` : ""}
            </p>
            <button onClick={() => go(1)} className="label h-11 px-2 text-cream/80 md:hidden">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
