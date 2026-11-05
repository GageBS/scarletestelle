"use client";
/* The client's smart-file experience: I. choose a collection → II. read the agreement →
   III. sign. Totals and the agreement text update live from the shared billing math. */
import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/components/studio/ui";
import { Markdown } from "@/components/money/markdown";
import { SignaturePad } from "@/components/money/signature-pad";
import { portalBtn } from "@/components/money/portal-ui";
import { money, formatDay } from "@/lib/format";
import {
  buildSchedule,
  computeTotals,
  describePlan,
  fillFields,
  selectionMergeValues,
} from "@/lib/billing-math";
import type { PaymentPlan } from "@/lib/constants";
import { acceptProposalAction, type AcceptState } from "./actions";

export type Offer = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  inclusions: string[];
};

const STEPS = ["Your collection", "The agreement", "Sign"] as const;
const ROMAN = ["I", "II", "III"];

export function ProposalFlow(props: {
  token: string;
  ptoken: string;
  packages: Offer[];
  addons: Offer[];
  plan: PaymentPlan;
  taxRateBps: number;
  discountCents: number;
  contractTitle: string;
  contractPre: string;
  signedDay: string;
  eventDate: string | null;
  defaultName: string;
  preview: boolean;
}) {
  const [step, setStep] = useState(0);
  const [pkgId, setPkgId] = useState<string | null>(props.packages.length === 1 ? props.packages[0].id : null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [name, setName] = useState(props.defaultName);
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [state, formAction] = useActionState<AcceptState, FormData>(acceptProposalAction, {});
  const topRef = useRef<HTMLDivElement>(null);

  const pkg = props.packages.find((p) => p.id === pkgId) ?? null;
  const chosenAddons = useMemo(
    () => props.addons.filter((a) => addonIds.includes(a.id)),
    [props.addons, addonIds],
  );

  const calc = useMemo(() => {
    if (!pkg) return null;
    const items = [pkg, ...chosenAddons].map((p) => ({ description: p.name, quantity: 1, unitCents: p.priceCents }));
    const totals = computeTotals(items, { discountCents: props.discountCents, taxRateBps: props.taxRateBps });
    const schedule = buildSchedule(props.plan, totals.totalCents, {
      signedDay: props.signedDay,
      eventDate: props.eventDate,
    });
    const values = selectionMergeValues({
      packageName: pkg.name,
      packagePriceCents: pkg.priceCents,
      inclusions: pkg.inclusions,
      addons: chosenAddons.map((a) => ({ name: a.name, priceCents: a.priceCents })),
      totals,
      schedule,
      signedDay: props.signedDay,
    });
    return { totals, schedule, contract: fillFields(props.contractPre, values) };
  }, [pkg, chosenAddons, props.discountCents, props.taxRateBps, props.plan, props.signedDay, props.eventDate, props.contractPre]);

  const dueNow = calc?.schedule.filter((r) => r.dueDate <= props.signedDay).reduce((a, r) => a + r.amountCents, 0) ?? 0;

  const go = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div ref={topRef} className="scroll-mt-6">
      {/* stepper */}
      <ol className="mb-10 grid grid-cols-3 gap-2 text-center" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step || (i > 0 && !pkg)}
              onClick={() => go(i)}
              aria-current={i === step ? "step" : undefined}
              className="flex w-full flex-col items-center gap-1 py-1 disabled:cursor-default"
            >
              <span
                className={cx(
                  "display grid size-10 place-items-center rounded-full border text-sm transition",
                  i === step ? "border-scarlet bg-scarlet text-cream" : i < step ? "border-ink text-ink" : "border-rule text-muted",
                )}
              >
                {ROMAN[i]}
              </span>
              <span className={cx("font-sans text-[0.62rem] uppercase tracking-[0.18em]", i === step ? "text-ink" : "text-muted")}>
                {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* ── I. collection ── */}
      {step === 0 && (
        <section>
          <h2 className="display text-center text-3xl">Choose your collection</h2>
          <div className="mt-8 flex flex-col gap-4" role="radiogroup" aria-label="Collections">
            {props.packages.map((p) => {
              const on = p.id === pkgId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPkgId(p.id)}
                  className={cx(
                    "relative w-full rounded-[2px] border bg-cream/90 p-6 text-left transition sm:p-8",
                    on
                      ? "border-scarlet shadow-[0_18px_40px_-26px_rgb(143_29_33/0.55)] ring-1 ring-scarlet"
                      : "border-rule hover:border-rose",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="display text-[1.7rem] leading-tight">{p.name}</p>
                      <p className="mt-1 font-sans text-lg tracking-wide text-scarlet">{money(p.priceCents)}</p>
                    </div>
                    <span
                      aria-hidden
                      className={cx(
                        "mt-1 grid size-6 shrink-0 place-items-center rounded-full border transition",
                        on ? "border-scarlet bg-scarlet text-cream" : "border-rose",
                      )}
                    >
                      {on && <span className="size-2 rounded-full bg-cream" />}
                    </span>
                  </div>
                  {p.description && <p className="mt-3 text-ink-soft">{p.description}</p>}
                  {p.inclusions.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-1.5">
                      {p.inclusions.map((inc, i) => (
                        <li key={i} className="flex gap-3 text-[1.02rem]">
                          <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rotate-45 border border-scarlet" />
                          {inc}
                        </li>
                      ))}
                    </ul>
                  )}
                  {on && (
                    <span className="absolute -top-3 left-6 bg-scarlet px-3 py-0.5 font-sans text-[0.6rem] uppercase tracking-[0.22em] text-cream">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {props.addons.length > 0 && (
            <div className="mt-12">
              <h3 className="label text-center text-muted">Add a little something</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {props.addons.map((a) => {
                  const on = addonIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className={cx(
                        "flex min-h-16 cursor-pointer gap-3 rounded-[2px] border bg-cream/80 p-4 transition",
                        on ? "border-scarlet ring-1 ring-scarlet" : "border-rule hover:border-rose",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-scarlet"
                        checked={on}
                        onChange={(e) =>
                          setAddonIds((cur) => (e.target.checked ? [...cur, a.id] : cur.filter((x) => x !== a.id)))
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="display text-lg leading-tight">{a.name}</span>
                          <span className="shrink-0 font-sans text-sm text-scarlet">+{money(a.priceCents)}</span>
                        </span>
                        {a.description && <span className="mt-1 block text-[0.95rem] text-ink-soft">{a.description}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── II. agreement ── */}
      {step === 1 && calc && (
        <section>
          <h2 className="display text-center text-3xl">{props.contractTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-ink-soft">
            Please read your agreement — it already includes the collection you chose.
          </p>
          <div className="doc-scroll mt-8 max-h-[62dvh] overflow-y-auto overscroll-contain rounded-[2px] border border-rule bg-cream px-5 py-6 shadow-inner sm:px-8">
            <Markdown text={calc.contract} className="doc-prose text-[1.02rem]" />
          </div>
          <p className="mt-3 text-center font-sans text-xs text-muted">Scroll inside the box to read it all.</p>
        </section>
      )}

      {/* ── III. sign ── */}
      {step === 2 && calc && pkg && (
        <section>
          <h2 className="display text-center text-3xl">Sign &amp; reserve your date</h2>
          <form action={formAction} className="mx-auto mt-8 flex max-w-xl flex-col gap-6">
            <input type="hidden" name="token" value={props.token} />
            <input type="hidden" name="ptoken" value={props.ptoken} />
            <input type="hidden" name="packageId" value={pkg.id} />
            {addonIds.map((id) => (
              <input key={id} type="hidden" name="addonIds" value={id} />
            ))}
            <input type="hidden" name="signatureImage" value={sig ?? ""} />

            <label className="block">
              <span className="label text-muted">Your full legal name</span>
              <input
                name="signatureName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className="field mt-1 text-xl"
                placeholder="First and last name"
              />
            </label>

            <div>
              <span className="label text-muted">Your signature</span>
              <div className="mt-2">
                <SignaturePad onChange={setSig} />
              </div>
            </div>

            <label className="flex cursor-pointer gap-3 text-[1rem] leading-snug">
              <input
                type="checkbox"
                name="agree"
                value="yes"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-scarlet"
              />
              <span>
                I agree to sign electronically. My typed name and drawn signature are the legal equivalent of my
                handwritten signature, and I&apos;ve read and agree to the {props.contractTitle}.
              </span>
            </label>

            {state.error && (
              <p role="alert" className="rounded-[2px] border border-scarlet/40 bg-scarlet/10 px-4 py-3 font-sans text-sm text-scarlet">
                {state.error}
              </p>
            )}
            {props.preview && (
              <p className="rounded-[2px] border border-rose bg-blush/40 px-4 py-3 font-sans text-sm text-wine">
                Studio preview — signing is turned off while you&apos;re logged in to the studio.
              </p>
            )}
            <SignButton disabled={props.preview || !sig || !agree || name.trim().length < 2} dueNow={dueNow} />
            {!props.preview && (!sig || !agree || name.trim().length < 2) && (
              <p className="-mt-3 text-center font-sans text-xs text-muted">
                Type your name, draw your signature and tick the box to continue.
              </p>
            )}
          </form>
        </section>
      )}

      {/* ── live summary + navigation (sticks to the bottom on phones) ── */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-10 border-t border-rule bg-parchment/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-[2px] sm:border sm:px-6">
        {calc ? (
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 font-sans text-sm">
            <div>
              <p className="label text-muted">Your total</p>
              <p className="display text-3xl">{money(calc.totals.totalCents)}</p>
              {(calc.totals.discountCents > 0 || calc.totals.taxCents > 0) && (
                <p className="text-xs text-ink-soft">
                  {money(calc.totals.subtotalCents)}
                  {calc.totals.discountCents > 0 && ` − ${money(calc.totals.discountCents)} discount`}
                  {calc.totals.taxCents > 0 && ` + ${money(calc.totals.taxCents)} tax`}
                </p>
              )}
            </div>
            <div className="text-right text-ink-soft">
              {dueNow > 0 ? (
                <p>
                  <span className="text-ink">{money(dueNow)}</span> due today to reserve your date
                </p>
              ) : calc.schedule[0] ? (
                <p>First payment due {formatDay(calc.schedule[0].dueDate, "medium")}</p>
              ) : null}
              <p className="text-xs">{describePlan(props.plan)}</p>
            </div>
          </div>
        ) : (
          <p className="text-center font-sans text-sm text-ink-soft">Choose a collection to see your total.</p>
        )}
        {step < 2 && (
          <div className="mt-4 flex gap-3">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className={cx(portalBtn.outline, "flex-1 sm:flex-none")}>
                Back
              </button>
            )}
            <button
              type="button"
              disabled={!pkg}
              onClick={() => go(step + 1)}
              className={cx(portalBtn.primary, "flex-[2] sm:ml-auto sm:flex-none")}
            >
              {step === 0 ? "Continue to agreement" : "I've read it — continue"}
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="mt-3">
            <button type="button" onClick={() => go(1)} className={portalBtn.quiet}>
              ← Back to the agreement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SignButton({ disabled, dueNow }: { disabled: boolean; dueNow: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={cx(portalBtn.accent, "w-full")}>
      {pending ? "Signing…" : dueNow > 0 ? "Sign & continue to payment" : "Sign my agreement"}
    </button>
  );
}
