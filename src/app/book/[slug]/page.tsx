import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveMeetingType, getAvailableSlots } from "@/lib/scheduler";
import { BookShell } from "../shell";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";

const WHERE = { phone: "Phone call", video: "Video call", in_person: "In person" } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getActiveMeetingType(slug);
  return { title: t ? `Book: ${t.name}` : "Book a call" };
}

export default async function BookType({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = await getActiveMeetingType(slug);
  if (!type) notFound();
  const r = await getAvailableSlots(type);
  return (
    <BookShell
      eyebrow={`${type.durationMin} minutes · ${WHERE[type.location]}`}
      title={type.name}
      script="let's find a time"
    >
      {type.description && (
        <p className="mx-auto -mt-2 mb-10 max-w-xl text-center text-[1.08rem] leading-relaxed text-ink-soft">
          {type.description}
        </p>
      )}
      <BookingFlow
        slug={type.slug}
        meetingTypeId={type.id}
        initial={{ days: r.days, tz: r.tz, zoneShort: r.zone.short, zoneLong: r.zone.long }}
      />
    </BookShell>
  );
}
