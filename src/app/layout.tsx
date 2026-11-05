import type { Metadata, Viewport } from "next";
import {
  Bodoni_Moda,
  EB_Garamond,
  New_Rocker,
  Luxurious_Script,
  Jost,
} from "next/font/google";
import { brand } from "@/content/site";
import { InkFilterDefs } from "@/components/brand";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  style: ["normal", "italic"],
  display: "swap",
});
const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
  style: ["normal", "italic"],
  display: "swap",
});
// SE monogram blackletter — New Rocker reads clearly as "SE" even at 40px
// (UnifrakturMaguntia's S reads like a G at small sizes)
const fraktur = New_Rocker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fraktur",
  display: "swap",
});
// Stand-in for Rinapelle Script (Get Studio) — the closest free match.
// When the licensed Rinapelle webfont file arrives, swap this for next/font/local
// with variable "--font-scriptface" and nothing else changes.
const scriptFace = Luxurious_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-scriptface",
  display: "swap",
});
const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  openGraph: {
    title: brand.name,
    description: brand.description,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3ece1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${garamond.variable} ${fraktur.variable} ${scriptFace.variable} ${jost.variable}`}
    >
      <body>
        <InkFilterDefs />
        {children}
      </body>
    </html>
  );
}
