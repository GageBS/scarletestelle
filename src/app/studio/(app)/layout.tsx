import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudio, endSession } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { StudioShell } from "@/components/studio/shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio" },
  robots: { index: false, follow: false },
};

async function logout() {
  "use server";
  await endSession();
  redirect("/studio/login");
}

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await requireStudio();
  return (
    <StudioShell emailConnected={emailConfigured()} logout={logout}>
      {children}
    </StudioShell>
  );
}
