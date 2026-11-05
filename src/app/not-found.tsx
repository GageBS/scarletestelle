import Link from "next/link";
import { Monogram } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="grain grid min-h-dvh place-items-center bg-parchment px-6 text-center">
      <div className="relative z-10 flex flex-col items-center">
        <Monogram size={90} className="text-ink" />
        <p className="script inked mt-8 text-[3.6rem] leading-none text-scarlet">a missed frame</p>
        <p className="mt-4 max-w-sm text-ink-soft">That page doesn&rsquo;t exist — or the link may have expired.</p>
        <Link href="/" className="label mt-8 border border-ink px-7 py-3 transition hover:bg-ink hover:text-cream">
          Back home
        </Link>
      </div>
    </main>
  );
}
