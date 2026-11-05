"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { dayStr, firstError, formObject, refresh, type FormState } from "../_crm/shared";

const addSchema = z.object({
  title: z.string().trim().min(1, "Give the to-do a title").max(200, "Keep the title under 200 characters"),
  dueDate: dayStr,
  projectId: z.string().trim().max(40),
});

export async function addTask(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStudio();
  const parsed = addSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { title, dueDate, projectId } = parsed.data;
  if (projectId) {
    const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
    if (!p) return { error: "That project no longer exists." };
  }
  await db.insert(schema.tasks).values({
    id: newId(),
    title,
    dueDate: dueDate || null,
    projectId: projectId || null,
  });
  refresh();
  return { ok: "To-do added." };
}

export async function toggleTask(fd: FormData): Promise<void> {
  await requireStudio();
  const id = String(fd.get("id") ?? "");
  const t = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, id) });
  if (!t) {
    refresh(); // already deleted somewhere else; the list will catch up
    return;
  }
  const done = !t.done;
  await db
    .update(schema.tasks)
    .set({ done, doneAt: done ? new Date() : null })
    .where(eq(schema.tasks.id, id));
  if (done && t.projectId) {
    await logActivity({ projectId: t.projectId, kind: "task", title: `Done: ${t.title}` });
  }
  refresh();
}

export async function deleteTask(fd: FormData): Promise<void> {
  await requireStudio();
  const id = String(fd.get("id") ?? "");
  await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  refresh();
}
