import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import {
  Badge,
  Card,
  Checkbox,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Textarea,
} from "@/components/studio/ui";
import { ConfirmButton, SubmitButton } from "@/components/studio/client-ui";
import { ActionForm } from "../../../_components/action-form";
import { deleteGallery, updateGallery } from "../../actions";
import { galleryPhotos } from "../../queries";
import { PhotoGrid } from "../../photo-grid";
import { Uploader } from "../../uploader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStudio();
  const { id } = await params;
  const g = await db.query.galleries.findFirst({ where: eq(schema.galleries.id, id) });
  if (!g) notFound();
  const cat = await db.query.categories.findFirst({ where: eq(schema.categories.id, g.categoryId) });
  const photos = await galleryPhotos(g.id);

  return (
    <>
      <PageHeader
        eyebrow={cat ? `Portfolio · ${cat.name}` : "Portfolio"}
        title={g.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={g.published ? "ok" : "muted"}>{g.published ? "Published" : "Draft: not on the website"}</Badge>
            <span>{photos.length} photos</span>
          </span>
        }
        actions={
          cat && (
            <LinkButton href={`/studio/portfolio/${cat.slug}`} variant="ghost">
              ← {cat.name}
            </LinkButton>
          )
        }
      />

      <div className="space-y-8">
        <Card title="Gallery details">
          <ActionForm action={updateGallery} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={g.id} />
            <Field label="Title">
              <Input name="title" defaultValue={g.title} required maxLength={120} />
            </Field>
            <Field label="Subtitle">
              <Input name="subtitle" defaultValue={g.subtitle} maxLength={160} />
            </Field>
            <Field label="Location">
              <Input name="location" defaultValue={g.location} maxLength={120} />
            </Field>
            <Field label="Date">
              <Input name="date" type="date" defaultValue={g.date ?? ""} />
            </Field>
            <Field label="Story" className="md:col-span-2">
              <Textarea name="description" defaultValue={g.description} maxLength={3000} className="min-h-28" />
            </Field>
            <div className="flex flex-wrap items-center gap-4 md:col-span-2">
              <Checkbox name="published" defaultChecked={g.published} label="Published on the website" />
              <SubmitButton>Save</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Photos">
          <p className="mb-4 font-sans text-sm text-ink-soft">
            Use the arrows to reorder. “Cover” picks the picture that represents this gallery; “Home” adds a
            photo to the home page selection. Open “Details” to add a description or mark film vs digital.
          </p>
          <Uploader galleryId={g.id} />
          <div className="mt-5">
            <PhotoGrid photos={photos} coverId={g.coverPhotoId} isGallery />
          </div>
        </Card>

        <Card title="Remove this gallery">
          <p className="mb-3 font-sans text-sm text-ink-soft">
            Deletes the gallery and all {photos.length} of its photos from the studio and the website. This
            cannot be undone.
          </p>
          <form action={deleteGallery}>
            <input type="hidden" name="id" value={g.id} />
            <ConfirmButton confirmText="Tap again to delete everything">Delete gallery</ConfirmButton>
          </form>
        </Card>
      </div>
    </>
  );
}
