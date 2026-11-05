/* Server-side loaders for the proposal builder (packages + templates for a project). */
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { PROJECT_TYPES, projectTypeLabel, type ProjectType } from "@/lib/constants";
import type { PkgOption, TemplateOption } from "./proposal-form";

const categoryOf = (t: string) => PROJECT_TYPES.find((p) => p.value === t)?.category ?? null;

/** Same session type, or the same family (wedding ≈ elopement, engagement ≈ couples, senior ≈ portrait). */
export function sameKind(a: ProjectType | string, b: ProjectType | string) {
  if (a === b) return true;
  const ca = categoryOf(a);
  return ca !== null && ca === categoryOf(b);
}

export async function builderOptions(projectType: ProjectType) {
  const [pkgs, tpls] = await Promise.all([
    db.query.packages.findMany({
      orderBy: [asc(schema.packages.isAddon), asc(schema.packages.sort), asc(schema.packages.name)],
    }),
    db.query.contractTemplates.findMany({ orderBy: asc(schema.contractTemplates.name) }),
  ]);
  const other = projectType === "other";
  const packages: PkgOption[] = pkgs.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    isAddon: p.isAddon,
    active: p.active,
    match: other || sameKind(p.projectType, projectType),
    typeLabel: projectTypeLabel(p.projectType),
  }));
  // exact type first, then the rest of the family
  packages.sort((a, b) => Number(b.match) - Number(a.match));
  const templates: TemplateOption[] = tpls.map((t) => ({
    id: t.id,
    name: t.name,
    match: other || t.projectType === "any" || sameKind(t.projectType, projectType),
    attorneyNote: t.body.includes("Have a licensed attorney"),
  }));
  const defaultTemplate =
    tpls.find((t) => t.projectType === projectType) ??
    tpls.find((t) => t.projectType !== "any" && sameKind(t.projectType, projectType)) ??
    tpls.find((t) => t.projectType === "any");
  return { packages, templates, defaultTemplateId: defaultTemplate?.id ?? "" };
}
