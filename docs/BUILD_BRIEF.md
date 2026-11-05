# Scarlet Estelle — build brief (read fully before writing code)

A luxury photography website for **Scarlet Summers / "Scarlet Estelle"** (weddings,
engagements/couples, seniors/portraits, branding) **plus a private studio CRM with
HoneyBook-level features**. Scarlet will use the studio mostly **on her iPhone**, so
every studio screen must work great at 390px wide and on a laptop.

## Stack facts (verified)
- **Next.js 16.4.5**, App Router, React 19.3, TypeScript, Tailwind v4, `src/` dir.
  This Next version differs from older training data. Before using any Next API you are
  unsure of, read the bundled docs in `node_modules/next/dist/docs/01-app/…`.
  Key differences: `params`/`searchParams`/`cookies()`/`headers()` are **async (await them)**;
  `middleware.ts` is now `src/proxy.ts` (already written); `revalidateTag` needs a 2nd arg
  (prefer `revalidatePath`); next/image uses `preload` not `priority`; image `qualities` allowed: 70, 80, 90.
- **cacheComponents is OFF.** Pages that read the DB must `export const dynamic = "force-dynamic"`
  (the studio layout already does; client-facing `/c/...` and `/book` pages must add it).
  After a mutation call `revalidatePath(...)` for the affected pages.
- **DB:** Drizzle ORM 0.45 + libSQL/SQLite (`src/db/index.ts` exports `db`, `schema`).
  Schema: `src/db/schema.ts` — read its header comment for conventions:
  ids = `newId()`, client-link tokens = `newToken()` (`src/lib/ids.ts`), **money = integer cents**,
  **calendar days = "YYYY-MM-DD" text**, instants = Date (timestamp_ms), JSON columns typed.
  Use `db.query.<table>.findFirst/findMany` (no relations defined — do joins with
  `db.select().from().innerJoin()` or separate queries).
- zod 4 is installed for validation. No other new dependencies — **do not run npm install**.
  If you truly need a package, stop and say so in your final report.

## Shared modules you MUST use (don't re-implement)
- `src/lib/auth.ts` → `requireStudio()` at the top of **every studio page AND every studio server action**.
- `src/lib/projects.ts` → `moveStage(projectId, stage, {reason, by})` — the only way to change a stage.
- `src/lib/automations.ts` → `fireTrigger(trigger, projectId, {subjectKey, extra})` after events:
  `proposal_sent`, `proposal_accepted`, `payment_received` (subjectKey = installment id),
  `questionnaire_submitted` (subjectKey = questionnaire id). `inquiry_received` and `stage_changed`
  are already fired by lib/inquiries.ts and moveStage. `runTimedAutomations()` = daily sweep.
- `src/lib/email.ts` → `sendEmail({to, subject, body, projectId, contactId})`. Records every email in
  `messages`; when email isn't configured it saves with status "logged" (never pretend it was sent).
- `src/lib/merge.ts` → `buildMergeContext(projectId, extra)` + `renderTemplate(text, ctx)` for `{{merge_fields}}`.
- `src/lib/activity.ts` → `logActivity({projectId, contactId, kind, title, body, meta})` for the timeline.
- `src/lib/settings.ts` → `getSettings()` / `saveSettings(key, value)` / `siteUrl()`.
- `src/lib/format.ts` → `money(cents)`, `parseMoney(str)`, `formatDay`, `addDays`, `todayIn(tz)`, `formatInstant`, …
- `src/lib/constants.ts` → PROJECT_TYPES, STAGES, AUTOMATION_TRIGGERS, PaymentPlan, QField, …
- `src/lib/storage.ts` → `saveImage(file, folder)` / `deleteImage(src)` for uploads (served at `/media/...`).

## UI
- Studio UI kit: `src/components/studio/ui.tsx` (PageHeader, Card, Stat, Button, LinkButton, Field,
  Input, Textarea, Select, Checkbox, Badge, StageBadge, Table/Th/Td, Notice, EmptyState, `cx`) and
  `src/components/studio/client-ui.tsx` (SubmitButton with pending state, ConfirmButton two-tap delete,
  CopyButton). Icons: `src/components/studio/icon.tsx`. Use these for a consistent look.
- Brand: `src/components/brand.tsx` (Monogram, Wordmark). Tokens in `src/app/globals.css`
  (`bg-parchment`, `bg-cream`, `text-ink`, `text-scarlet`, `bg-noir`, `border-rule`, fonts via
  `font-sans` (Jost, UI), `font-serif` (body), utilities `display`, `label`, `script`, `gothic`, `inked`).
- Studio look: calm, editorial, lots of whitespace; Jost for UI text, `display` (Bodoni) for page
  titles. Client-facing pages (`/c/...`, `/book`) must feel **luxurious** like the public site:
  parchment background, Bodoni headings, a `script` accent line, generous spacing, the Monogram.
- Mobile first: stack columns, 44px tap targets, no horizontal page scroll (tables may scroll inside
  their own container), use `min-h-dvh`, respect `env(safe-area-inset-*)`.
- **Never** use `alert/confirm/prompt` or browser dialogs. Destructive actions → `ConfirmButton`.
- Forms: server actions with `<form action={...}>`; validate with zod; show errors inline; on success
  `revalidatePath` + `redirect` or return state via `useActionState` (client component).
- **No silent failures**: if something can't happen (email not connected, Stripe not configured,
  slot taken), say so on screen.

## Routes already taken (don't create these)
`src/app/(site)/**` (public site — being built separately), `src/app/studio/login`,
`src/app/studio/(app)/layout.tsx`, `src/app/media/**`, `src/proxy.ts`, `src/lib/*` listed above.
The placeholder `src/app/studio/(app)/page.tsx` belongs to the CORE module.

## Seeds
Each module adds ONE idempotent seed file `src/db/seed/NN-name.ts` exporting `async function seed(): Promise<string>`
(use fixed ids like `"pkg_wedding_signature"` + `.onConflictDoNothing()` so re-running is safe).
`npm run db:seed` runs them in filename order. Sample CRM rows must set `isSample: true`
and names must read clearly as samples (e.g. last name "(sample)").

## Testing rules (several agents work in this repo at the same time)
- Typecheck: `npx tsc --noEmit` (fix every error in YOUR files; report others).
- Lint your files: `npx eslint <your paths>`.
- **Do not** run `next build`, `next dev`, `npm install`, or `npm run db:push` against `data/studio.db`.
- To exercise logic against a real DB, use your OWN file:
  `DATABASE_URL=file:./data/test-<module>.db npx drizzle-kit push --force` then
  `DATABASE_URL=file:./data/test-<module>.db npx tsx --env-file=.env.local <script>` (env var wins over the file).
  Write throwaway scripts under `scripts/tmp-<module>-*.ts` and delete them when done.
- **Schema changes:** avoid. If unavoidable, only ADD a nullable/defaulted column or a new table at the
  end of `src/db/schema.ts`, and list it in your report.
- Do not edit files owned by another module. If you need a hook from another module, call the shared
  lib function or describe the need in your report.

## Final report (keep it short)
Routes built, files created, seeds added, any schema additions, anything stubbed or not done,
and the exact tsc/eslint result.
