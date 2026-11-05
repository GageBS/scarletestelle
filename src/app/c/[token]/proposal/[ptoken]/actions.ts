"use server";
/* Client-facing action (no studio login): sign a proposal. Access = the two tokens. */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { isStudio } from "@/lib/auth";
import { acceptProposal } from "@/lib/billing";
import { clientIp, getPortalProject } from "../../portal-data";

export type AcceptState = { error?: string };

const input = z.object({
  token: z.string().min(10).max(64),
  ptoken: z.string().min(10).max(64),
  packageId: z.string().min(1, "Please choose your collection."),
  addonIds: z.array(z.string().max(64)).max(40),
  signatureName: z.string().trim().min(2, "Please type your full legal name.").max(120),
  signatureImage: z
    .string()
    .startsWith("data:image/png;base64,", "Please draw your signature in the box.")
    .max(200_000, "That signature image is too large — please clear it and sign again."),
  agree: z.literal("yes", { error: "Please tick the box to agree to sign electronically." }),
});

export async function acceptProposalAction(_prev: AcceptState, fd: FormData): Promise<AcceptState> {
  const parsed = input.safeParse({
    token: fd.get("token"),
    ptoken: fd.get("ptoken"),
    packageId: fd.get("packageId") ?? "",
    addonIds: fd.getAll("addonIds").map(String).filter(Boolean),
    signatureName: fd.get("signatureName") ?? "",
    signatureImage: fd.get("signatureImage") ?? "",
    agree: fd.get("agree") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const v = parsed.data;

  const portal = await getPortalProject(v.token);
  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.token, v.ptoken) });
  if (!portal || !proposal || proposal.projectId !== portal.project.id)
    return { error: "This link is no longer valid." };
  if (await isStudio())
    return {
      error:
        "You're signed in to the studio, so this is a preview. To test signing as a client, open the link in a private window.",
    };

  const h = await headers();
  const result = await acceptProposal({
    proposalId: proposal.id,
    packageId: v.packageId,
    addonIds: v.addonIds,
    signatureName: v.signatureName,
    signatureImage: v.signatureImage,
    ip: clientIp(h),
    userAgent: h.get("user-agent") ?? "",
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/c/${v.token}`, "layout");
  revalidatePath("/studio/proposals");
  revalidatePath("/studio/contracts");
  revalidatePath("/studio/invoices");
  redirect(
    result.firstDue
      ? `/c/${v.token}/invoice/${result.invoiceToken}?signed=1`
      : `/c/${v.token}/contract/${result.contractToken}?signed=1`,
  );
}
