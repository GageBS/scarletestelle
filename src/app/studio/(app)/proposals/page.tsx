import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDay, formatInstant, todayIn } from "@/lib/format";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th, cx } from "@/components/studio/ui";

export const metadata: Metadata = { title: "Proposals" };

const PROPOSAL_TONE: Record<string, string> = {
  draft: "muted",
  sent: "blush",
  viewed: "rose",
  accepted: "ok",
  void: "muted",
};

const FILTERS = [
  ["all", "All"],
  ["open", "Open"],
  ["accepted", "Signed"],
  ["draft", "Drafts"],
  ["void", "Void"],
] as const;

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const filter = FILTERS.find(([k]) => k === sp.filter)?.[0] ?? "all";
  const s = await getSettings();
  const tz = s.business.timezone;
  const today = todayIn(tz);
  const rows = await db
    .select({ p: schema.proposals, project: schema.projects })
    .from(schema.proposals)
    .innerJoin(schema.projects, eq(schema.proposals.projectId, schema.projects.id))
    .orderBy(desc(schema.proposals.createdAt));
  const shown = rows.filter(({ p }) =>
    filter === "all"
      ? true
      : filter === "open"
        ? p.status === "sent" || p.status === "viewed"
        : p.status === filter,
  );

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Proposals"
        description="Your client picks a collection, signs the contract and pays the retainer — all from one link."
        actions={
          <LinkButton href="/studio/proposals/new" variant="accent">
            + New proposal
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map(([k, label]) => (
          <Link
            key={k}
            href={k === "all" ? "/studio/proposals" : `/studio/proposals?filter=${k}`}
            className={cx(
              "flex min-h-10 items-center rounded-full border px-4 font-sans text-[0.72rem] uppercase tracking-[0.14em]",
              filter === k ? "border-ink bg-ink text-cream" : "border-rule text-ink-soft hover:border-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
      {shown.length === 0 ? (
        <Card>
          <EmptyState
            title={rows.length ? "Nothing here" : "No proposals yet"}
            action={<LinkButton href="/studio/proposals/new">Create a proposal</LinkButton>}
          >
            {rows.length ? "No proposals match this filter." : "Send your first proposal from a project, or start one here."}
          </EmptyState>
        </Card>
      ) : (
        <Card pad={false}>
          <Table>
            <thead>
              <tr>
                <Th>Proposal</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th>Sent</Th>
                <Th>Expires</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ p, project }) => {
                const expired = (p.status === "sent" || p.status === "viewed") && p.expiresOn && p.expiresOn < today;
                return (
                  <tr key={p.id}>
                    <Td>
                      <Link href={`/studio/proposals/${p.id}`} className="text-ink underline-offset-4 hover:underline">
                        {p.title}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/studio/projects/${project.id}`} className="text-ink-soft hover:text-ink">
                        {project.title}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={expired ? "warn" : PROPOSAL_TONE[p.status]}>{expired ? "expired" : p.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">
                      {p.sentAt ? formatInstant(p.sentAt, tz, { month: "short", day: "numeric" }) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">{p.expiresOn ? formatDay(p.expiresOn, "medium") : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
