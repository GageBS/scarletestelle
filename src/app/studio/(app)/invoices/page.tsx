import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDay, money, todayIn } from "@/lib/format";
import { invoiceProgress } from "@/lib/billing-math";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat, Table, Td, Th, cx } from "@/components/studio/ui";

export const metadata: Metadata = { title: "Invoices" };

const FILTERS = [
  ["all", "All"],
  ["unpaid", "Unpaid"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["draft", "Drafts"],
] as const;

export default async function InvoicesPage({
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
  const year = today.slice(0, 4);

  const [rows, inst] = await Promise.all([
    db
      .select({ inv: schema.invoices, project: schema.projects })
      .from(schema.invoices)
      .innerJoin(schema.projects, eq(schema.invoices.projectId, schema.projects.id))
      .orderBy(desc(schema.invoices.createdAt)),
    db.query.installments.findMany(),
  ]);
  const byInv = new Map<string, typeof inst>();
  for (const i of inst) byInv.set(i.invoiceId, [...(byInv.get(i.invoiceId) ?? []), i]);

  const list = rows.map((r) => ({ ...r, prog: invoiceProgress(r.inv, byInv.get(r.inv.id) ?? [], today) }));
  const open = list.filter((r) => r.inv.status === "sent" || r.inv.status === "partial");
  const outstanding = open.reduce((a, r) => a + r.prog.remainingCents, 0);
  const overdue = open.reduce((a, r) => a + r.prog.overdueCents, 0);
  const collected = inst
    .filter((i) => i.status === "paid" && i.paidAt && todayIn(tz, i.paidAt).startsWith(year))
    .reduce((a, i) => a + i.amountCents, 0);

  const shown = list.filter((r) =>
    filter === "all"
      ? true
      : filter === "unpaid"
        ? r.inv.status === "sent" || r.inv.status === "partial"
        : filter === "overdue"
          ? r.prog.overdue
          : r.inv.status === filter,
  );

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Invoices"
        actions={
          <LinkButton href="/studio/invoices/new" variant="accent">
            + New invoice
          </LinkButton>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Outstanding" value={money(outstanding)} hint={`${open.length} open invoice${open.length === 1 ? "" : "s"}`} href="/studio/invoices?filter=unpaid" />
        <Stat label="Overdue" value={money(overdue)} href="/studio/invoices?filter=overdue" />
        <Stat label={`Collected in ${year}`} value={money(collected)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map(([k, label]) => (
          <Link
            key={k}
            href={k === "all" ? "/studio/invoices" : `/studio/invoices?filter=${k}`}
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
          <EmptyState title={rows.length ? "All clear" : "No invoices yet"}>
            {rows.length
              ? "Nothing matches this filter."
              : "Invoices are created automatically when a client signs a proposal — or make one by hand."}
          </EmptyState>
        </Card>
      ) : (
        <Card pad={false}>
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Project</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th>Status</Th>
                <Th>Next due</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ inv, project, prog }) => (
                <tr key={inv.id}>
                  <Td>
                    <Link href={`/studio/invoices/${inv.id}`} className="text-ink underline-offset-4 hover:underline">
                      {inv.number}
                    </Link>
                    <p className="text-xs text-muted">{inv.title}</p>
                  </Td>
                  <Td>
                    <Link href={`/studio/projects/${project.id}`} className="text-ink-soft hover:text-ink">
                      {project.title}
                    </Link>
                  </Td>
                  <Td className="text-right tabular-nums">{money(inv.totalCents)}</Td>
                  <Td className="text-right tabular-nums text-ink-soft">{money(prog.paidCents)}</Td>
                  <Td>
                    <Badge
                      tone={
                        inv.status === "paid"
                          ? "ok"
                          : prog.overdue
                            ? "bad"
                            : inv.status === "partial"
                              ? "warn"
                              : inv.status === "sent"
                                ? "blush"
                                : "muted"
                      }
                    >
                      {prog.overdue ? "overdue" : inv.status}
                    </Badge>
                  </Td>
                  <Td className={cx("whitespace-nowrap", prog.overdue ? "text-scarlet" : "text-ink-soft")}>
                    {prog.next ? `${money(prog.next.amountCents)} · ${formatDay(prog.next.dueDate, "medium")}` : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
