import Link from "next/link";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { daysBetween, formatDay, money, todayIn } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { PROJECT_TYPES, STAGES, projectTypeLabel } from "@/lib/constants";
import { Button, EmptyState, Input, LinkButton, PageHeader, Select, btnStyles } from "@/components/studio/ui";
import { moveProjectStage } from "../projects/actions";
import { Board, type BoardCard } from "./board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; all?: string }>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const type = PROJECT_TYPES.some((t) => t.value === sp.type) ? sp.type! : "";
  const tz = (await getSettings()).business.timezone;
  const today = todayIn(tz);
  const P = schema.projects;

  const stages = STAGES.filter((s) => showAll || (s.value !== "lost" && s.value !== "completed"));
  const conds = [
    eq(P.archived, false),
    inArray(
      P.stage,
      stages.map((s) => s.value),
    ),
  ];
  if (type) conds.push(eq(P.type, type as (typeof PROJECT_TYPES)[number]["value"]));
  if (q) {
    const pat = `%${q.replace(/[%_]/g, "")}%`;
    conds.push(
      or(
        like(P.title, pat),
        like(schema.contacts.firstName, pat),
        like(schema.contacts.lastName, pat),
        like(schema.contacts.partnerFirstName, pat),
        like(schema.contacts.email, pat),
      )!,
    );
  }
  const rows = await db
    .select({ p: P })
    .from(P)
    .innerJoin(schema.contacts, eq(P.contactId, schema.contacts.id))
    .where(and(...conds))
    .orderBy(desc(P.stageChangedAt), desc(P.createdAt));

  const cards: BoardCard[] = rows.map(({ p }) => {
    const changed = p.stageChangedAt ?? p.createdAt;
    return {
      id: p.id,
      title: p.title,
      type: projectTypeLabel(p.type),
      stage: p.stage,
      date: p.eventDate ? formatDay(p.eventDate, "medium") : "",
      dateNote: p.eventDateNote,
      value: p.valueCents ? money(p.valueCents) : "",
      daysInStage: Math.max(0, daysBetween(todayIn(tz, changed), today)),
      isSample: p.isSample,
    };
  });

  const toggleHref = (() => {
    const u = new URLSearchParams();
    if (type) u.set("type", type);
    if (q) u.set("q", q);
    if (!showAll) u.set("all", "1");
    const s = u.toString();
    return `/studio/pipeline${s ? `?${s}` : ""}`;
  })();

  return (
    <>
      <PageHeader
        eyebrow="Your leads and clients"
        title="Pipeline"
        actions={
          <LinkButton href="/studio/projects/new" variant="accent">
            + New lead
          </LinkButton>
        }
      />
      <form method="get" className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input name="q" defaultValue={q} placeholder="Search by name or email" aria-label="Search" />
        <Select name="type" defaultValue={type} aria-label="Project type">
          <option value="">All types</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        {showAll && <input type="hidden" name="all" value="1" />}
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        <Link href={toggleHref} className={btnStyles.ghost}>
          {showAll ? "Hide completed & not booked" : "Show completed & not booked"}
        </Link>
      </form>

      {cards.length === 0 && (q || type) ? (
        <EmptyState
          title="No matches"
          action={
            <LinkButton href="/studio/pipeline" variant="secondary">
              Clear filters
            </LinkButton>
          }
        >
          Nothing matches those filters.
        </EmptyState>
      ) : (
        <Board
          stages={stages.map((s) => ({ value: s.value, label: s.label }))}
          cards={cards}
          move={moveProjectStage}
        />
      )}
    </>
  );
}
