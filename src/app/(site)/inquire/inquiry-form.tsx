"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { BUDGET_RANGES, LEAD_SOURCES } from "@/lib/constants";
import { cx } from "@/components/studio/ui";
import { inquirePage } from "@/content/site";
import { submitInquiry, type InquiryState } from "./actions";

const TYPES = [
  { value: "wedding", label: "Wedding" },
  { value: "elopement", label: "Elopement" },
  { value: "engagement", label: "Engagement" },
  { value: "couples", label: "Couples" },
  { value: "senior", label: "Senior" },
  { value: "portrait", label: "Portrait" },
  { value: "branding", label: "Branding" },
] as const;
type T = (typeof TYPES)[number]["value"];

const isCouple = (t: T) => ["wedding", "elopement", "engagement", "couples"].includes(t);
const isWedding = (t: T) => t === "wedding" || t === "elopement";

const STORY_PROMPT: Record<T, string> = {
  wedding: "What are your dreams for the day? What is your vision? How do you want it to feel?",
  elopement: "Where are you dreaming of saying your vows? What feels most like the two of you?",
  engagement: "How did you meet? What do you love doing together?",
  couples: "Tell me about the two of you — what do you love doing together?",
  senior: "What do you love? Sports, music, style, places that feel like you?",
  portrait: "What's the occasion, and what would you love these portraits to feel like?",
  branding: "Tell me about your business, your audience, and the feeling your brand should have.",
};

function Field({
  label,
  name,
  error,
  required,
  children,
  className,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)} htmlFor={name}>
      <span className="label text-ink-soft">
        {label}
        {required && <span className="text-scarlet"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block font-sans text-xs text-scarlet">{error}</span>}
    </label>
  );
}

