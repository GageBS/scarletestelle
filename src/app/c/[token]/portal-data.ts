/* Data helpers for the token-based client portal (/c/[token]/...). */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const TOKEN_RE = /^[0-9A-Za-z]{10,64}$/;
const looksLikeToken = (t: string) => TOKEN_RE.test(t);

/** Project + contact for a portal token (null when the token is unknown). Deduped per request. */
export const getPortalProject = cache(async (token: string) => {
  if (!looksLikeToken(token)) return null;
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.portalToken, token),
  });
  if (!project) return null;
  const contact = await db.query.contacts.findFirst({
    where: eq(schema.contacts.id, project.contactId),
  });
  return { project, contact: contact ?? null };
});

/** Best-effort client IP from proxy headers. */
export function clientIp(h: Headers) {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "";
}
