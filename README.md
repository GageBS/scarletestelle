# Scarlet Estelle — website + studio

A luxury photography website for **Scarlet Summers / Scarlet Estelle** (weddings, couples &
engagements, seniors & portraits, branding) with a private **studio CRM** built in: inquiries,
pipeline, proposals with e-signed contracts and invoices, payments, scheduler, questionnaires,
email templates, automations, to-dos, reports and a client portal.

## Set it up on a new laptop (first time only)

1. Install **Node.js 20 or newer** (nodejs.org, "LTS") and **Git** (git-scm.com).
2. Get the code and make your settings file:

   ```bash
   git clone https://github.com/GageBS/scarletestelle.git
   cd scarletestelle
   cp .env.example .env.local     # Windows PowerShell: copy .env.example .env.local
   ```

3. Open `.env.local` and change `STUDIO_PASSWORD`, `SESSION_SECRET` and `CRON_SECRET` from
   `change-me` to your own values.
4. Run the four commands below. The database (`data/`) and uploaded photos (`storage/`) are
   **not** in GitHub. Each computer has its own, so a new laptop starts from the seed content.

Saving and sharing changes: `git pull` before you start, then
`git add -A && git commit -m "what changed" && git push` when you're done.

## Run it on this computer

```bash
npm install          # first time only
npm run db:push      # create / update the database tables (data/studio.db)
npm run db:seed      # starter content: categories, packages, contracts, emails, automations, demo photos
npm run dev          # http://localhost:3000   (studio: http://localhost:3000/studio)
```

The studio password is `STUDIO_PASSWORD` in `.env.local`.

To view it on an iPhone on the same Wi-Fi: run `npm run dev -- -H 0.0.0.0`, then open
`http://<this computer's IP>:3000` in Safari.

## Where things live

| You want to change… | Go to |
| --- | --- |
| Any website wording | `src/content/site.ts` (lines marked DRAFT are placeholders) |
| Colors / fonts | `src/app/globals.css` (`@theme` tokens) and `src/app/layout.tsx` (font files) |
| Portfolio photos, galleries, film/digital tags | Studio → Portfolio |
| Reviews | Studio → Reviews (clients can also submit from their portal link) |
| Prices / collections shown on Experience | Studio → Packages & pricing |
| Scarlet's portrait (About + home) | save it as `public/about/portrait.jpg` |
| Business info, Venmo/Zelle, time zone | Studio → Settings |

### Demo content (remove before launch)
`public/demo/` holds **placeholder photos from Unsplash** and the seed adds **sample clients** and
**sample reviews** (all clearly labeled). Remove them in Studio → Settings → *Sample & demo content*,
then delete the `public/demo` folder.

### The script font
The calligraphy is the free **Luxurious Script** as a stand-in for **Rinapelle Script** (Get Studio).
Once a web license is bought, put the `.woff2` in `src/fonts/` and swap the `Luxurious_Script(...)`
block in `src/app/layout.tsx` for `next/font/local` with `variable: "--font-scriptface"`.

## Going live (needs Scarlet's accounts — nothing here is connected yet)

1. **Hosting + database** — e.g. Vercel (site) + Turso (database: set `DATABASE_URL` +
   `DATABASE_AUTH_TOKEN`) + an S3/R2 bucket for uploads (`src/lib/storage.ts` is the one file to swap),
   **or** a small VPS where the local SQLite file and `storage/` folder just work.
2. **Email** — a Resend account + verified domain: `RESEND_API_KEY`, `EMAIL_FROM`.
   Until then emails are saved in Studio → Emails, marked "not delivered".
3. **Card payments** — Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, webhook URL
   `https://<domain>/api/stripe/webhook` (event `checkout.session.completed`).
   Until then clients see Venmo / Zelle / check instructions.
4. **Daily automations** — call `GET /api/cron/automations` once a day with
   `Authorization: Bearer $CRON_SECRET` (`vercel.json` does this on Vercel), or run
   `npm run automations:run` from a scheduler.
5. Set `SITE_URL` to the real domain, and a strong `STUDIO_PASSWORD` (or
   `STUDIO_PASSWORD_HASH` from `npm run hash-password <password>`) and `SESSION_SECRET`.
6. **Contracts** — the templates are plain-English starting points; have a licensed attorney in
   Scarlet's state review them before sending to clients.

## For developers
Next.js 16 (App Router, React 19, Tailwind v4) · Drizzle ORM + libSQL/SQLite · zod.
Read `docs/BUILD_BRIEF.md` for the conventions (money in cents, calendar days as `YYYY-MM-DD`,
`requireStudio()` on every studio page and action, `moveStage()` / `fireTrigger()` / `sendEmail()`).
