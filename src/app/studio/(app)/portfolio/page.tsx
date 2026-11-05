/* eslint-disable @next/next/no-img-element -- studio thumbnails come straight from /media */
import type { Metadata } from "next";
import Link from "next/link";
import { requireStudio } from "@/lib/auth";
import { Badge, Card, Field, Input, LinkButton, PageHeader, Textarea, cx } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { ActionForm } from "../_components/action-form";
import { createCategory, moveCategory, toggleCategoryVisible } from "./actions";
import {
  categoryList,
  galleryCountsByCategory,
  highlightCountsByCategory,
  photosById,
} from "./queries";
import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portfolio" };

const tiny =
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-sm border border-rule px-3 font-sans text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft transition hover:border-ink disabled:opacity-30";

export default async function PortfolioPage() {
  await requireStudio();
  const cats = await categoryList();
  const [hl, gl] = await Promise.all([highlightCountsByCategory(), galleryCountsByCategory()]);
  const covers = await photosById(cats.map((c) => c.coverPhotoId));

  // fall back to the first highlight photo when no cover is chosen
  const fallback = new Map<string, string>();
  for (const c of cats) {
    if (c.coverPhotoId && covers.has(c.coverPhotoId)) continue;
    const first = await db
      .select({ src: schema.photos.src })
      .from(schema.photos)
      .where(eq(schema.photos.categoryId, c.id))
      .orderBy(asc(schema.photos.sort))
      .limit(1);
    if (first[0]) fallback.set(c.id, first[0].src);
  }

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Portfolio"
        description="The work on your website. Open a category to add photos (highlights) or full galleries."
      />

      <ul className="grid gap-4 md:grid-cols-2">
        {cats.map((c, i) => {
          const src = (c.coverPhotoId && covers.get(c.coverPhotoId)?.src) || fallback.get(c.id);
          return (
            <li key={c.id}>
              <Card pad={false} className={cx(!c.visible && "opacity-80")}>
                <div className="flex gap-4 p-4">
                  <Link
                    href={`/studio/portfolio/${c.slug}`}
                    className="block size-24 shrink-0 overflow-hidden rounded-sm bg-linen md:size-28"
                    aria-label={`Open ${c.name}`}
                  >
                    {src ? (
                      <img src={src} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center font-sans text-xs text-muted">
                        No cover
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="display text-2xl">{c.name}</h2>
                      <Badge tone={c.visible ? "ok" : "muted"}>{c.visible ? "Shown" : "Hidden"}</Badge>
                    </div>
                    {c.tagline && <p className="script text-2xl text-scarlet">{c.tagline}</p>}
                    <p className="mt-1 font-sans text-xs text-ink-soft">
                      {hl.get(c.id) ?? 0} highlight photos · {gl.get(c.id) ?? 0} galleries
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-3">
                  <LinkButton href={`/studio/portfolio/${c.slug}`} variant="primary">
                    Open
                  </LinkButton>
                  <form action={toggleCategoryVisible}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="to" value={c.visible ? "0" : "1"} />
                    <button type="submit" className={tiny}>
                      {c.visible ? "Hide" : "Show"}
                    </button>
                  </form>
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button type="submit" disabled={i === 0} className={tiny} aria-label={`Move ${c.name} up`}>
                      ↑
                    </button>
                  </form>
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button
                      type="submit"
                      disabled={i === cats.length - 1}
                      className={tiny}
                      aria-label={`Move ${c.name} down`}
                    >
                      ↓
                    </button>
                  </form>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="mt-8">
        <Card title="Add another category">
          <ActionForm action={createCategory} className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input name="name" required maxLength={80} placeholder="Families" />
            </Field>
            <Field label="Tagline (script line)">
              <Input name="tagline" maxLength={120} placeholder="& newborns" />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea name="description" maxLength={600} className="min-h-20" />
            </Field>
            <div className="md:col-span-2">
              <SubmitButton pendingText="Adding…">Add category</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
