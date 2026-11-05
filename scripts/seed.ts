// npm run db:seed — fills a fresh database with Scarlet's starter content.
// `npm run db:seed -- 00 05` runs only the seed files with those prefixes.
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const dir = path.join(process.cwd(), "src/db/seed");
  const only = process.argv.slice(2);
  const mods = readdirSync(dir)
    .filter((f) => /^\d\d-.*\.ts$/.test(f))
    .filter((f) => only.length === 0 || only.some((p) => f.startsWith(p)))
    .sort();
  for (const f of mods) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    const summary = await mod.seed();
    console.log(`✓ ${f}: ${summary}`);
  }
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
