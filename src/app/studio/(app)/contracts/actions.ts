"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { PROJECT_TYPES } from "@/lib/constants";

export type FormState = { error?: string; ok?: string };

const typeValues = ["any", ...PROJECT_TYPES.map((t) => t.value)] as [string, ...string[]];
const tplInput = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, "Give the template a name.").max(140),
  projectType: z.enum(typeValues),
  body: z.string().trim().min(20, "The contract body is empty.").max(100_000, "That contract is too long."),
});

export async function saveTemplate(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const parsed = tplInput.safeParse({
    id: (fd.get("id") as string) || undefined,
    name: fd.get("name") ?? "",
    projectType: fd.get("projectType") ?? "any",
    body: fd.get("body") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const v = parsed.data;
  const values = {
    name: v.name,
    projectType: v.projectType as (typeof schema.contractTemplates.$inferInsert)["projectType"],
    body: v.body.replace(/\r\n?/g, "\n"),
  };
  if (v.id) {
    const r = await db
      .update(schema.contractTemplates)
      .set(values)
      .where(eq(schema.contractTemplates.id, v.id))
      .returning({ id: schema.contractTemplates.id });
    if (!r.length) return { error: "That template no longer exists." };
    revalidatePath("/studio/contracts");
    return { ok: "Saved" };
  }
  const id = newId();
  await db.insert(schema.contractTemplates).values({ id, ...values });
  revalidatePath("/studio/contracts");
  redirect(`/studio/contracts/templates/${id}?notice=created`);
}

export async function deleteTemplate(id: string) {
  await requireStudio();
  const used = await db.query.proposals.findFirst({
    where: and(
      eq(schema.proposals.contractTemplateId, id),
      inArray(schema.proposals.status, ["draft", "sent", "viewed"]),
    ),
  });
  if (used) redirect(`/studio/contracts/templates/${id}?error=in-use`);
  await db.delete(schema.contractTemplates).where(eq(schema.contractTemplates.id, id));
  revalidatePath("/studio/contracts");
  redirect("/studio/contracts?notice=deleted");
}

export async function countersign(contractId: string) {
  await requireStudio();
  const s = await getSettings();
  const name = s.business.signatureName || s.business.photographer;
  const now = new Date();
  const r = await db
    .update(schema.contracts)
    .set({ status: "countersigned", studioSignatureName: name, studioSignedAt: now })
    .where(and(eq(schema.contracts.id, contractId), eq(schema.contracts.status, "signed")))
    .returning({ projectId: schema.contracts.projectId, title: schema.contracts.title, token: schema.contracts.token });
  if (!r.length) redirect(`/studio/contracts/${contractId}?error=not-signed`);
  await logActivity({
    projectId: r[0].projectId,
    kind: "contract",
    title: `Contract countersigned: ${r[0].title}`,
    body: `Signed by ${name}`,
    meta: { contractId },
  });
  revalidatePath("/studio/contracts");
  revalidatePath(`/studio/contracts/${contractId}`);
  redirect(`/studio/contracts/${contractId}?notice=countersigned`);
}
