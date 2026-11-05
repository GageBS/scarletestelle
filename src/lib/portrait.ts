import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { brand } from "@/content/site";
import type { PhotoLike } from "@/components/site/photo";

/** Scarlet's portrait: drop a photo at /public/about/portrait.jpg; until then the demo stand-in. */
export function aboutPortrait(): PhotoLike | null {
  const real = path.join(process.cwd(), "public/about/portrait.jpg");
  if (existsSync(real)) {
    return { src: "/about/portrait.jpg", width: 1600, height: 2000, alt: `${brand.photographer}, photographer` };
  }
  const manifest = path.join(process.cwd(), "public/demo/manifest.json");
  if (!existsSync(manifest)) return null;
  const m = JSON.parse(readFileSync(manifest, "utf-8")) as { about?: PhotoLike[] };
  const p = m.about?.[0];
  return p ? { src: p.src, width: p.width, height: p.height, alt: "Demo stand-in for Scarlet's portrait" } : null;
}
