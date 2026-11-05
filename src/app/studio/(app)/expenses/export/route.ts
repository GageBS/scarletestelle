import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { isStudio } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** CSV cell: quote it, and defuse spreadsheet formulas (=, +, -, @ at the start). */
function cell(v: string | number) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  if (!(await isStudio())) return new Response("Unauthorized", { status: 401 });

  const y = new URL(req.url).searchParams.get("year");
  const year = y && /^\d{4}$/.test(y) ? y : null;
  const rows = await db
    .select({
      date: schema.expenses.date,
      category: schema.expenses.category,
      vendor: schema.expenses.vendor,
      amountCents: schema.expenses.amountCents,
      notes: schema.expenses.notes,
      project: schema.projects.title,
    })
    .from(schema.expenses)
    .leftJoin(schema.projects, eq(schema.projects.id, schema.expenses.projectId))
    .where(
      year
        ? and(gte(schema.expenses.date, `${year}-01-01`), lte(schema.expenses.date, `${year}-12-31`))
        : undefined,
    )
    .orderBy(asc(schema.expenses.date));

  const lines = [
    ["Date", "Category", "Vendor", "Amount (USD)", "Project", "Notes"].map(cell).join(","),
    ...rows.map((r) =>
      [r.date, r.category, r.vendor, (r.amountCents / 100).toFixed(2), r.project ?? "", r.notes]
        .map(cell)
        .join(","),
    ),
  ];
  // BOM so Excel opens UTF-8 correctly
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${year ?? "all"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
