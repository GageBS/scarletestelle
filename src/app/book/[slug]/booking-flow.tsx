"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { bookAction, loadSlots, type BookState, type SlotsPayload } from "../actions";
import { SlotPicker } from "../slot-picker";

export function BookingFlow({
  slug,
  meetingTypeId,
  initial,
}: {
  slug: string;
  meetingTypeId: string;
  initial: SlotsPayload;
}) {
  const [data, setData] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<BookState, { ok: true }> | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (picked == null) return setError("Please choose a time first.");
    const f = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await bookAction({
        meetingTypeId,
        startsAt: picked,
        name: String(f.get("name") ?? ""),
        email: String(f.get("email") ?? ""),
        phone: String(f.get("phone") ?? ""),
        notes: String(f.get("notes") ?? ""),
      });
      if (r.ok) return setDone(r);
      setError(r.error);
      if (r.slotTaken) {
        setPicked(null);
        const fresh = await loadSlots(slug);
        if (fresh) setData(fresh);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-sm border border-rule bg-cream px-6 py-10 text-center">
        <p className="script inked text-5xl text-scarlet">You&apos;re booked</p>
        <h2 className="display mt-4 text-2xl">{done.typeName}</h2>
        <p className="mt-2 text-lg">{done.when}</p>
        <p className="mx-auto mt-5 max-w-md font-sans text-sm text-ink-soft">
          {done.emailStatus === "sent"
            ? "A confirmation is on its way to your inbox, with a link to reschedule or cancel."
            : "Your time is saved. The confirmation email couldn't be delivered, so please keep the link below to reschedule or cancel."}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href={done.manageUrl}
            className="inline-flex min-h-11 items-center rounded-sm border border-ink/30 px-5 font-sans text-[0.72rem] uppercase tracking-[0.18em] hover:border-ink"
          >
            Reschedule or cancel
          </Link>
          <Link href="/" className="label text-muted underline-offset-4 hover:underline">
            Back to the site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-10">
      <section>
        <h2 className="label mb-4 text-ink">1 · Pick a time</h2>
        <SlotPicker
          data={data}
          selected={picked}
          onSelect={(t) => {
            setPicked(t);
            setError(null);
          }}
        />
      </section>

      <section className={picked == null ? "opacity-50" : ""}>
        <h2 className="label mb-4 text-ink">2 · About you</h2>
        <div className="space-y-5">
          <input className="field" name="name" placeholder="Your name" autoComplete="name" required maxLength={120} />
          <input
            className="field"
            name="email"
            type="email"
            inputMode="email"
            placeholder="Email"
            autoComplete="email"
            required
            maxLength={200}
          />
          <input
            className="field"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="Phone (optional)"
            autoComplete="tel"
            maxLength={40}
          />
          <textarea
            className="field"
            name="notes"
            placeholder="Anything you'd like me to know beforehand? (optional)"
            maxLength={2000}
          />
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-sm border border-scarlet/40 bg-scarlet/10 px-4 py-3 font-sans text-sm text-scarlet"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || picked == null}
        className="flex min-h-12 w-full items-center justify-center rounded-sm bg-scarlet px-6 font-sans text-[0.78rem] uppercase tracking-[0.2em] text-cream transition hover:bg-wine disabled:opacity-50"
      >
        {pending ? "Booking…" : picked == null ? "Choose a time above" : "Confirm my call"}
      </button>
    </form>
  );
}
