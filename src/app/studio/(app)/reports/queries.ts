/* Business numbers for the Reports page. All money is integer cents; months/years are
   computed in the studio's time zone (a payment at 11pm Arizona time belongs to that day). */
import { db, schema } from "@/db";
import { BOOKED_STAGES, OPEN_LEAD_STAGES, projectTypeLabel, stageLabel } from "@/lib/constants";

const BOOKED = new Set<string>(BOOKED_STAGES);
const OPEN = new Set<string>(OPEN_LEAD_STAGES);

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function ymIn(d: Date, tz: string): { year: number; month: number } {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric" });
    fmtCache.set(tz, f);
  }
  const parts = f.formatToParts(d);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Row = { label: string; cents?: number; count: number };
export type SourceRow = { label: string; inquiries: number; booked: number; pct: number };

export type Report = {
  year: number;
  collectedByMonth: number[]; // 12 entries, cents
  collectedTotal: number;
  expensesByMonth: number[];
  expensesTotal: number;
  expensesByCategory: { label: string; cents: number }[];
  profit: number;
  bookingsByType: Row[];
  bookingsCount: number;
  bookingsValue: number;
  avgBookingValue: number | null;
  sources: SourceRow[];
  inquiriesCount: number;
  pipelineCents: number;
  pipelineCount: number;
  pipelineByStage: { label: string; cents: number; count: number }[];
  sampleProjects: number;
};

export async function reportYears(tz: string): Promise<number[]> {
  const ys = new Set<number>([ymIn(new Date(), tz).year]);
  const inst = await db.select({ paidAt: schema.installments.paidAt }).from(schema.installments);
  for (const r of inst) if (r.paidAt) ys.add(ymIn(r.paidAt, tz).year);
  const ex = await db.select({ date: schema.expenses.date }).from(schema.expenses);
  for (const r of ex) ys.add(Number(r.date.slice(0, 4)));
  const pr = await db.select({ c: schema.projects.createdAt, b: schema.projects.bookedAt }).from(schema.projects);
  for (const r of pr) {
    ys.add(ymIn(r.c, tz).year);
    if (r.b) ys.add(ymIn(r.b, tz).year);
  }
  return [...ys].filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
}

export async function buildReport(year: number, tz: string): Promise<Report> {
  const [installments, expenses, projects] = await Promise.all([
    db
      .select({
        amountCents: schema.installments.amountCents,
        paidAt: schema.installments.paidAt,
        status: schema.installments.status,
      })
      .from(schema.installments),
    db.select().from(schema.expenses),
    db.select().from(schema.projects),
  ]);

  // money collected: paid installments by paidAt month
  const collectedByMonth = Array<number>(12).fill(0);
  for (const i of installments) {
    if (i.status !== "paid" || !i.paidAt) continue;
    const { year: y, month } = ymIn(i.paidAt, tz);
    if (y === year) collectedByMonth[month - 1] += i.amountCents;
  }
  const collectedTotal = collectedByMonth.reduce((a, b) => a + b, 0);

  // expenses
  const expensesByMonth = Array<number>(12).fill(0);
  const cat = new Map<string, number>();
  for (const e of expenses) {
    if (Number(e.date.slice(0, 4)) !== year) continue;
    const m = Number(e.date.slice(5, 7));
    if (m >= 1 && m <= 12) expensesByMonth[m - 1] += e.amountCents;
    cat.set(e.category, (cat.get(e.category) ?? 0) + e.amountCents);
  }
  const expensesTotal = expensesByMonth.reduce((a, b) => a + b, 0);
  const expensesByCategory = [...cat.entries()]
    .map(([label, cents]) => ({ label, cents }))
    .sort((a, b) => b.cents - a.cents);

  // bookings made this year (by the day they were booked)
  const bookedThisYear = projects.filter((p) => {
    if (!BOOKED.has(p.stage)) return false;
    const when = p.bookedAt ?? p.stageChangedAt ?? p.createdAt;
    return ymIn(when, tz).year === year;
  });
  const byType = new Map<string, { count: number; cents: number }>();
  for (const p of bookedThisYear) {
    const k = projectTypeLabel(p.type);
    const cur = byType.get(k) ?? { count: 0, cents: 0 };
    cur.count++;
    cur.cents += p.valueCents;
    byType.set(k, cur);
  }
  const bookingsByType: Row[] = [...byType.entries()]
    .map(([label, v]) => ({ label, count: v.count, cents: v.cents }))
    .sort((a, b) => b.count - a.count || (b.cents ?? 0) - (a.cents ?? 0));
  const valued = bookedThisYear.filter((p) => p.valueCents > 0);
  const bookingsValue = bookedThisYear.reduce((a, p) => a + p.valueCents, 0);
  const avgBookingValue = valued.length
    ? Math.round(valued.reduce((a, p) => a + p.valueCents, 0) / valued.length)
    : null;

  // lead sources: everyone who inquired this year, and how many of them booked
  const src = new Map<string, { inquiries: number; booked: number }>();
  let inquiriesCount = 0;
  for (const p of projects) {
    if (ymIn(p.createdAt, tz).year !== year) continue;
    inquiriesCount++;
    const k = p.leadSource.trim() || "Not recorded";
    const cur = src.get(k) ?? { inquiries: 0, booked: 0 };
    cur.inquiries++;
    if (BOOKED.has(p.stage)) cur.booked++;
    src.set(k, cur);
  }
  const sources: SourceRow[] = [...src.entries()]
    .map(([label, v]) => ({
      label,
      inquiries: v.inquiries,
      booked: v.booked,
      pct: v.inquiries ? Math.round((v.booked / v.inquiries) * 100) : 0,
    }))
    .sort((a, b) => b.inquiries - a.inquiries);

  // open pipeline: right now, all open leads (not archived)
  const open = projects.filter((p) => OPEN.has(p.stage) && !p.archived);
  const stageMap = new Map<string, { cents: number; count: number }>();
  for (const p of open) {
    const k = stageLabel(p.stage);
    const cur = stageMap.get(k) ?? { cents: 0, count: 0 };
    cur.cents += p.valueCents;
    cur.count++;
    stageMap.set(k, cur);
  }
  const order = OPEN_LEAD_STAGES.map((s) => stageLabel(s));
  const pipelineByStage = [...stageMap.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

  return {
    year,
    collectedByMonth,
    collectedTotal,
    expensesByMonth,
    expensesTotal,
    expensesByCategory,
    profit: collectedTotal - expensesTotal,
    bookingsByType,
    bookingsCount: bookedThisYear.length,
    bookingsValue,
    avgBookingValue,
    sources,
    inquiriesCount,
    pipelineCents: open.reduce((a, p) => a + p.valueCents, 0),
    pipelineCount: open.length,
    pipelineByStage,
    sampleProjects: projects.filter((p) => p.isSample).length,
  };
}
