import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInstant } from "@/lib/format";
import { projectTypeLabel } from "@/lib/constants";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  Notice,
  PageHeader,
  Table,
  Td,
  Th,
  cx,
} from "@/components/studio/ui";

export const metadata: Metadata = { title: "Contracts" };

const STATUS_TONE: Record<string, string> = {
  draft: "muted",
  sent: "blush",
  signed: "warn",
  countersigned: "ok",
  void: "muted",
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const tab = sp.tab === "signed" ? "signed" : "templates";
  const s = await getSettings();

  const tabs = (
    <div className="mb-5 flex gap-1 border-b border-rule">
      {(
        [
          ["templates", "Templates"],
          ["signed", "Sent & signed"],
        ] as const
      ).map(([k, label]) => (
        <Link
          key={k}
          href={`/studio/contracts${k === "signed" ? "?tab=signed" : ""}`}
          className={cx(
            "-mb-px flex min-h-11 items-center border-b-2 px-4 font-sans text-[0.75rem] uppercase tracking-[0.16em]",
            tab === k ? "border-scarlet text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Contracts"
        description="Templates are filled in with each client's details and frozen the moment they sign."
        actions={
          <LinkButton href="/studio/contracts/templates/new" variant="accent">
            + New template
          </LinkButton>
        }
      />
      {sp.notice === "deleted" && (
        <div className="mb-5">
          <Notice tone="ok">Template deleted.</Notice>
        </div>
      )}
      {tabs}
      {tab === "templates" ? <Templates /> : <Signed tz={s.business.timezone} />}
    </>
  );
}

async function Templates() {
  const rows = await db.query.contractTemplates.findMany({
    orderBy: desc(schema.contractTemplates.updatedAt),
  });
  if (!rows.length)
    return (
      <Card>
        <EmptyState
          title="No templates yet"
          action={<LinkButton href="/studio/contracts/templates/new">Write your first</LinkButton>}
        >
          Write a contract once and reuse it on every proposal.
        </EmptyState>
      </Card>
    );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((t) => (
        <Link
          key={t.id}
          href={`/studio/contracts/templates/${t.id}`}
          className="block rounded-sm border border-rule bg-cream p-4 transition hover:border-rose"
        >
          <p className="display text-xl">{t.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-sans text-xs text-ink-soft">
            <Badge>{t.projectType === "any" ? "Any session" : projectTypeLabel(t.projectType)}</Badge>
            <span>{t.body.length.toLocaleString()} characters</span>
            {t.body.includes("Have a licensed attorney") && <Badge tone="warn">Attorney review note</Badge>}
          </div>
        </Link>
      ))}
    </div>
  );
}

async function Signed({ tz }: { tz: string }) {
  const rows = await db
    .select({ c: schema.contracts, p: schema.projects })
    .from(schema.contracts)
    .innerJoin(schema.projects, eq(schema.contracts.projectId, schema.projects.id))
    .orderBy(desc(schema.contracts.createdAt));
  if (!rows.length)
    return (
      <Card>
        <EmptyState title="None signed yet">Contracts appear here once a client signs a proposal.</EmptyState>
      </Card>
    );
  return (
    <Card pad={false}>
      <Table>
        <thead>
          <tr>
            <Th>Contract</Th>
            <Th>Project</Th>
            <Th>Status</Th>
            <Th>Client signed</Th>
            <Th>Countersigned</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, p }) => (
            <tr key={c.id}>
              <Td>
                <Link href={`/studio/contracts/${c.id}`} className="text-ink underline-offset-4 hover:underline">
                  {c.title}
                </Link>
              </Td>
              <Td>
                <Link href={`/studio/projects/${p.id}`} className="text-ink-soft hover:text-ink">
                  {p.title}
                </Link>
              </Td>
              <Td>
                <Badge tone={STATUS_TONE[c.status]}>
                  {c.status === "signed" ? "Needs countersign" : c.status}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatInstant(c.clientSignedAt, tz)}</Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatInstant(c.studioSignedAt, tz)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
