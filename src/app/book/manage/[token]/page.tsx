import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeetingByToken, formatWhen, isPast, zoneLabel } from "@/lib/scheduler";
import { getSettings } from "@/lib/settings";
import { BookShell } from "../../shell";
import { ManageFlow } from "./manage-flow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

export default async function ManageBooking({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getMeetingByToken(token);
  if (!found) notFound();
  const { meeting, type } = found;
  const tz = (await getSettings()).business.timezone;
  const past = isPast(meeting.startsAt.getTime());
  const scheduled = meeting.status === "scheduled";
  const zone = zoneLabel(tz, meeting.startsAt.getTime());
  const where =
    type?.location === "phone" ? "Phone call" : type?.location === "in_person" ? "In person" : "Video call";
  return (
    <BookShell
      eyebrow="Your booking"
      title={meeting.title}
      script={
        meeting.status === "cancelled" ? "this call was cancelled" : past ? "thank you for chatting" : "see you soon"
      }
    >
      <div className="rounded-sm border border-rule bg-cream px-6 py-8 text-center">
        <p className="label text-muted">
          {meeting.status === "cancelled" ? "Cancelled" : past ? "Completed" : "Scheduled for"}
        </p>
        <p className="display mt-2 text-2xl sm:text-3xl">{formatWhen(meeting.startsAt.getTime(), tz)}</p>
        <p className="mt-2 font-sans text-xs text-muted">
          Times shown in {zone.long} ({zone.short})
        </p>
        <p className="mt-4 font-sans text-sm text-ink-soft">
          {type ? `${type.durationMin} minutes · ${where}` : where}
          {type?.locationDetail && scheduled ? ` — ${type.locationDetail}` : ""}
        </p>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          For {meeting.name} · {meeting.email}
        </p>
      </div>
      {meeting.status === "cancelled" && (
        <p className="mt-8 text-center">
          <Link href="/book" className="label text-scarlet underline underline-offset-4">
            Book a new time
          </Link>
        </p>
      )}
      <ManageFlow token={token} canChange={scheduled && !past} />
    </BookShell>
  );
}
