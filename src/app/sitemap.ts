import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const fixed = ["", "/portfolio", "/approach", "/experience", "/kind-words", "/about", "/inquire", "/book"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  const cats = await db.select().from(schema.categories).where(eq(schema.categories.visible, true));
  const gals = await db
    .select({ slug: schema.galleries.slug, cat: schema.categories.slug })
    .from(schema.galleries)
    .innerJoin(schema.categories, eq(schema.galleries.categoryId, schema.categories.id))
    .where(eq(schema.galleries.published, true));
  return [
    ...fixed,
    ...cats.map((c) => ({ url: `${base}/portfolio/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...gals.map((g) => ({ url: `${base}/portfolio/${g.cat}/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
