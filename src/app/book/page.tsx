import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { BookShell } from "./shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Book a call",
  description: "Choose a time to talk with Scarlet.",
};

const WHERE = { phone: "Phone call", video: "Video call", in_person: "In person" } as const;

export default async function BookIndex() {
  const types = await db.query.meetingTypes.findMany({
    where: eq(schema.meetingTypes.active, true),
    orderBy: [asc(schema.meetingTypes.sort), asc(schema.meetingTypes.name)],
  });
  return (
    <BookShell eyebrow="Let's talk" title="Book a call with Scarlet" script="I'd love to hear your story">
      {types.length === 0 ? (
        <p className="text-center font-sans text-ink-soft">
          Booking isn&apos;t open just yet — please send an inquiry from the website and I&apos;ll be in touch.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {types.map((t) => (
            <li key={t.id}>
              <Link
                href={`/book/${t.slug}`}
                className="group block rounded-sm border border-rule bg-cream p-6 transition hover:border-scarlet"
              >
                <p className="label text-muted">
                  {t.durationMin} minutes · {WHERE[t.location]}
                </p>
                <h2 className="display mt-2 text-2xl">{t.name}</h2>
                {t.description && (
                  <p className="mt-2 text-[1.05rem] leading-relaxed text-ink-soft">{t.description}</p>
                )}
                <p className="label mt-4 text-scarlet">
                  Choose a time <span className="inline-block transition group-hover:translate-x-1">→</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BookShell>
  );
}
