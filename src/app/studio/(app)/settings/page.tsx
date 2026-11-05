import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Checkbox, Field, Input, PageHeader, Select, Textarea } from "@/components/studio/ui";
import { ConfirmButton, SubmitButton } from "@/components/studio/client-ui";
import { ActionForm } from "../_components/action-form";
import { removeDemoPhotos, removeSampleClients, saveBusiness, saveNotifications, savePayments } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

const ZONES: [string, string][] = [
  ["America/Phoenix", "Arizona (no daylight saving)"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Denver", "Mountain"],
  ["America/Boise", "Mountain (Idaho)"],
  ["America/Chicago", "Central"],
  ["America/New_York", "Eastern"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
];

async function counts() {
  const n = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  return Promise.all([
    n(db.select({ n: sql<number>`count(*)` }).from(schema.contacts).where(eq(schema.contacts.isSample, true))),
    n(db.select({ n: sql<number>`count(*)` }).from(schema.projects).where(eq(schema.projects.isSample, true))),
    n(db.select({ n: sql<number>`count(*)` }).from(schema.photos).where(eq(schema.photos.isDemo, true))),
    n(db.select({ n: sql<number>`count(*)` }).from(schema.testimonials).where(eq(schema.testimonials.isDemo, true))),
  ]);
}

function Connection({
  title,
  ok,
  children,
}: {
  title: string;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2">
        <p className="font-sans text-sm font-medium">{title}</p>
        <Badge tone={ok ? "ok" : "warn"}>{ok ? "Connected" : "Not set up"}</Badge>
      </div>
      <p className="font-sans text-sm text-ink-soft">{children}</p>
    </li>
  );
}

export default async function SettingsPage() {
  await requireStudio();
  const s = await getSettings();
  const zoneList = ZONES.some(([z]) => z === s.business.timezone)
    ? ZONES
    : [[s.business.timezone, s.business.timezone] as [string, string], ...ZONES];

  const emailOk = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const stripeOk = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const dbUrl = process.env.DATABASE_URL ?? "file:./data/studio.db";
  const hosted = !dbUrl.startsWith("file:");

  const [sampleContacts, sampleProjects, demoPhotos, demoReviews] = await counts();

  return (
    <>
      <PageHeader eyebrow="Website" title="Settings" description="Your business details, how you get paid, and what’s connected." />

      <div className="space-y-8">
        <Card title="Business">
          <ActionForm action={saveBusiness} className="grid gap-4 md:grid-cols-2">
            <Field label="Business name">
              <Input name="name" defaultValue={s.business.name} required />
            </Field>
            <Field label="Your name">
              <Input name="photographer" defaultValue={s.business.photographer} required />
            </Field>
            <Field label="Studio email" hint="Shown to clients; replies come here.">
              <Input name="email" type="email" inputMode="email" defaultValue={s.business.email} />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" inputMode="tel" defaultValue={s.business.phone} />
            </Field>
            <Field label="Instagram">
              <Input name="instagram" defaultValue={s.business.instagram} placeholder="@scarletestelle" />
            </Field>
            <Field label="Location">
              <Input name="location" defaultValue={s.business.location} placeholder="Phoenix, Arizona · travels everywhere" />
            </Field>
            <Field label="Time zone" hint="Used for “today”, reminders, bookings and reports.">
              <Select name="timezone" defaultValue={s.business.timezone}>
                {zoneList.map(([z, label]) => (
                  <option key={z} value={z}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Invoice prefix" hint="Invoices read like SE-2026-0001.">
              <Input name="invoicePrefix" defaultValue={s.business.invoicePrefix} maxLength={10} />
            </Field>
            <Field label="Name you sign contracts with">
              <Input name="signatureName" defaultValue={s.business.signatureName} />
            </Field>
            <div className="md:col-span-2">
              <SubmitButton>Save business</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Payments">
          <ActionForm action={savePayments} className="grid gap-4 md:grid-cols-2">
            <Field label="Venmo">
              <Input name="venmo" defaultValue={s.payments.venmo} placeholder="@scarlet-estelle" />
            </Field>
            <Field label="Zelle (phone or email)">
              <Input name="zelle" defaultValue={s.payments.zelle} />
            </Field>
            <Field label="Make checks payable to">
              <Input name="checkPayableTo" defaultValue={s.payments.checkPayableTo} />
            </Field>
            <Field label="Default sales tax (%)" hint="Use 0 if you don’t charge tax on photography.">
              <Input
                name="taxPercent"
                inputMode="decimal"
                defaultValue={String(s.payments.defaultTaxRateBps / 100)}
              />
            </Field>
            <Field label="Extra payment instructions" className="md:col-span-2" hint="Shown on invoices next to Venmo, Zelle and check.">
              <Textarea name="instructions" defaultValue={s.payments.instructions} className="min-h-20" />
            </Field>
            <div className="md:col-span-2">
              <SubmitButton>Save payments</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Notifications">
          <ActionForm action={saveNotifications} className="space-y-4">
            <Field
              label="Send alerts to"
              hint={`Leave blank to use your studio email${s.business.email ? ` (${s.business.email})` : ""}.`}
            >
              <Input name="notifyEmail" type="email" inputMode="email" defaultValue={s.notifications.notifyEmail} />
            </Field>
            <div className="flex flex-col gap-3">
              <Checkbox name="notifyOnInquiry" defaultChecked={s.notifications.notifyOnInquiry} label="A new inquiry comes in" />
              <Checkbox name="notifyOnSigned" defaultChecked={s.notifications.notifyOnSigned} label="A client signs a contract" />
              <Checkbox name="notifyOnPayment" defaultChecked={s.notifications.notifyOnPayment} label="A payment arrives" />
            </div>
            <SubmitButton>Save notifications</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="Connections">
          <ul className="divide-y divide-rule">
            <Connection title="Email" ok={emailOk}>
              {emailOk
                ? "Emails to clients and alerts to you are being delivered."
                : "Emails are being saved in the Emails page but NOT sent. To send them, create a free Resend account, verify your domain, then add RESEND_API_KEY and EMAIL_FROM (like “Scarlet <hello@yourdomain.com>”) to .env.local or your host’s settings, and restart."}
            </Connection>
            <Connection title="Card payments" ok={stripeOk}>
              {stripeOk
                ? "Clients can pay invoices by card."
                : "Clients see your Venmo, Zelle and check instructions instead. To accept cards, create a Stripe account, then add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (from the webhook your developer sets up in Stripe) to .env.local or your host’s settings, and restart."}
            </Connection>
            <Connection title="Database" ok={hosted}>
              {hosted
                ? "Your information is stored in a hosted database, so it’s safe if your computer or server changes."
                : "Your information is stored in a file on this computer (data/studio.db). That’s fine for trying things out. Before going live, switch to a hosted database (Turso): set DATABASE_URL to the libsql:// address and DATABASE_AUTH_TOKEN. Until then, back up the data folder."}
            </Connection>
          </ul>
        </Card>

        <Card title="Sample & demo content">
          <p className="mb-4 font-sans text-sm text-ink-soft">
            When you’re ready to go live, clear out the placeholder content so only your real clients and photos remain.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <ActionForm action={removeSampleClients} className="space-y-3">
              <p className="font-sans text-sm">
                <strong>{sampleContacts}</strong> sample client{sampleContacts === 1 ? "" : "s"} and{" "}
                <strong>{sampleProjects}</strong> sample project{sampleProjects === 1 ? "" : "s"}, with their
                proposals, invoices and emails.
              </p>
              <ConfirmButton disabled={sampleContacts + sampleProjects === 0} confirmText="Tap again to remove">
                Remove sample clients
              </ConfirmButton>
            </ActionForm>
            <ActionForm action={removeDemoPhotos} className="space-y-3">
              <p className="font-sans text-sm">
                <strong>{demoPhotos}</strong> demo photo{demoPhotos === 1 ? "" : "s"} and{" "}
                <strong>{demoReviews}</strong> sample review{demoReviews === 1 ? "" : "s"}. Galleries left empty
                afterward are removed too. Your own uploads are never touched.
              </p>
              <ConfirmButton disabled={demoPhotos + demoReviews === 0} confirmText="Tap again to remove">
                Remove demo photos
              </ConfirmButton>
            </ActionForm>
          </div>
        </Card>

        <Card title="Change your password">
          <div className="space-y-3 font-sans text-sm text-ink-soft">
            <p>
              The studio password is set outside the app so it can’t be changed by accident. To change it, edit{" "}
              <code className="rounded bg-linen px-1">STUDIO_PASSWORD</code> in <code className="rounded bg-linen px-1">.env.local</code>{" "}
              (or in your host’s environment settings if the site is online), then restart the app.
            </p>
            <p>
              For better security, store a scrambled version instead: run{" "}
              <code className="rounded bg-linen px-1">npm run hash-password &quot;your new password&quot;</code>, copy the
              long result into <code className="rounded bg-linen px-1">STUDIO_PASSWORD_HASH</code>, and remove{" "}
              <code className="rounded bg-linen px-1">STUDIO_PASSWORD</code>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
