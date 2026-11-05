import { db, schema } from "@/db";

/* Sample reviews so the website never looks empty before real ones arrive.
   Marked isDemo and named "Sample — …" so nobody mistakes them for real clients.
   Remove them any time: Studio → Settings → Sample & demo content. */
const REVIEWS = [
  {
    id: "testi_demo_wedding",
    name: "Sample — Wedding client",
    sessionType: "Wedding",
    pullQuote: "I forgot the camera was even there.",
    quote:
      "From our very first call I felt at ease. Scarlet has a gentle way of directing, never stiff and never pushy, so on the day we were simply present with each other. Our film images look like how the day felt, and the gallery arrived sooner than we dared hope. We keep going back to it.",
    rating: 5,
    featured: true,
    sort: 1,
  },
  {
    id: "testi_demo_couple",
    name: "Sample — Engagement clients",
    sessionType: "Engagement",
    pullQuote: "It felt like a quiet afternoon, not a photoshoot.",
    quote:
      "We were nervous because neither of us likes being photographed. Within ten minutes we were laughing and had forgotten to be self-conscious. The pictures are warm and honest, and the film frames are our absolute favorites.",
    rating: 5,
    featured: true,
    sort: 2,
  },
  {
    id: "testi_demo_senior",
    name: "Sample — Senior parent",
    sessionType: "Senior session",
    pullQuote: "She finally saw herself the way we do.",
    quote:
      "My daughter is shy and dreaded having her senior pictures taken. Scarlet gave simple, gentle direction and made it feel like a fun afternoon with a friend. When the gallery arrived we both teared up. Thank you for making her feel so beautiful.",
    rating: 5,
    featured: false,
    sort: 3,
  },
  {
    id: "testi_demo_branding",
    name: "Sample — Branding client",
    sessionType: "Branding session",
    pullQuote: "Finally, images that look and feel like me.",
    quote:
      "I came in with a vague idea and left with a library of images I use everywhere. Scarlet listened first, then guided me so naturally that I never felt posed. The mix of film and digital gave my brand a depth I could not have planned.",
    rating: 5,
    featured: false,
    sort: 4,
  },
];

export async function seed(): Promise<string> {
  for (const r of REVIEWS) {
    await db
      .insert(schema.testimonials)
      .values({ ...r, published: true, source: "manual", isDemo: true })
      .onConflictDoNothing();
  }
  return `${REVIEWS.length} sample reviews`;
}
