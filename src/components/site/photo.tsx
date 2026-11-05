import Image from "next/image";
import { cx } from "@/components/studio/ui";

export type PhotoLike = { src: string; width: number; height: number; alt: string };

/**
 * Responsive photo. `fill` mode crops to the parent box (parent must be relative + sized);
 * otherwise keeps the natural aspect ratio.
 */
export function Photo({
  photo,
  sizes = "100vw",
  className,
  fill = false,
  preload = false,
  quality = 80,
  position = "center",
}: {
  photo: PhotoLike;
  sizes?: string;
  className?: string;
  fill?: boolean;
  preload?: boolean;
  quality?: 70 | 80 | 90;
  position?: string;
}) {
  if (fill) {
    return (
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        quality={quality}
        preload={preload}
        className={cx("object-cover", className)}
        style={{ objectPosition: position }}
      />
    );
  }
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      sizes={sizes}
      quality={quality}
      preload={preload}
      className={cx("h-auto w-full", className)}
    />
  );
}

/** Soft placeholder block when a section has no photo yet. */
export function PhotoPlaceholder({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cx(
        "grain grid place-items-center bg-linen text-center text-muted",
        className,
      )}
    >
      <span className="label relative z-10 px-4">{label ?? "Photo coming soon"}</span>
    </div>
  );
}
