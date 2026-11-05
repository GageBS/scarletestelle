/**
 * DEMO placeholder portfolio (Unsplash-licensed photos in public/demo) so the site
 * preview isn't empty. Every row is isDemo = true and can be removed from
 * Studio → Settings → "Remove demo photos".
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

type M = { src: string; width: number; height: number; alt: string; credit: string; unsplashId: string };

const STORIES: Record<string, { slug: string; title: string; subtitle: string; location: string; date: string; description: string }> = {
  weddings: {
    slug: "demo-golden-hour-vows",
    title: "Golden Hour Vows",
    subtitle: "A sample wedding story",
    location: "Somewhere golden",
    date: "2026-06-13",
    description: "Placeholder gallery — replace with a real wedding story from the studio.",
  },
  couples: {
    slug: "demo-hillside-engagement",
    title: "A Hillside Engagement",
    subtitle: "A sample couples story",
    location: "Mountain overlook",
    date: "2026-04-18",
    description: "Placeholder gallery — replace with a real engagement session.",
  },
  seniors: {
    slug: "demo-class-of-2027",
    title: "Class of 2027",
    subtitle: "A sample senior session",
    location: "Open fields at sunset",
    date: "2026-09-20",
    description: "Placeholder gallery — replace with a real senior session.",
  },
  branding: {
    slug: "demo-the-flower-studio",
    title: "The Flower Studio",
    subtitle: "A sample brand session",
    location: "A local florist",
    date: "2026-03-07",
    description: "Placeholder gallery — replace with a real brand session.",
  },
};

export async function seed() {
  const file = path.join(process.cwd(), "public/demo/manifest.json");
  if (!existsSync(file)) return "skipped (no public/demo/manifest.json)";
  const manifest = JSON.parse(readFileSync(file, "utf-8")) as Record<string, M[]>;
  let n = 0;
  for (const [cat, list] of Object.entries(manifest)) {
    if (cat === "about") continue;
    const category = await db.query.categories.findFirst({ where: eq(schema.categories.slug, cat) });
    if (!category) continue;
    const story = STORIES[cat];
    const galleryId = `demo_gal_${cat}`;
    if (story) {
      await db
        .insert(schema.galleries)
        .values({ id: galleryId, categoryId: category.id, ...story, published: true, sort: 0 })
        .onConflictDoNothing();
    }
    for (const [i, m] of list.entries()) {
      const id = `demo_${m.unsplashId}`;
      // first 6 photos are category highlights; the rest + a few highlights form the story
      const inStory = story && (i >= 3);
      await db
        .insert(schema.photos)
        .values({
          id,
          categoryId: category.id,
          galleryId: inStory ? galleryId : null,
          src: m.src,
          width: m.width,
          height: m.height,
          alt: m.alt || `${category.name} photograph`,
          caption: m.credit ? `Demo photo by ${m.credit} on Unsplash` : "Demo photo",
          medium: i % 3 === 1 ? "film" : "digital",
          featured: i < 2,
          sort: i,
          isDemo: true,
        })
        .onConflictDoNothing();
      n++;
    }
    const cover = `demo_${list[0]?.unsplashId}`;
    if (list[0] && !category.coverPhotoId) {
      await db.update(schema.categories).set({ coverPhotoId: cover }).where(eq(schema.categories.id, category.id));
    }
    if (story && list[3]) {
      await db
        .update(schema.galleries)
        .set({ coverPhotoId: `demo_${list[3].unsplashId}` })
        .where(eq(schema.galleries.id, galleryId));
    }
  }
  return `${n} demo photos + 4 demo stories`;
}
