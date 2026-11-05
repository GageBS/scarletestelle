/* eslint-disable @next/next/no-img-element -- studio thumbnails come straight from /media */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { formatDay } from "@/lib/format";
import {
  Badge,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Textarea,
  cx,
} from "@/components/studio/ui";
import { ConfirmButton, SubmitButton } from "@/components/studio/client-ui";
import { ActionForm } from "../../_components/action-form";
import {
  createGallery,
  deleteCategory,
  moveGallery,
  toggleGalleryPublished,
  updateCategory,
} from "../actions";
import {
  categoryBySlug,
  categoryGalleries,
  galleryPhotos,
  highlightPhotos,
  photoCountsByGallery,
  photosById,
} from "../queries";
import { PhotoGrid } from "../photo-grid";
import { Uploader } from "../uploader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portfolio category" };

const tiny =
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-sm border border-rule px-3 font-sans text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft transition hover:border-ink disabled:opacity-30";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStudio();
  const { slug } = await params;
  const cat = await categoryBySlug(slug);
  if (!cat) notFound();

  const [photos, gals, counts] = await Promise.all([
    highlightPhotos(cat.id),
    categoryGalleries(cat.id),
    photoCountsByGallery(),
  ]);
  const covers = await photosById(gals.map((g) => g.coverPhotoId));
  const firstOf = new Map<string, string>();
  for (const g of gals) {
    if (g.coverPhotoId && covers.has(g.coverPhotoId)) continue;
    const first = (await galleryPhotos(g.id))[0];
    if (first) firstOf.set(g.id, first.src);
  }
  const empty = photos.length === 0 && gals.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        actions={
          <LinkButton href="/studio/portfolio" variant="ghost">
            ← All categories
          </LinkButton>
        }
        title={cat.name}
        description="Highlights are loose favorites; galleries are full stories."
      />

      <div className="space-y-8">
        <Card title="About this category">
          <ActionForm action={updateCategory} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={cat.id} />
            <Field label="Name">
              <Input name="name" defaultValue={cat.name} required maxLength={80} />
            </Field>
            <Field label="Tagline (script line)" hint="A short line shown in handwriting, like “& elopements”.">
              <Input name="tagline" defaultValue={cat.tagline} maxLength={120} />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea name="description" defaultValue={cat.description} maxLength={600} className="min-h-24" />
            </Field>
            <div className="flex flex-wrap items-center gap-4 md:col-span-2">
              <Checkbox name="visible" defaultChecked={cat.visible} label="Show this category on the website" />
              <SubmitButton>Save</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title={`Highlights (${photos.length})`}>
          <p className="mb-4 font-sans text-sm text-ink-soft">
            Favorite single images for {cat.name.toLowerCase()}. The cover is the picture used for this
            category on the home page and portfolio. “Home” puts a photo in the home-page selection.
          </p>
          <Uploader categoryId={cat.id} />
          <div className="mt-5">
            <PhotoGrid photos={photos} coverId={cat.coverPhotoId} />
          </div>
        </Card>

        <Card title={`Galleries (${gals.length})`}>
          {gals.length === 0 ? (
            <EmptyState title="No galleries yet">
              A gallery is a full story, like “Hannah &amp; Eric · Sedona”. Add one below.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-rule">
              {gals.map((g, i) => {
                const src = (g.coverPhotoId && covers.get(g.coverPhotoId)?.src) || firstOf.get(g.id);
                return (
                  <li key={g.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                    <Link
                      href={`/studio/portfolio/gallery/${g.id}`}
                      className="flex min-w-0 flex-1 items-center gap-4"
                    >
                      <span className="block size-20 shrink-0 overflow-hidden rounded-sm bg-linen">
                        {src && <img src={src} alt="" className="size-full object-cover" />}
                      </span>
                      <span className="min-w-0">
                        <span className="display block truncate text-xl">{g.title}</span>
                        <span className="block truncate font-sans text-xs text-ink-soft">
                          {[g.subtitle, g.location, g.date ? formatDay(g.date) : ""].filter(Boolean).join(" · ") ||
                            "No details yet"}
                        </span>
                        <span className="mt-1 flex items-center gap-2 font-sans text-xs text-muted">
                          {counts.get(g.id) ?? 0} photos
                          <Badge tone={g.published ? "ok" : "muted"}>{g.published ? "Published" : "Draft"}</Badge>
                        </span>
                      </span>
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleGalleryPublished}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="to" value={g.published ? "0" : "1"} />
                        <button type="submit" className={tiny}>
                          {g.published ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                      <form action={moveGallery}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="dir" value="up" />
                        <button type="submit" disabled={i === 0} className={tiny} aria-label={`Move ${g.title} up`}>
                          ↑
                        </button>
                      </form>
                      <form action={moveGallery}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="dir" value="down" />
                        <button
                          type="submit"
                          disabled={i === gals.length - 1}
                          className={tiny}
                          aria-label={`Move ${g.title} down`}
                        >
                          ↓
                        </button>
                      </form>
                      <LinkButton href={`/studio/portfolio/gallery/${g.id}`} variant="secondary">
                        Edit
                      </LinkButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <details className={cx("rounded-sm border border-rule bg-parchment/40", gals.length > 0 ? "mt-5" : "mt-2")}>
            <summary className="label flex min-h-11 cursor-pointer items-center px-4 text-ink">
              + New gallery
            </summary>
            <ActionForm action={createGallery} className="grid gap-4 p-4 md:grid-cols-2">
              <input type="hidden" name="categoryId" value={cat.id} />
              <Field label="Title">
                <Input name="title" required maxLength={120} placeholder="Hannah & Eric" />
              </Field>
              <Field label="Subtitle">
                <Input name="subtitle" maxLength={160} placeholder="A desert ceremony" />
              </Field>
              <Field label="Location">
                <Input name="location" maxLength={120} placeholder="Sedona, Arizona" />
              </Field>
              <Field label="Date">
                <Input name="date" type="date" />
              </Field>
              <Field label="Story" className="md:col-span-2">
                <Textarea name="description" maxLength={3000} className="min-h-24" />
              </Field>
              <div className="md:col-span-2">
                <p className="mb-3 font-sans text-xs text-muted">
                  New galleries start as a draft. Add photos, then publish when you’re happy.
                </p>
                <SubmitButton pendingText="Creating…">Create gallery</SubmitButton>
              </div>
            </ActionForm>
          </details>
        </Card>

        {empty && (
          <Card title="Remove this category">
            <p className="mb-3 font-sans text-sm text-ink-soft">
              This category is empty, so it can be deleted safely.
            </p>
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={cat.id} />
              <ConfirmButton confirmText="Tap again to delete">Delete category</ConfirmButton>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
