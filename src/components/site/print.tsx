import { cx } from "@/components/studio/ui";
import { Photo, PhotoPlaceholder, type PhotoLike } from "./photo";

/** A photo printed on cream stock, optionally tilted with a strip of washi tape. */
export function Print({
  photo,
  aspect = "aspect-[4/5]",
  tilt = 0,
  tape = false,
  caption,
  sizes = "(min-width: 768px) 30vw, 70vw",
  className,
}: {
  photo?: PhotoLike | null;
  aspect?: string;
  tilt?: number;
  tape?: boolean;
  caption?: string;
  sizes?: string;
  className?: string;
}) {
  // outer div takes layout/positioning classes; the print itself is always `relative`
  return (
    <div className={className} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      <figure className="print relative">
        {tape && (
          <span
            aria-hidden
            className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 rotate-[-4deg] bg-[#e9dcc4]/80 shadow-sm"
          />
        )}
        <div className={cx("relative overflow-hidden", aspect)}>
          {photo ? (
            <Photo photo={photo} fill sizes={sizes} />
          ) : (
            <PhotoPlaceholder className="absolute inset-0" />
          )}
        </div>
        {caption && (
          <figcaption className="script inked absolute inset-x-0 bottom-1.5 text-center text-[1.5rem] text-ink-soft">
            {caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

/** Film-strip framed photo (sprocket holes top + bottom). */
export function FilmFrame({
  photo,
  aspect = "aspect-[3/2]",
  label,
  sizes = "(min-width: 768px) 45vw, 90vw",
  className,
}: {
  photo?: PhotoLike | null;
  aspect?: string;
  label?: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div className="filmstrip">
        <div className={cx("relative overflow-hidden", aspect)}>
          {photo ? <Photo photo={photo} fill sizes={sizes} /> : <PhotoPlaceholder className="absolute inset-0" />}
        </div>
      </div>
      {label && (
        <figcaption className="mt-2 flex justify-between font-sans text-[0.6rem] uppercase tracking-[0.3em] text-ink-soft">
          <span>{label}</span>
          <span>▸ 24A</span>
        </figcaption>
      )}
    </figure>
  );
}
