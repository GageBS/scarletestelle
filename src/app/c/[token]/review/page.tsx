import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { coupleName } from "@/lib/format";
import { ClientReviewForm } from "./review-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Share your experience",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.portalToken, token),
  });
  if (!project) notFound();

  const contact = await db.query.contacts.findFirst({
    where: eq(schema.contacts.id, project.contactId),
  });
  const already = await db.query.testimonials.findFirst({
    where: and(
      eq(schema.testimonials.projectId, project.id),
      eq(schema.testimonials.source, "client"),
    ),
  });
  const first = contact?.firstName ?? "";

  return (
    <div className="text-ink">
      <div className="mx-auto max-w-xl">
        <header className="text-center">
          <p className="script inked text-5xl text-scarlet md:text-6xl">a few kind words</p>
          <h1 className="display mt-3 text-3xl uppercase tracking-[0.12em] md:text-4xl">
            {first ? `How was it, ${first}?` : "How was it?"}
          </h1>
          {!already && (
            <p className="mx-auto mt-4 max-w-md text-lg text-ink-soft">
              Thank you for trusting me with something so dear. If you have a moment, I would love to hear
              how it felt. Take your time; there are no wrong words.
            </p>
          )}
        </header>

        <div className="mx-auto my-8 h-px w-24 bg-rose" aria-hidden />

        {already ? (
          <div className="text-center" role="status">
            <p className="script inked text-5xl text-scarlet">thank you</p>
            <p className="mx-auto mt-5 max-w-md text-lg text-ink-soft">
              Your words have already reached me, and they mean the world. If you would like to change
              anything, just reply to any of my emails and I will take care of it.
            </p>
          </div>
        ) : (
          <ClientReviewForm
            token={token}
            defaultName={contact ? coupleName(contact) : ""}
            firstName={first}
          />
        )}
      </div>
    </div>
  );
}
