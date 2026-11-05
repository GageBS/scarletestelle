"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { parseMoney } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { FormState } from "../_components/action-form";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bump = () => {
  revalidatePath("/studio/expenses");
  revalidatePath("/studio/reports");
};

async function parse(fd: FormData) {
  const amount = parseMoney(str(fd, "amount"));
  if (amount == null || amount <= 0) return { error: "Enter the amount, like 24.50." } as const;
  if (amount > 100_000_000) return { error: "That amount looks too large." } as const;
  const p = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date of the expense."),
      category: z.string().refine((c) => (EXPENSE_CATEGORIES as readonly string[]).includes(c), "Pick a category."),
      vendor: z.string().max(120),
      notes: z.string().max(1000),
    })
    .safeParse({
      date: str(fd, "date"),
      category: str(fd, "category"),
      vendor: str(fd, "vendor"),
      notes: str(fd, "notes"),
    });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Please check the form." } as const;
  const projectId = str(fd, "projectId") || null;
  if (projectId) {
    const pr = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
    if (!pr) return { error: "That project no longer exists." } as const;
  }
  return { data: { ...p.data, amountCents: amount, projectId } } as const;
}

export async function createExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const r = await parse(fd);
  if ("error" in r) return { ok: false, error: r.error };
  await db.insert(schema.expenses).values({ id: newId(), ...r.data });
  bump();
  return { ok: true, message: "Expense added." };
}

export async function updateExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const id = str(fd, "id");
  const row = await db.query.expenses.findFirst({ where: eq(schema.expenses.id, id) });
  if (!row) return { ok: false, error: "That expense no longer exists." };
  const r = await parse(fd);
  if ("error" in r) return { ok: false, error: r.error };
  await db.update(schema.expenses).set(r.data).where(eq(schema.expenses.id, id));
  bump();
  return { ok: true, message: "Saved." };
}

export async function deleteExpense(fd: FormData) {
  await requireStudio();
  await db.delete(schema.expenses).where(eq(schema.expenses.id, str(fd, "id")));
  bump();
}
