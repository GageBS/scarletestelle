import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkPassword, isStudio, startSession } from "@/lib/auth";
import { Monogram } from "@/components/brand";
import { SubmitButton } from "@/components/studio/client-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio sign in", robots: { index: false } };

async function login(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") ?? "");
  // small fixed delay blunts password guessing
  await new Promise((r) => setTimeout(r, 400));
  if (await checkPassword(pw)) {
    await startSession();
    redirect("/studio");
  }
  redirect("/studio/login?error=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isStudio()) redirect("/studio");
  const { error } = await searchParams;
  return (
    <main className="grain grid min-h-dvh place-items-center bg-noir px-6 text-cream">
      <form action={login} className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <Monogram size={96} className="text-cream" />
        <p className="display mt-6 text-sm uppercase tracking-[0.3em]">Scarlet Estelle</p>
        <p className="script inked -mt-1 text-4xl text-blush">the studio</p>
        <label className="mt-10 w-full text-left">
          <span className="label text-cream/60">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className="mt-1 w-full border-0 border-b border-cream/30 bg-transparent py-2 font-sans text-lg text-cream outline-none focus:border-blush"
          />
        </label>
        {error && <p className="mt-3 font-sans text-sm text-blush">That password didn’t match.</p>}
        <SubmitButton variant="accent" pendingText="Opening…" className="mt-8 w-full">
          Enter the studio
        </SubmitButton>
      </form>
    </main>
  );
}
