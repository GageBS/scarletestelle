"use client";
/* eslint-disable @next/next/no-img-element -- studio thumbnails come straight from /media */
import { useState } from "react";
import { cx } from "@/components/studio/ui";

export type PickPhoto = { id: string; src: string; alt: string };

/** Choose one portfolio photo (or none). Submits as the hidden field `photoId`. */
export function PhotoPicker({
  photos,
  initialId,
  name = "photoId",
}: {
  photos: PickPhoto[];
  initialId: string | null;
  name?: string;
}) {
  const [value, setValue] = useState<string>(initialId ?? "");
  const [open, setOpen] = useState(false);
  const current = photos.find((p) => p.id === value);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3">
        <span className="block size-16 shrink-0 overflow-hidden rounded-sm bg-linen">
          {current && <img src={current.src} alt="" className="size-full object-cover" />}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-h-10 rounded-sm border border-ink/30 px-4 font-sans text-[0.72rem] uppercase tracking-[0.18em] hover:border-ink"
        >
          {open ? "Close" : current ? "Change photo" : "Choose photo"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="min-h-10 px-2 font-sans text-xs text-ink-soft underline underline-offset-4"
          >
            Remove
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-sm border border-rule bg-parchment/50 p-2">
          {photos.length === 0 ? (
            <p className="p-3 font-sans text-sm text-ink-soft">No portfolio photos yet.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={p.id === value}
                    aria-label={p.alt || "Portfolio photo"}
                    onClick={() => {
                      setValue(p.id);
                      setOpen(false);
                    }}
                    className={cx(
                      "block aspect-square w-full overflow-hidden rounded-sm border-2",
                      p.id === value ? "border-scarlet" : "border-transparent hover:border-rose",
                    )}
                  >
                    <img src={p.src} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
