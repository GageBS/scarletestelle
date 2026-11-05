import type { Metadata } from "next";
import Link from "next/link";
import { requireStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { Card, EmptyState, Notice, PageHeader, Stat, Table, Td, Th, cx } from "@/components/studio/ui";
import { MONTHS, buildReport, reportYears } from "./queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports" };

function compact(cents: number) {
  const d = cents / 100;
  if (d >= 10000) return `$${Math.round(d / 1000)}k`;
  if (d >= 1000) return `$${(d / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(d)}`;
}

function MonthBars({ values, title, tone }: { values: number[]; title: string; tone: "scarlet" | "moss" }) {
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <ol className="flex h-52 items-stretch gap-1 md:h-64 md:gap-2" aria-label={title}>
        {values.map((v, i) => (
          <li key={MONTHS[i]} className="flex min-w-0 flex-1 flex-col items-center justify-end">
            <span className="sr-only">
              {MONTHS[i]}: {money(v)}
            </span>
            <span aria-hidden className="mb-1 font-sans text-[0.58rem] leading-none text-ink-soft md:text-xs">
              {v > 0 ? compact(v) : ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                aria-hidden
                className={cx("w-full rounded-t-[2px]", tone === "scarlet" ? "bg-scarlet" : "bg-moss")}
                style={{ height: v > 0 ? `${Math.max((v / max) * 100, 2)}%` : "1px", opacity: v > 0 ? 1 : 0.25 }}
              />
            </div>
            <span aria-hidden className="mt-1.5 font-sans text-[0.58rem] uppercase text-muted md:text-[0.68rem]">
              {MONTHS[i]}
            </span>
          </li>
        ))}
      </ol>
      <details className="mt-3">
        <summary className="label flex min-h-10 cursor-pointer items-center text-ink-soft">View as a table</summary>
        <Table>
          <thead>
            <tr>
              <Th>Month</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {values.map((v, i) => (
              <tr key={MONTHS[i]}>
                <Td>{MONTHS[i]}</Td>
                <Td className="text-right tabular-nums">{money(v, { cents: false })}</Td>
              </tr>
            ))}
            <tr>
              <Td className="font-medium">Total</Td>
              <Td className="text-right font-medium tabular-nums">{money(total, { cents: false })}</Td>
            </tr>
          </tbody>
        </Table>
      </details>
    </figure>
  );
}

