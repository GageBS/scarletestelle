import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDay, money, todayIn } from "@/lib/format";
import { Card, EmptyState, LinkButton, PageHeader, Stat, Table, Td, Th, cx } from "@/components/studio/ui";
import { ConfirmButton } from "@/components/studio/client-ui";
import { MONTHS } from "../reports/queries";
import { createExpense, deleteExpense, updateExpense } from "./actions";
import { ExpenseForm } from "./expense-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireStudio();
  const tz = (await getSettings()).business.timezone;
  const today = todayIn(tz);
  const sp = await searchParams;
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : Number(today.slice(0, 4));

  const [rows, projectRows, allDates] = await Promise.all([
    db
      .select()
      .from(schema.expenses)
      .where(and(gte(schema.expenses.date, `${year}-01-01`), lte(schema.expenses.date, `${year}-12-31`)))
      .orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt)),
    db
      .select({ id: schema.projects.id, title: schema.projects.title })
      .from(schema.projects)
      .orderBy(desc(schema.projects.createdAt))
      .limit(300),
    db.select({ date: schema.expenses.date }).from(schema.expenses).orderBy(asc(schema.expenses.date)),
  ]);

  const years = [...new Set([Number(today.slice(0, 4)), year, ...allDates.map((d) => Number(d.date.slice(0, 4)))])]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const projectName = new Map(projectRows.map((p) => [p.id, p.title]));

  const byMonth = Array<number>(12).fill(0);
  const byCat = new Map<string, number>();
  for (const e of rows) {
    const m = Number(e.date.slice(5, 7));
    if (m >= 1 && m <= 12) byMonth[m - 1] += e.amountCents;
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountCents);
  }
  const total = byMonth.reduce((a, b) => a + b, 0);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Expenses"
        description="Film, gear, software, travel: everything you spend to run the business."
        actions={
          <LinkButton href={`/studio/expenses/export?year=${year}`} variant="secondary" prefetch={false}>
            Download {year} (CSV)
          </LinkButton>
        }
      />

      <nav aria-label="Year" className="-mt-2 mb-6 flex flex-wrap gap-2">
        {years.map((y) => (
          <Link
            key={y}
            href={`/studio/expenses?year=${y}`}
            aria-current={y === year ? "page" : undefined}
            className={cx(
              "inline-flex min-h-10 min-w-16 items-center justify-center rounded-sm border px-4 font-sans text-sm transition",
              y === year ? "border-ink bg-ink text-cream" : "border-rule text-ink-soft hover:border-ink",
            )}
          >
            {y}
          </Link>
        ))}
      </nav>

      <div className="space-y-8">
        <Card title="Add an expense">
          <ExpenseForm
            action={createExpense}
            projects={projectRows}
            submitLabel="Add expense"
            values={{
              date: today,
              category: "Film & developing",
              vendor: "",
              amount: "",
              notes: "",
              projectId: null,
            }}
          />
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={`Total ${year}`} value={money(total, { cents: false })} />
          <Stat label="Entries" value={rows.length} />
          <Stat
            label="Biggest category"
            value={<span className="text-2xl">{cats[0]?.[0] ?? "—"}</span>}
            hint={cats[0] ? money(cats[0][1], { cents: false }) : undefined}
          />
          <Stat
            label="Monthly average"
            value={money(Math.round(total / 12), { cents: false })}
            hint="across 12 months"
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card title={`By month, ${year}`}>
            <Table>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th className="text-right">Spent</Th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((m, i) => (
                  <tr key={m}>
                    <Td>{m}</Td>
                    <Td className="text-right tabular-nums">{money(byMonth[i], { cents: false })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <Card title={`By category, ${year}`}>
            {cats.length === 0 ? (
              <p className="font-sans text-sm text-muted">Nothing logged in {year} yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Category</Th>
                    <Th className="text-right">Spent</Th>
                    <Th className="text-right">Share</Th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map(([c, v]) => (
                    <tr key={c}>
                      <Td>{c}</Td>
                      <Td className="text-right tabular-nums">{money(v, { cents: false })}</Td>
                      <Td className="text-right tabular-nums">{total ? Math.round((v / total) * 100) : 0}%</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <Card title={`All expenses, ${year}`}>
          {rows.length === 0 ? (
            <EmptyState title="Nothing here yet">Add your first expense above.</EmptyState>
          ) : (
            <ul className="divide-y divide-rule">
              {rows.map((e) => (
                <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3 font-sans">
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {e.vendor || e.category}
                        <span className="text-muted"> · {e.category}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {formatDay(e.date)}
                        {e.projectId && projectName.get(e.projectId) ? ` · ${projectName.get(e.projectId)}` : ""}
                      </p>
                      {e.notes && <p className="mt-0.5 text-xs text-ink-soft">{e.notes}</p>}
                    </div>
                    <p className="shrink-0 text-sm tabular-nums">{money(e.amountCents, { cents: true })}</p>
                  </div>
                  <details className="mt-1">
                    <summary className="label flex min-h-10 cursor-pointer items-center text-ink-soft">Edit</summary>
                    <div className="space-y-3 pt-2">
                      <ExpenseForm
                        action={updateExpense}
                        projects={projectRows}
                        submitLabel="Save changes"
                        values={{
                          id: e.id,
                          date: e.date,
                          category: e.category,
                          vendor: e.vendor,
                          amount: (e.amountCents / 100).toFixed(2),
                          notes: e.notes,
                          projectId: e.projectId,
                        }}
                      />
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={e.id} />
                        <ConfirmButton confirmText="Tap again to delete">Delete expense</ConfirmButton>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
