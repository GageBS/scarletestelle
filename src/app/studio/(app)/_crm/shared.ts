import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  PROJECT_TYPES,
  STAGES,
  type ProjectType,
  type Stage,
} from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/format";

/** Result shape returned by form actions used with useActionState. */
export type FormState = { ok?: string; error?: string } | null;

export const typeValues = PROJECT_TYPES.map((t) => t.value) as [ProjectType, ...ProjectType[]];
export const stageValues = STAGES.map((s) => s.value) as [Stage, ...Stage[]];

export const dayStr = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Please use a valid date")
  .or(z.literal(""));
export const timeStr = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Please use a valid time")
  .or(z.literal(""));

export function formObject(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

export function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Something in the form isn't right";
}

/** Every studio page may show this data, so refresh the whole studio tree. */
export function refresh() {
  revalidatePath("/studio", "layout");
}

export async function studioTimezone() {
  return (await getSettings()).business.timezone;
}
export async function studioToday() {
  return todayIn(await studioTimezone());
}

export function optInt(s: string | undefined) {
  if (!s || !s.trim()) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function optNum(s: string | undefined) {
  if (!s || !s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
