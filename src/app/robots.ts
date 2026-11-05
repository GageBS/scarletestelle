import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/studio", "/c/", "/book/manage", "/api/", "/media/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
