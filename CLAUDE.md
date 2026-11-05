@AGENTS.md

Read `README.md` and `docs/BUILD_BRIEF.md` before changing code. The brief's "Testing rules" section
was written for the original multi-agent build. When one person works alone, `npm install`,
`npm run dev` and `npm run db:push` are fine to run.

## Design decisions so far (keep unless Scarlet says otherwise)
- Portfolio: sticky category tabs + lightbox. Inspirations were Elise Nyffeler's *approach page
  layout* (not her fonts or colors) and Janie Tyler's *vibe*, made easier to browse.
- Script font: **Luxurious Script** (Google) stands in for **Rinapelle Script** (Get Studio) until
  a web license is bought. Never trace or copy the font from images. Swap steps are in the README.
- SE monogram blackletter = **New Rocker** (UnifrakturMaguntia's "S" reads as a "G" at header size).
- The palette (parchment / oxblood / blush / moss tokens in `src/app/globals.css`) is a
  **placeholder**. Scarlet's palette and vibe images never arrived.

## Before launch
Remove the `public/demo` Unsplash photos, the sample clients and the demo reviews (Studio → Settings).
Finish the DRAFT copy in `src/content/site.ts`, and have an attorney review the contracts. Email
(Resend), Stripe and hosting all need Scarlet's own accounts.
