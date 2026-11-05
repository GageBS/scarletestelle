"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { parseMoney } from "@/lib/format";
import { PROJECT_TYPES, type ProjectType } from "@/lib/constants";

export type FormState = { error?: string; ok?: string };

const typeValues = PROJECT_TYPES.map((t) => t.value) as [ProjectType, ...ProjectType[]];
const pkgInput = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, "Give it a name.").max(120, "That name is a little long."),
  projectType: z.enum(typeValues, { error: "Choose a session type." }),
  price: z.string().trim().min(1, "Enter a price."),
  description: z.string().trim().max(2000),
  inclusions: z.string().max(6000),
  isAddon: z.boolean(),
  active: z.boolean(),
  showOnSite: z.boolean(),
});

async function groupOf(projectType: ProjectType, isAddon: boolean) {
  return db.query.packages.findMany({
    where: and(eq(schema.packages.projectType, projectType), eq(schema.packages.isAddon, isAddon)),
    orderBy: [asc(schema.packages.sort), asc(schema.packages.name)],
  });
}

export async function savePackage(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const parsed = pkgInput.safeParse({
    id: (fd.get("id") as string) || undefined,
    name: fd.get("name") ?? "",
    projectType: fd.get("projectType") ?? "",
    price: fd.get("price") ?? "",
    description: fd.get("description") ?? "",
    inclusions: fd.get("inclusions") ?? "",
    isAddon: fd.get("isAddon") === "on",
    active: fd.get("active") === "on",
    showOnSite: fd.get("showOnSite") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const v = parsed.data;
  const priceCents = parseMoney(v.price);
  if (priceCents == null || priceCents < 0) return { error: "Enter a price like 3,200 or 450.00." };
  const inclusions = v.inclusions
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 40);
  const values = {
    name: v.name,
    projectType: v.projectType,
    priceCents,
    description: v.description,
    inclusions,
    isAddon: v.isAddon,
    active: v.active,
    showOnSite: v.showOnSite,
  };

  if (v.id) {
    const existing = await db.query.packages.findFirst({ where: eq(schema.packages.id, v.id) });
    if (!existing) return { error: "That package no longer exists." };
    const movedGroup = existing.projectType !== v.projectType || existing.isAddon !== v.isAddon;
    const sort = movedGroup ? (await groupOf(v.projectType, v.isAddon)).length : existing.sort;
    await db.update(schema.packages).set({ ...values, sort }).where(eq(schema.packages.id, v.id));
  } else {
    const sort = (await groupOf(v.projectType, v.isAddon)).length;
    await db.insert(schema.packages).values({ id: newId(), ...values, sort });
  }
  revalidatePath("/studio/packages");
  return { ok: v.id ? "Saved" : `Added “${v.name}”` };
}

export async function movePackage(id: string, dir: "up" | "down") {
  await requireStudio();
  const pkg = await db.query.packages.findFirst({ where: eq(schema.packages.id, id) });
  if (!pkg) redirect("/studio/packages");
  const group = await groupOf(pkg.projectType, pkg.isAddon);
  const i = group.findIndex((g) => g.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i >= 0 && j >= 0 && j < group.length) {
    [group[i], group[j]] = [group[j], group[i]];
    for (const [n, g] of group.entries()) {
      if (g.sort !== n) await db.update(schema.packages).set({ sort: n }).where(eq(schema.packages.id, g.id));
    }
  }
  revalidatePath("/studio/packages");
}

export async function deletePackage(id: string) {
  await requireStudio();
  const open = await db.query.proposals.findMany({
    where: inArray(schema.proposals.status, ["draft", "sent", "viewed"]),
    columns: { packageIds: true, addonIds: true },
  });
  if (open.some((p) => p.packageIds.includes(id) || p.addonIds.includes(id)))
    redirect("/studio/packages?error=in-use");
  await db.delete(schema.packages).where(eq(schema.packages.id, id));
  revalidatePath("/studio/packages");
  redirect("/studio/packages?notice=deleted");
}
