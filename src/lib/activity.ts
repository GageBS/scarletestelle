import { db, schema } from "@/db";
import type { ActivityKind } from "@/lib/constants";
import { newId } from "@/lib/ids";

/** Append an entry to a project's / contact's timeline. */
export async function logActivity(a: {
  projectId?: string | null;
  contactId?: string | null;
  kind: ActivityKind;
  title: string;
  body?: string;
  meta?: Record<string, unknown>;
}) {
  await db.insert(schema.activities).values({
    id: newId(),
    projectId: a.projectId ?? null,
    contactId: a.contactId ?? null,
    kind: a.kind,
    title: a.title,
    body: a.body ?? "",
    meta: a.meta ?? {},
  });
}
