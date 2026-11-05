"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/components/studio/ui";
import { submitReview, type ReviewState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center bg-scarlet px-8 font-sans text-[0.78rem] uppercase tracking-[0.24em] text-cream transition hover:bg-wine disabled:opacity-60 sm:w-auto"
    >
      {pending ? "Sending…" : "Send my words"}
    </button>
  );
}

export function ClientReviewForm({
  token,
  defaultName,
  firstName,
}: {
  token: string;
  defaultName: string;
  firstName: string;
}) {
  const [state, action] = useActionState(submitReview.bind(null, token), null as ReviewState);
  const [rating, setRating] = useState(0);

  if (state?.ok) {
    return (
      <div className="px-2 py-6 text-center" role="status">
        <p className="script inked text-6xl text-scarlet md:text-7xl">thank you{firstName ? `, ${firstName}` : ""}</p>
        <p className="mx-auto mt-6 max-w-md text-lg text-ink-soft">
          Your words mean the world to me. I’ll read them with a full heart, and I’ll only share them on my
          website once I’ve had a look.
        </p>
        <p className="script mt-8 text-4xl text-scarlet">with love, Scarlet</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8 text-left">
      {/* honeypot — real people never see this */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="rv-name" className="label mb-1 block text-ink-soft">
          Your names, as you’d like them shown
        </label>
        <input
          id="rv-name"
          name="name"
          required
          maxLength={120}
          defaultValue={defaultName}
          autoComplete="name"
          className="field"
          placeholder="Hannah & Eric"
        />
      </div>

      <div>
        <label htmlFor="rv-quote" className="label mb-1 block text-ink-soft">
          In your own words
        </label>
        <textarea
          id="rv-quote"
          name="quote"
          required
          minLength={10}
          maxLength={4000}
          rows={7}
          className="field"
          placeholder="How did it feel? What do you want the next couple to know?"
        />
      </div>

      <div>
        <label htmlFor="rv-pull" className="label mb-1 block text-ink-soft">
          One favorite memory, in a single line
        </label>
        <input
          id="rv-pull"
          name="pullQuote"
          maxLength={220}
          className="field"
          placeholder="She made us feel like the only two people there."
        />
      </div>

      <fieldset>
        <legend className="label mb-2 text-ink-soft">How was it? (optional)</legend>
        <input type="hidden" name="rating" value={rating || ""} />
        <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
              onClick={() => setRating(rating === n ? 0 : n)}
              className={cx(
                "grid size-12 place-items-center text-3xl transition",
                n <= rating ? "text-scarlet" : "text-rose hover:text-scarlet/70",
              )}
            >
              {n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 font-sans text-[0.95rem] leading-snug text-ink">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-scarlet" />
        <span>Scarlet may share this on her website.</span>
      </label>

      {state && !state.ok && state.error && (
        <p role="alert" className="border border-scarlet/40 bg-scarlet/10 px-4 py-3 font-sans text-sm text-scarlet">
          {state.error}
        </p>
      )}

      <div className="pt-2 text-center sm:text-left">
        <Submit />
      </div>
    </form>
  );
}
