import Link from "next/link";
import { desc, inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { coupleName, fullName } from "@/lib/format";
import { projectTypeLabel } from "@/lib/constants";
import { Button, Card, EmptyState, Input, LinkButton, PageHeader, StageBadge } from "@/components/studio/ui";
import { RowList, SampleBadge } from "../_crm/parts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStudio();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const C = schema.contacts;
  const pat = `%${q.replace(/[%_]/g, "")}%`;
  const contacts = await db
    .select()
    .from(C)
    .where(
      q
        ? or(
            like(C.firstName, pat),
            like(C.lastName, pat),
            like(C.partnerFirstName, pat),
            like(C.partnerLastName, pat),
            like(C.email, pat),
            like(C.phone, pat),
            like(C.instagram, pat),
          )
        : undefined,
    )
    .orderBy(desc(C.createdAt))
    .limit(300);

  const projects = contacts.length
    ? await db
        .select()
        .from(schema.projects)
        .where(
          inArray(
            schema.projects.contactId,
            contacts.map((c) => c.id),
          ),
        )
        .orderBy(desc(schema.projects.createdAt))
    : [];
  const latest = new Map<string, (typeof projects)[number]>();
  const counts = new Map<string, number>();
  for (const p of projects) {
    if (!latest.has(p.contactId)) latest.set(p.contactId, p);
    counts.set(p.contactId, (counts.get(p.contactId) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        eyebrow="Everyone you’ve worked with"
        title="Clients"
        actions={
          <LinkButton href="/studio/projects/new" variant="accent">
            + New lead
          </LinkButton>
        }
      />
      <form method="get" className="mb-5 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Search name, email, phone, Instagram" aria-label="Search clients" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card pad={false}>
        {contacts.length === 0 ? (
          <EmptyState
            title={q ? "No matches" : "No clients yet"}
            action={
              <LinkButton href="/studio/projects/new" variant="secondary">
                Add your first lead
              </LinkButton>
            }
          >
            {q ? "Try a different spelling." : "New inquiries from your website land here automatically."}
          </EmptyState>
        ) : (
          <RowList>
            {contacts.map((c) => {
              const p = latest.get(c.id);
              const n = counts.get(c.id) ?? 0;
              return (
                <Link
                  key={c.id}
                  href={`/studio/clients/${c.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 transition hover:bg-linen/60 md:px-5"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-sans text-[0.95rem] text-ink">
                        {c.partnerFirstName ? `${coupleName(c)} ${c.lastName}`.trim() : fullName(c)}
                      </span>
                      {c.isSample && <SampleBadge />}
                    </span>
                    <span className="mt-0.5 block truncate font-sans text-xs text-ink-soft">
                      {p ? `${projectTypeLabel(p.type)}${n > 1 ? ` · ${n} projects` : ""}` : "No projects yet"}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </span>
                  {p && <StageBadge stage={p.stage} />}
                </Link>
              );
            })}
          </RowList>
        )}
      </Card>
    </>
  );
}