function BarList({
  rows,
  tone = "scarlet",
}: {
  rows: { label: string; value: number; display: string; sub?: string }[];
  tone?: "scarlet" | "moss" | "ink";
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 font-sans text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {r.display}
              {r.sub && <span className="ml-2 text-xs text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-linen" aria-hidden>
            <div
              className={cx(
                "h-full rounded-full",
                tone === "scarlet" ? "bg-scarlet" : tone === "moss" ? "bg-moss" : "bg-ink",
              )}
              style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireStudio();
  const tz = (await getSettings()).business.timezone;
  const years = await reportYears(tz);
  const sp = await searchParams;
  const asked = Number(sp.year);
  const year = years.includes(asked) ? asked : years[0];
  const r = await buildReport(year, tz);

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Reports"
        description={`How the business is doing in ${year}. Money is counted on the day it was paid (${tz.replace("_", " ")} time).`}
      />

      <nav aria-label="Year" className="-mt-2 mb-6 flex flex-wrap gap-2">
        {years.map((y) => (
          <Link
            key={y}
            href={`/studio/reports?year=${y}`}
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

      {r.sampleProjects > 0 && (
        <div className="mb-6">
          <Notice tone="info">
            These numbers include {r.sampleProjects} sample project{r.sampleProjects === 1 ? "" : "s"}. You can
            remove them in Settings → Sample &amp; demo content.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Collected" value={money(r.collectedTotal, { cents: false })} />
        <Stat label="Expenses" value={money(r.expensesTotal, { cents: false })} />
        <Stat
          label="Profit"
          value={<span className={r.profit < 0 ? "text-scarlet" : undefined}>{money(r.profit, { cents: false })}</span>}
          hint="Collected minus expenses"
        />
        <Stat label="Booked" value={r.bookingsCount} hint={r.bookingsValue ? `${money(r.bookingsValue, { cents: false })} total` : undefined} />
        <Stat
          label="Avg booking"
          value={r.avgBookingValue == null ? "—" : money(r.avgBookingValue, { cents: false })}
        />
        <Stat
          label="Open pipeline"
          value={r.pipelineCents > 0 ? money(r.pipelineCents, { cents: false }) : r.pipelineCount}
          hint={r.pipelineCents > 0 ? `${r.pipelineCount} open inquiries` : "open inquiries (no values set)"}
        />
      </div>

      <div className="mt-8 space-y-8">
        <Card title={`Money collected by month, ${year}`}>
          {r.collectedTotal === 0 ? (
            <EmptyState title="Nothing collected yet">
              Payments show up here the day they are marked paid on an invoice.
            </EmptyState>
          ) : (
            <MonthBars values={r.collectedByMonth} title={`Money collected by month in ${year}`} tone="scarlet" />
          )}
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card title="Bookings by type">
            {r.bookingsByType.length === 0 ? (
              <p className="font-sans text-sm text-muted">No bookings in {year}.</p>
            ) : (
              <BarList
                tone="ink"
                rows={r.bookingsByType.map((b) => ({
                  label: b.label,
                  value: b.count,
                  display: `${b.count} booked`,
                  sub: b.cents ? money(b.cents, { cents: false }) : undefined,
                }))}
              />
            )}
          </Card>

          <Card title="Where clients come from">
            {r.sources.length === 0 ? (
              <p className="font-sans text-sm text-muted">No inquiries in {year}.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Source</Th>
                    <Th className="text-right">Inquiries</Th>
                    <Th className="text-right">Booked</Th>
                    <Th className="text-right">Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.sources.map((s) => (
                    <tr key={s.label}>
                      <Td>{s.label}</Td>
                      <Td className="text-right tabular-nums">{s.inquiries}</Td>
                      <Td className="text-right tabular-nums">{s.booked}</Td>
                      <Td className="text-right tabular-nums">{s.pct}%</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card title="Expenses by category">
            {r.expensesByCategory.length === 0 ? (
              <p className="font-sans text-sm text-muted">No expenses logged in {year}.</p>
            ) : (
              <BarList
                tone="moss"
                rows={r.expensesByCategory.map((c) => ({
                  label: c.label,
                  value: c.cents,
                  display: money(c.cents, { cents: false }),
                }))}
              />
            )}
          </Card>

          <Card title="Open pipeline right now">
            {r.pipelineByStage.length === 0 ? (
              <p className="font-sans text-sm text-muted">No open inquiries.</p>
            ) : (
              <BarList
                rows={r.pipelineByStage.map((s) => ({
                  label: s.label,
                  value: s.cents > 0 ? s.cents : s.count,
                  display: s.cents > 0 ? money(s.cents, { cents: false }) : `${s.count}`,
                  sub: s.cents > 0 ? `${s.count} open` : "no value set",
                }))}
              />
            )}
          </Card>
        </div>

        <Card title="Profit & loss">
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th className="text-right">Collected</Th>
                <Th className="text-right">Expenses</Th>
                <Th className="text-right">Profit</Th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const p = r.collectedByMonth[i] - r.expensesByMonth[i];
                return (
                  <tr key={m}>
                    <Td>{m}</Td>
                    <Td className="text-right tabular-nums">{money(r.collectedByMonth[i], { cents: false })}</Td>
                    <Td className="text-right tabular-nums">{money(r.expensesByMonth[i], { cents: false })}</Td>
                    <Td className={cx("text-right tabular-nums", p < 0 && "text-scarlet")}>
                      {money(p, { cents: false })}
                    </Td>
                  </tr>
                );
              })}
              <tr>
                <Td className="font-medium">{year}</Td>
                <Td className="text-right font-medium tabular-nums">{money(r.collectedTotal, { cents: false })}</Td>
                <Td className="text-right font-medium tabular-nums">{money(r.expensesTotal, { cents: false })}</Td>
                <Td className={cx("text-right font-medium tabular-nums", r.profit < 0 && "text-scarlet")}>
                  {money(r.profit, { cents: false })}
                </Td>
              </tr>
            </tbody>
          </Table>
          <p className="mt-3 font-sans text-xs text-muted">
            This is a simple view for your own planning, before taxes. Ask your accountant about deductions.
          </p>
        </Card>
      </div>
    </>
  );
}
