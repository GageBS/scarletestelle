"use client";
/* Proposal builder: offer 1–3 collections + add-ons, attach a contract, set the payment
   plan, tax, discount and expiry; live preview of what each collection will cost. */
import { useActionState, useState } from "react";
import { Card, Field, Input, Notice, Select, Textarea, cx } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { buildSchedule, computeTotals, percentToBps } from "@/lib/billing-math";
import { formatDay, money, parseMoney } from "@/lib/format";
import type { PaymentPlan } from "@/lib/constants";
import { saveProposal, type FormState } from "./actions";

export type PkgOption = {
  id: string;
  name: string;
  priceCents: number;
  isAddon: boolean;
  active: boolean;
  match: boolean; // same kind of session as the project
  typeLabel: string;
};
export type TemplateOption = { id: string; name: string; match: boolean; attorneyNote: boolean };

export type ProposalValues = {
  id?: string;
  title: string;
  message: string;
  packageIds: string[];
  addonIds: string[];
  contractTemplateId: string;
  plan: PaymentPlan;
  taxPercent: string;
  discount: string;
  expiresOn: string;
  emailSubject: string;
  emailBody: string;
};

export function ProposalForm({
  project,
  packages,
  templates,
  values,
  today,
  sent,
}: {
  project: { id: string; title: string; eventDate: string | null };
  packages: PkgOption[];
  templates: TemplateOption[];
  values: ProposalValues;
  today: string;
  sent: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveProposal, {});
  const [pkgIds, setPkgIds] = useState(values.packageIds);
  const [addonIds, setAddonIds] = useState(values.addonIds);
  const [showAll, setShowAll] = useState(
    values.packageIds.concat(values.addonIds).some((id) => packages.find((p) => p.id === id && !p.match)),
  );
  const [tplId, setTplId] = useState(values.contractTemplateId);
  const p0 = values.plan;
  const [kind, setKind] = useState<PaymentPlan["kind"]>(p0.kind);
  const [fullDays, setFullDays] = useState(String(p0.kind === "full" ? p0.dueDaysAfterSigning : 0));
  const [retPct, setRetPct] = useState(String(p0.kind === "retainer" ? p0.retainerPercent : 30));
  const [balDays, setBalDays] = useState(String(p0.kind === "retainer" ? p0.balanceDueDaysBeforeEvent : 30));
  const [instCount, setInstCount] = useState(String(p0.kind === "installments" ? p0.count : 3));
  const [instFirst, setInstFirst] = useState(String(p0.kind === "installments" ? p0.firstPercent : 30));
  const [instFinal, setInstFinal] = useState(String(p0.kind === "installments" ? p0.finalDueDaysBeforeEvent : 30));
  const [tax, setTax] = useState(values.taxPercent);
  const [discount, setDiscount] = useState(values.discount);

  const plan: PaymentPlan =
    kind === "full"
      ? { kind, dueDaysAfterSigning: Number(fullDays) || 0 }
      : kind === "retainer"
        ? { kind, retainerPercent: Number(retPct) || 0, balanceDueDaysBeforeEvent: Number(balDays) || 0 }
        : {
            kind,
            count: Number(instCount) || 2,
            firstPercent: Number(instFirst) || 0,
            finalDueDaysBeforeEvent: Number(instFinal) || 0,
          };
  const visible = packages.filter((p) => (showAll || p.match) && (p.active || [...pkgIds, ...addonIds].includes(p.id)));
  const collections = visible.filter((p) => !p.isAddon);
  const addons = visible.filter((p) => p.isAddon);
  const tpl = templates.find((t) => t.id === tplId);
  const visibleTemplates = templates.filter((t) => showAll || t.match || t.id === tplId);
  const taxBps = percentToBps(tax) ?? 0;
  const discountCents = parseMoney(discount) ?? 0;

  const toggle = (list: string[], set: (v: string[]) => void, id: string, on: boolean) =>
    set(on ? [...list, id] : list.filter((x) => x !== id));

  return (
    <form action={action} className="flex flex-col gap-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="projectId" value={project.id} />

      {sent && (
        <Notice tone="warn">
          Already sent — your client hasn&apos;t opened it yet, so changes are still safe. Once they open it, it locks.
        </Notice>
      )}

      <Card title="The basics">
        <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
          <Field label="Title">
            <Input name="title" defaultValue={values.title} required />
          </Field>
          <Field label="Offer expires" hint="Optional">
            <Input type="date" name="expiresOn" defaultValue={values.expiresOn} min={today} />
          </Field>
          <Field label="Personal message" hint="Shown at the top of the proposal." className="md:col-span-2">
            <Textarea name="message" defaultValue={values.message} className="min-h-36" />
          </Field>
        </div>
      </Card>

      <Card
        title={`Collections · ${pkgIds.length}/3`}
        actions={
          <label className="flex items-center gap-2 font-sans text-xs text-ink-soft">
            <input type="checkbox" className="size-4 accent-scarlet" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show all session types
          </label>
        }
      >
        {collections.length === 0 ? (
          <p className="font-sans text-sm text-ink-soft">
            No collections for this kind of session yet — add some in Packages &amp; pricing, or tick “Show all session types”.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {collections.map((p) => {
              const on = pkgIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={cx(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 font-sans text-sm transition",
                    on ? "border-scarlet bg-blush/30" : "border-rule hover:border-rose",
                    !on && pkgIds.length >= 3 && "pointer-events-none opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    name="packageIds"
                    value={p.id}
                    checked={on}
                    disabled={!on && pkgIds.length >= 3}
                    onChange={(e) => toggle(pkgIds, setPkgIds, p.id, e.target.checked)}
                    className="size-4 accent-scarlet"
                  />
                  <span className="flex-1">
                    {p.name}
                    {!p.match && <span className="ml-1 text-xs text-muted">({p.typeLabel})</span>}
                    {!p.active && <span className="ml-1 text-xs text-scarlet">(inactive)</span>}
                  </span>
                  <span className="text-ink-soft">{money(p.priceCents)}</span>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      <Card title={`Optional add-ons · ${addonIds.length}`}>
        {addons.length === 0 ? (
          <p className="font-sans text-sm text-ink-soft">No add-ons for this session type.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {addons.map((p) => {
              const on = addonIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={cx(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 font-sans text-sm transition",
                    on ? "border-scarlet bg-blush/30" : "border-rule hover:border-rose",
                  )}
                >
                  <input
                    type="checkbox"
                    name="addonIds"
                    value={p.id}
                    checked={on}
                    onChange={(e) => toggle(addonIds, setAddonIds, p.id, e.target.checked)}
                    className="size-4 accent-scarlet"
                  />
                  <span className="flex-1">
                    {p.name}
                    {!p.match && <span className="ml-1 text-xs text-muted">({p.typeLabel})</span>}
                  </span>
                  <span className="text-ink-soft">+{money(p.priceCents)}</span>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Agreement">
        <Field label="Contract template">
          <Select name="contractTemplateId" value={tplId} onChange={(e) => setTplId(e.target.value)}>
            <option value="">— Choose a contract —</option>
            {visibleTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        {tpl?.attorneyNote && (
          <div className="mt-3">
            <Notice tone="warn">
              This template still starts with the attorney-review note — your client would see and sign it. Edit the
              template in Contracts once it&apos;s been reviewed.
            </Notice>
          </div>
        )}
      </Card>

      <Card title="Payment plan, tax & discount">
        <input type="hidden" name="planKind" value={kind} />
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["retainer", "Retainer + balance"],
              ["installments", "Installments"],
              ["full", "Paid in full"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cx(
                "min-h-11 rounded-sm border px-3 font-sans text-sm transition",
                kind === k ? "border-ink bg-ink text-cream" : "border-rule text-ink-soft hover:border-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {kind === "full" && (
            <Field label="Due days after signing" hint="0 = at signing">
              <Input name="fullDueDays" inputMode="numeric" value={fullDays} onChange={(e) => setFullDays(e.target.value)} />
            </Field>
          )}
          {kind === "retainer" && (
            <>
              <Field label="Retainer %">
                <Input name="retainerPercent" inputMode="decimal" value={retPct} onChange={(e) => setRetPct(e.target.value)} />
              </Field>
              <Field label="Balance due (days before date)" hint="No date yet → 14 days after signing">
                <Input name="balanceDays" inputMode="numeric" value={balDays} onChange={(e) => setBalDays(e.target.value)} />
              </Field>
            </>
          )}
          {kind === "installments" && (
            <>
              <Field label="Number of payments">
                <Input name="instCount" inputMode="numeric" value={instCount} onChange={(e) => setInstCount(e.target.value)} />
              </Field>
              <Field label="First payment %">
                <Input name="instFirstPercent" inputMode="decimal" value={instFirst} onChange={(e) => setInstFirst(e.target.value)} />
              </Field>
              <Field label="Final payment (days before date)">
                <Input name="instFinalDays" inputMode="numeric" value={instFinal} onChange={(e) => setInstFinal(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-md">
          <Field label="Tax %">
            <Input name="taxPercent" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Discount ($)">
            <Input name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </Field>
        </div>

        {pkgIds.length > 0 && (
          <div className="mt-5 rounded-sm border border-rule bg-parchment/50 p-3">
            <p className="label mb-2 text-muted">
              Preview if signed today{project.eventDate ? ` · date ${formatDay(project.eventDate, "medium")}` : " · no date set"}
            </p>
            <ul className="flex flex-col gap-2 font-sans text-sm">
              {pkgIds.map((id) => {
                const p = packages.find((x) => x.id === id);
                if (!p) return null;
                const t = computeTotals([{ description: p.name, quantity: 1, unitCents: p.priceCents }], {
                  taxRateBps: taxBps,
                  discountCents,
                });
                const sched = buildSchedule(plan, t.totalCents, { signedDay: today, eventDate: project.eventDate });
                return (
                  <li key={id}>
                    <span className="text-ink">{p.name}</span> — {money(t.totalCents)}
                    <span className="block text-xs text-ink-soft">
                      {sched.map((r) => `${r.label} ${money(r.amountCents)} ${r.dueDate === today ? "at signing" : formatDay(r.dueDate, "medium")}`).join(" · ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Email to your client">
        <div className="grid gap-4">
          <Field label="Subject">
            <Input name="emailSubject" defaultValue={values.emailSubject} />
          </Field>
          <Field
            label="Message"
            hint="Merge fields work here, plus {{proposal_link}} and {{proposal_title}}. The link is added automatically if you leave it out."
          >
            <Textarea name="emailBody" defaultValue={values.emailBody} className="min-h-48" />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 rounded-sm border border-rule bg-cream/95 p-3 backdrop-blur sm:flex-row sm:items-center lg:bottom-4">
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="intent" value="save" variant="secondary">
            Save draft
          </SubmitButton>
          <SubmitButton name="intent" value="send" variant="accent" pendingText="Sending…">
            {sent ? "Save & re-send" : "Send to client"}
          </SubmitButton>
        </div>
        {state.error && <p className="font-sans text-sm text-scarlet sm:ml-3">{state.error}</p>}
      </div>
    </form>
  );
}
