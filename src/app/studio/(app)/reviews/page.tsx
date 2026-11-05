import type { Metadata } from "next";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { siteUrl } from "@/lib/settings";
import { projectTypeLabel } from "@/lib/constants";
import { fullName } from "@/lib/format";
import { Badge, Card, EmptyState, Notice, PageHeader, cx } from "@/components/studio/ui";
import { ConfirmButton, CopyButton } from "@/components/studio/client-ui";
import {
  approveReview,
  createReview,
  deleteReview,
  setReviewFlag,
  updateReview,
} from "./actions";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reviews" };

const { testimonials, photos, projects, contacts } = schema;
type Testimonial = typeof testimonials.$inferSelect;

const tiny =
  "inline-flex min-h-10 items-center justify-center rounded-sm border border-rule px-3 font-sans text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft transition hover:border-ink";

function values(t: Testimonial) {
  return {
    id: t.id,
    name: t.name,
    sessionType: t.sessionType,
    quote: t.quote,
    pullQuote: t.pullQuote,
    photoId: t.photoId,
    projectId: t.projectId,
    rating: t.rating,
    featured: t.featured,
    published: t.published,
    sort: t.sort,
  };
}

function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span className="text-scarlet" role="img" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}
      <span className="text-rule">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default async function ReviewsPage() {
  await requireStudio();

  const [all, pickPhotos, projectRows, deliverable] = await Promise.all([
    db.query.testimonials.findMany({ orderBy: [asc(testimonials.sort), desc(testimonials.createdAt)] }),
    db
      .select({ id: photos.id, src: photos.src, alt: photos.alt })
      .from(photos)
      .orderBy(desc(photos.featured), desc(photos.createdAt))
      .limit(80),
    db
      .select({ id: projects.id, title: projects.title })
      .from(projects)
      .orderBy(desc(projects.createdAt))
      .limit(300),
    db
      .select({
        id: projects.id,
        title: projects.title,
        type: projects.type,
        token: projects.portalToken,
        stage: projects.stage,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(projects)
      .innerJoin(contacts, eq(contacts.id, projects.contactId))
      .where(and(inArray(projects.stage, ["delivered", "completed"]), eq(projects.archived, false)))
      .orderBy(desc(projects.deliveredAt), desc(projects.updatedAt)),
  ]);

  // make sure photos already attached to reviews are selectable even if older than the latest 80
  const have = new Set(pickPhotos.map((p) => p.id));
  const missing = all.map((t) => t.photoId).filter((x): x is string => Boolean(x) && !have.has(x as string));
  if (missing.length) {
    pickPhotos.push(
      ...(await db
        .select({ id: photos.id, src: photos.src, alt: photos.alt })
        .from(photos)
        .where(inArray(photos.id, missing))),
    );
  }

  const pending = all.filter((t) => t.source === "client" && !t.published);
  const rest = all.filter((t) => !pending.includes(t));
  const reviewed = new Set(all.map((t) => t.projectId).filter(Boolean));
  const nextSort = all.reduce((m, t) => Math.max(m, t.sort), 0) + 1;
  const base = siteUrl();

  const form = (t: Testimonial) => (
    <ReviewForm
      action={updateReview}
      values={values(t)}
      photos={pickPhotos}
      projects={projectRows}
      submitLabel="Save changes"
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Reviews"
        description="Kind words shown on your website. Clients can send one from their private link; you approve it before it goes live."
      />

      <div className="space-y-8">
        {pending.length > 0 && (
          <Card title={`To approve (${pending.length})`}>
            <div className="mb-4">
              <Notice tone="warn">
                These came from clients and are <strong>not on your website yet</strong>. Read each one, tidy
                it if you like, then approve it.
              </Notice>
            </div>
            <ul className="space-y-5">
              {pending.map((t) => (
                <li key={t.id} className="rounded-sm border border-rule bg-parchment/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="display text-xl">{t.name}</p>
                    <Stars n={t.rating} />
                    <Badge tone="warn">Waiting</Badge>
                  </div>
                  {t.sessionType && <p className="font-sans text-xs text-ink-soft">{t.sessionType}</p>}
                  {t.pullQuote && <p className="script mt-2 text-3xl text-scarlet">{t.pullQuote}</p>}
                  <p className="mt-2 whitespace-pre-line">{t.quote}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={approveReview}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center rounded-sm bg-scarlet px-4 font-sans text-[0.72rem] uppercase tracking-[0.18em] text-cream hover:bg-wine"
                      >
                        Approve &amp; publish
                      </button>
                    </form>
                    <form action={deleteReview}>
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmButton confirmText="Tap again to delete">Delete</ConfirmButton>
                    </form>
                  </div>
                  <details className="mt-3 border-t border-rule">
                    <summary className="label flex min-h-11 cursor-pointer items-center text-ink-soft">
                      Edit before approving
                    </summary>
                    <div className="pt-2">{form(t)}</div>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={`On your website (${rest.length})`}>
          {rest.length === 0 ? (
            <EmptyState title="No reviews yet">Add one below, or send a client their review link.</EmptyState>
          ) : (
            <ul className="divide-y divide-rule">
              {rest.map((t) => (
                <li key={t.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="display text-xl">{t.name}</p>
                    <Stars n={t.rating} />
                    <Badge tone={t.published ? "ok" : "muted"}>{t.published ? "Published" : "Hidden"}</Badge>
                    {t.featured && <Badge tone="ink">Featured</Badge>}
                    {t.isDemo && <Badge tone="warn">Sample</Badge>}
                    {t.source === "client" && <Badge tone="blush">From client</Badge>}
                  </div>
                  {t.sessionType && <p className="font-sans text-xs text-ink-soft">{t.sessionType}</p>}
                  {t.pullQuote && <p className="script mt-1 text-3xl text-scarlet">{t.pullQuote}</p>}
                  <p className={cx("mt-1 line-clamp-3 text-base text-ink-soft")}>{t.quote}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={setReviewFlag}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="field" value="published" />
                      <input type="hidden" name="to" value={t.published ? "0" : "1"} />
                      <button type="submit" className={tiny}>
                        {t.published ? "Hide" : "Publish"}
                      </button>
                    </form>
                    <form action={setReviewFlag}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="field" value="featured" />
                      <input type="hidden" name="to" value={t.featured ? "0" : "1"} />
                      <button type="submit" className={tiny}>
                        {t.featured ? "Unfeature" : "Feature"}
                      </button>
                    </form>
                    <form action={deleteReview}>
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmButton confirmText="Tap again to delete">Delete</ConfirmButton>
                    </form>
                  </div>
                  <details className="mt-2">
                    <summary className="label flex min-h-11 cursor-pointer items-center text-ink-soft">
                      Edit
                    </summary>
                    <div className="pt-2">{form(t)}</div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Add a review yourself">
          <p className="mb-4 font-sans text-sm text-ink-soft">
            For kind words that came by text, email or Instagram. Ask permission before posting someone’s words.
          </p>
          <ReviewForm
            action={createReview}
            values={{
              name: "",
              sessionType: "",
              quote: "",
              pullQuote: "",
              photoId: null,
              projectId: null,
              rating: null,
              featured: false,
              published: true,
              sort: nextSort,
            }}
            photos={pickPhotos}
            projects={projectRows}
            submitLabel="Add review"
          />
        </Card>

        <Card title="Request a review">
          <p className="mb-4 font-sans text-sm text-ink-soft">
            Each client has their own private review link. Copy it into a text or email after their gallery is
            delivered.
          </p>
          {deliverable.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              Nobody is at “Gallery delivered” or “Completed” yet. Their links will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {deliverable.map((p) => {
                const link = `${base}/c/${p.token}/review`;
                return (
                  <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-sans text-sm">
                        {p.title}{" "}
                        <span className="text-muted">
                          · {fullName(p)} · {projectTypeLabel(p.type)}
                        </span>
                      </p>
                      <p className="truncate font-sans text-xs text-muted">{link}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {reviewed.has(p.id) && <Badge tone="ok">Review received</Badge>}
                      <CopyButton text={link} label="Copy review link" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
