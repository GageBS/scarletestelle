import { db, schema } from "@/db";
import { DEFAULT_SETTINGS } from "@/lib/settings";

const CATEGORIES = [
  {
    id: "cat_weddings",
    slug: "weddings",
    name: "Weddings",
    tagline: "& elopements",
    description: "Wedding days and elopements, documented on film and digital.",
    sort: 1,
  },
  {
    id: "cat_couples",
    slug: "couples",
    name: "Couples",
    tagline: "& engagements",
    description: "Engagements, anniversaries and love stories in between.",
    sort: 2,
  },
  {
    id: "cat_seniors",
    slug: "seniors",
    name: "Seniors",
    tagline: "& portraits",
    description: "Senior sessions and portraits that feel like you.",
    sort: 3,
  },
  {
    id: "cat_branding",
    slug: "branding",
    name: "Branding",
    tagline: "for creatives & small businesses",
    description: "Editorial brand imagery for the people behind the business.",
    sort: 4,
  },
];

export async function seed() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(schema.settings).values({ key, value }).onConflictDoNothing();
  }
  for (const c of CATEGORIES) {
    await db.insert(schema.categories).values(c).onConflictDoNothing();
  }
  return `settings + ${CATEGORIES.length} portfolio categories`;
}