export function InquiryForm({ initialType }: { initialType?: string }) {
  const start = TYPES.some((t) => t.value === initialType) ? (initialType as T) : "wedding";
  const [type, setType] = useState<T>(start);
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitInquiry, { status: "idle" });
  const startedAt = useRef<number>(0);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  useEffect(() => {
    if (state.status !== "idle") top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  const err = state.status === "error" ? state.fields ?? {} : {};

  if (state.status === "ok") {
    return (
      <div ref={top} className="scroll-mt-28 py-10 text-center md:py-16">
        <p className="script inked text-[4rem] leading-none text-scarlet md:text-[5.4rem]">{inquirePage.thanksScript}</p>
        <p className="display mt-6 text-[1.6rem] md:text-[2rem]">
          {state.firstName
            ? `${state.firstName}, ${inquirePage.thanksLine.charAt(0).toLowerCase()}${inquirePage.thanksLine.slice(1)}`
            : inquirePage.thanksLine}
        </p>
        <p className="mt-4 text-ink-soft">{inquirePage.responseTime}</p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link href="/book" className="label bg-ink px-8 py-4 text-cream transition hover:bg-wine">
            Book a call with me now
          </Link>
          <Link href="/portfolio" className="label text-ink-soft underline underline-offset-4">
            Keep browsing the portfolio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={top} className="scroll-mt-28">
      {state.status === "error" && (
        <p role="alert" className="mb-6 border border-scarlet/40 bg-scarlet/5 px-4 py-3 font-sans text-sm text-scarlet">
          {state.message}
        </p>
      )}
      <form
        action={(fd) => {
          fd.set("started_at", String(startedAt.current));
          fd.set("type", type);
          return action(fd);
        }}
        className="space-y-8"
        noValidate
      >
        {/* honeypot — hidden from people */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Company website
            <input name="company_url" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <fieldset>
          <legend className="label text-ink-soft">
            What are we creating? <span className="text-scarlet">*</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setType(t.value)}
                aria-pressed={type === t.value}
                className={cx(
                  "label rounded-full border px-4 py-2.5 transition",
                  type === t.value ? "border-ink bg-ink text-cream" : "border-rose text-ink-soft hover:border-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Your first name" name="firstName" required error={err.firstName}>
            <input id="firstName" name="firstName" className="field" autoComplete="given-name" required />
          </Field>
          <Field label="Last name" name="lastName">
            <input id="lastName" name="lastName" className="field" autoComplete="family-name" />
          </Field>
        </div>

        {isCouple(type) && (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={isWedding(type) ? "Your fiancé(e)'s first name" : "Your partner's first name"} name="partnerFirstName">
              <input id="partnerFirstName" name="partnerFirstName" className="field" />
            </Field>
            <Field label="Their last name" name="partnerLastName">
              <input id="partnerLastName" name="partnerLastName" className="field" />
            </Field>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Email" name="email" required error={err.email}>
            <input id="email" name="email" type="email" inputMode="email" autoComplete="email" className="field" required />
          </Field>
          <Field label="Phone" name="phone">
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="field" />
          </Field>
        </div>
        <Field label="Your Instagram" name="instagram">
          <input id="instagram" name="instagram" className="field" placeholder="Let's connect! @yourname" autoCapitalize="none" />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label={isWedding(type) ? "Wedding date" : type === "branding" ? "Ideal shoot date" : "Ideal session date"}
            name="eventDate"
            error={err.eventDate}
          >
            <input id="eventDate" name="eventDate" type="date" className="field" />
          </Field>
          <Field label="Or, dates you're considering" name="eventDateNote">
            <input id="eventDateNote" name="eventDateNote" className="field" placeholder="e.g. a Saturday in fall 2027" />
          </Field>
        </div>

        {isWedding(type) ? (
          <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
            <Field label="Venue & location" name="venue">
              <input id="venue" name="venue" className="field" placeholder="Venue name, city" />
            </Field>
            <Field label="Guest count" name="guestCount">
              <input id="guestCount" name="guestCount" inputMode="numeric" className="field" placeholder="approx." />
            </Field>
          </div>
        ) : (
          <Field label={type === "branding" ? "Where is your business based?" : "Where are you dreaming of shooting?"} name="location">
            <input id="location" name="location" className="field" placeholder="City, a favorite spot, or 'help me choose!'" />
          </Field>
        )}
        {isWedding(type) && (
          <Field label="Coverage you're imagining" name="coverage">
            <select id="coverage" name="coverage" className="field" defaultValue="">
              <option value="">Not sure yet</option>
              <option>Ceremony + portraits (4 hrs)</option>
              <option>Getting ready through first dance (6–8 hrs)</option>
              <option>The whole day, start to send-off</option>
              <option>Multi-day / weekend celebration</option>
            </select>
          </Field>
        )}

        {type === "senior" && (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="School" name="school">
              <input id="school" name="school" className="field" />
            </Field>
            <Field label="Graduation year" name="gradYear">
              <input id="gradYear" name="gradYear" inputMode="numeric" className="field" placeholder="2027" />
            </Field>
          </div>
        )}
        {type === "branding" && (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Business name" name="businessName">
                <input id="businessName" name="businessName" className="field" />
              </Field>
              <Field label="Website or Instagram" name="website">
                <input id="website" name="website" className="field" autoCapitalize="none" />
              </Field>
            </div>
            <Field label="Where will you use these images?" name="imageUse">
              <input id="imageUse" name="imageUse" className="field" placeholder="Website, launch, social, press…" />
            </Field>
          </>
        )}

        <Field label="Photography budget" name="budget">
          <select id="budget" name="budget" className="field" defaultValue="">
            <option value="">Select a range</option>
            {BUDGET_RANGES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>

        <Field label={isWedding(type) ? "Tell me about your day!" : "Tell me everything!"} name="story">
          <textarea id="story" name="story" className="field mt-2" placeholder={STORY_PROMPT[type]} rows={5} />
        </Field>
        <Field label="Why did you inquire with me?" name="why">
          <textarea id="why" name="why" className="field mt-2" placeholder="What about my work were you drawn to?" rows={3} />
        </Field>
        <Field label="How did you find me?" name="source">
          <select id="source" name="source" className="field" defaultValue="">
            <option value="">Select an option</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>

        <div className="pt-2">
          <button
            type="submit"
            disabled={pending}
            className="label w-full bg-ink px-10 py-4 text-cream transition hover:bg-wine disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Sending…" : "Send my inquiry"}
          </button>
          <p className="mt-4 font-sans text-xs text-muted">{inquirePage.responseTime}</p>
        </div>
      </form>
    </div>
  );
}
