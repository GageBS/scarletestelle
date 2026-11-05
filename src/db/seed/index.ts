/**
 * Seed registry. Each module exports `seed(db)` and must be IDEMPOTENT
 * (skip rows that already exist) so `npm run db:seed` is safe to re-run.
 * Order matters: core → portfolio → money → comms.
 */
export type SeedFn = () => Promise<string>; // returns a one-line summary
