/* eslint-disable @next/next/no-img-element -- studio thumbnails come straight from /media */
import { Badge, Field, Input, Select, Textarea, cx } from "@/components/studio/ui";
import { ConfirmButton, SubmitButton } from "@/components/studio/client-ui";
import { ActionForm } from "../_components/action-form";
import {
  deletePhoto,
  movePhoto,
  savePhotoDetails,
  setCategoryCoverFromPhoto,
  togglePhotoCover,
  togglePhotoFeatured,
} from "./actions";
import type { Photo } from "./queries";

const tinyBtn =
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-sm border px-2 font-sans text-[0.68rem] uppercase tracking-[0.12em] transition disabled:opacity-30";

function Tile({
  photo,
  index,
  total,
  coverId,
  isGallery,
}: {
  photo: Photo;
  index: number;
  total: number;
  coverId: string | null;
  isGallery: boolean;
}) {
  const isCover = coverId === photo.id;
  return (
    <li className="overflow-hidden rounded-sm border border-rule bg-cream">
      <div className="relative aspect-[4/5] bg-linen">
        <img
          src={photo.src}
          alt={photo.alt || "Portfolio photo"}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          className="size-full object-cover"
        />
        <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
          {isCover && <Badge tone="scarlet">Cover</Badge>}
          {photo.featured && <Badge tone="ink">On home page</Badge>}
          {photo.medium && <Badge tone="blush">{photo.medium === "film" ? "Film" : "Digital"}</Badge>}
          {photo.isDemo && <Badge tone="warn">Demo</Badge>}
        </div>
        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-ink/70 px-2 py-0.5 font-sans text-[0.65rem] text-cream">
          {index + 1}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-2">
        <form action={movePhoto}>
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="dir" value="up" />
          <button
            type="submit"
            disabled={index === 0}
            aria-label={`Move photo ${index + 1} earlier`}
            className={cx(tinyBtn, "border-rule text-ink-soft hover:border-ink")}
          >
            ←
          </button>
        </form>
        <form action={movePhoto}>
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="dir" value="down" />
          <button
            type="submit"
            disabled={index === total - 1}
            aria-label={`Move photo ${index + 1} later`}
            className={cx(tinyBtn, "border-rule text-ink-soft hover:border-ink")}
          >
            →
          </button>
        </form>
        <form action={togglePhotoCover}>
          <input type="hidden" name="id" value={photo.id} />
          <button
            type="submit"
            aria-pressed={isCover}
            className={cx(
              tinyBtn,
              isCover ? "border-scarlet bg-scarlet text-cream" : "border-rule text-ink-soft hover:border-ink",
            )}
          >
            Cover
          </button>
        </form>
        <form action={togglePhotoFeatured}>
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="to" value={photo.featured ? "0" : "1"} />
          <button
            type="submit"
            aria-pressed={photo.featured}
            className={cx(
              tinyBtn,
              photo.featured ? "border-ink bg-ink text-cream" : "border-rule text-ink-soft hover:border-ink",
            )}
          >
            Home
          </button>
        </form>
      </div>

      <details className="border-t border-rule">
        <summary className="label flex min-h-11 cursor-pointer items-center px-3 text-ink-soft">
          Details
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <ActionForm action={savePhotoDetails} className="space-y-3">
            <input type="hidden" name="id" value={photo.id} />
            <Field label="Description for screen readers (alt)">
              <Input name="alt" defaultValue={photo.alt} maxLength={300} />
            </Field>
            <Field label="Caption (optional)">
              <Textarea name="caption" defaultValue={photo.caption} maxLength={500} className="min-h-16" />
            </Field>
            <Field label="Made on">
              <Select name="medium" defaultValue={photo.medium ?? ""}>
                <option value="">Not set</option>
                <option value="film">Film</option>
                <option value="digital">Digital</option>
              </Select>
            </Field>
            <SubmitButton variant="secondary">Save details</SubmitButton>
          </ActionForm>

          <div className="flex flex-wrap gap-2">
            <form action={movePhoto}>
              <input type="hidden" name="id" value={photo.id} />
              <input type="hidden" name="dir" value="first" />
              <button type="submit" disabled={index === 0} className={cx(tinyBtn, "border-rule text-ink-soft hover:border-ink")}>
                Make first
              </button>
            </form>
            {isGallery && (
              <form action={setCategoryCoverFromPhoto}>
                <input type="hidden" name="id" value={photo.id} />
                <button type="submit" className={cx(tinyBtn, "border-rule text-ink-soft hover:border-ink")}>
                  Use for category cover
                </button>
              </form>
            )}
            <form action={deletePhoto}>
              <input type="hidden" name="id" value={photo.id} />
              <ConfirmButton confirmText="Tap again to delete">Delete photo</ConfirmButton>
            </form>
          </div>
        </div>
      </details>
    </li>
  );
}

export function PhotoGrid({
  photos,
  coverId,
  isGallery = false,
}: {
  photos: Photo[];
  coverId: string | null;
  isGallery?: boolean;
}) {
  if (photos.length === 0) {
    return (
      <p className="rounded-sm border border-rule bg-parchment/50 px-4 py-8 text-center font-sans text-sm text-ink-soft">
        No photos yet. Use the box above to add some.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {photos.map((p, i) => (
        <Tile key={p.id} photo={p} index={i} total={photos.length} coverId={coverId} isGallery={isGallery} />
      ))}
    </ul>
  );
}
