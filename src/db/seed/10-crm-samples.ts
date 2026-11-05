/**
 * Sample CRM rows so the studio doesn't open empty. Everything is flagged isSample
 * and carries the last name "Sample". Fixed ids + onConflictDoNothing = safe to re-run.
 * (Money — proposals, invoices, payments — is seeded by the money module.)
 */
import { db, schema } from "@/db";
import { addDays, todayIn } from "@/lib/format";
import type { ProjectType, Stage } from "@/lib/constants";

const DAY = 86_400_000;

type Sample = {
  n: number;
  first: string;
  last: string;
  partner?: string;
  type: ProjectType;
  stage: Stage;
  eventDate?: string | "rel21";
  dateNote?: string;
  venue?: string;
  location?: string;
  budget?: string;
  source?: string;
  value?: number; // dollars
  guests?: number;
  hours?: number;
  createdDaysAgo: number;
  stageDaysAgo: number;
  lostReason?: string;
  inquiry: Record<string, string>;
  ig?: string;
};

const SAMPLES: Sample[] = [
  {
    n: 1, first: "Avery", last: "Sample", partner: "Jordan", type: "wedding", stage: "booked",
    eventDate: "2027-06-12", venue: "The Acreage", location: "Sedona, AZ", budget: "$4,500 – $7,000",
    source: "Instagram", value: 5200, guests: 90, hours: 8, createdDaysAgo: 60, stageDaysAgo: 30, ig: "avery.sample",
    inquiry: { "Tell me about it": "Golden-hour ceremony outdoors, film heavy. We want it to feel unposed." },
  },
  {
    n: 2, first: "Mila", last: "Sample", partner: "Theo", type: "wedding", stage: "proposal_sent",
    eventDate: "2027-09-18", venue: "Desert Botanical Garden", location: "Phoenix, AZ", budget: "$4,500 – $7,000",
    source: "Referral from a past client", createdDaysAgo: 14, stageDaysAgo: 6, guests: 120,
    inquiry: { "Tell me about it": "Evening wedding, big family. Sent a proposal last week." },
  },
  {
    n: 3, first: "Harper", last: "Sample", partner: "Sam", type: "wedding", stage: "inquiry",
    eventDate: "2027-10-09", location: "Flagstaff, AZ", budget: "$2,500 – $4,500", source: "Google",
    createdDaysAgo: 3, stageDaysAgo: 3,
    inquiry: { "Tell me about it": "Small mountain wedding, 40 guests. Are you available?", "Why Scarlet": "We love your film work." },
  },
  {
    n: 4, first: "Nora", last: "Sample", partner: "Eli", type: "engagement", stage: "consultation",
    dateNote: "this winter, flexible", location: "Tucson, AZ", budget: "$1,000 – $2,500", source: "TikTok",
    createdDaysAgo: 9, stageDaysAgo: 2,
    inquiry: { "Tell me about it": "Desert engagement shoot at sunrise." },
  },
  {
    n: 5, first: "Quinn", last: "Sample", type: "senior", stage: "follow_up",
    dateNote: "spring 2027 before graduation", location: "Scottsdale, AZ", budget: "Under $1,000", source: "Pinterest",
    createdDaysAgo: 11, stageDaysAgo: 5, ig: "quinn.sample",
    inquiry: { School: "Sample High School", "Graduation year": "2027" },
  },
  {
    n: 6, first: "Rowan", last: "Sample", type: "branding", stage: "booked", eventDate: "rel21",
    venue: "Rowan's studio", location: "Mesa, AZ", budget: "$1,000 – $2,500", source: "Venue or vendor referral",
    value: 1800, hours: 3, createdDaysAgo: 25, stageDaysAgo: 12,
    inquiry: { "Business name": "Sample Ceramics", Website: "samplesceramics.example" },
  },
  {
    n: 7, first: "Sage", last: "Sample", type: "portrait", stage: "delivered", eventDate: "2026-09-27",
    location: "Phoenix, AZ", source: "Instagram", value: 650, hours: 1, createdDaysAgo: 70, stageDaysAgo: 8,
    inquiry: { "Tell me about it": "Family portraits at the park." },
  },
  {
    n: 8, first: "Wren", last: "Sample", partner: "Cole", type: "wedding", stage: "lost",
    eventDate: "2027-03-20", location: "Prescott, AZ", budget: "Under $1,000", source: "The Knot / WeddingWire",
    createdDaysAgo: 40, stageDaysAgo: 28, lostReason: "Budget was well under my minimum.",
    inquiry: { "Tell me about it": "Courthouse wedding with a small dinner after." },
  },
];

export async function seed(): Promise<string> {
  const today = todayIn("America/Phoenix");
  const now = Date.now();
  let contacts = 0;
  let projects = 0;

  for (const s of SAMPLES) {
    const cid = `crm_sample_c${s.n}`;
    const pid = `crm_sample_p${s.n}`;
    const typeLabel = s.type[0].toUpperCase() + s.type.slice(1);
    const names = s.partner ? `${s.first} & ${s.partner}` : `${s.first} ${s.last}`;
    const created = new Date(now - s.createdDaysAgo * DAY);
    const stageAt = new Date(now - s.stageDaysAgo * DAY);
    const booked = ["booked", "planning", "editing", "delivered", "completed"].includes(s.stage);

    const c = await db
      .insert(schema.contacts)
      .values({
        id: cid,
        firstName: s.first,
        lastName: s.last,
        email: `${s.first.toLowerCase()}.sample@example.com`,
        phone: `555-010${s.n}`,
        instagram: s.ig ?? "",
        partnerFirstName: s.partner ?? "",
        partnerLastName: s.partner ? s.last : "",
        source: s.source ?? "",
        notes: "Sample client. Safe to delete.",
        isSample: true,
        createdAt: created,
      })
      .onConflictDoNothing()
      .returning({ id: schema.contacts.id });
    contacts += c.length;

    const p = await db
      .insert(schema.projects)
      .values({
        id: pid,
        contactId: cid,
        title: `${names} (Sample) — ${typeLabel}`,
        type: s.type,
        stage: s.stage,
        eventDate: s.eventDate === "rel21" ? addDays(today, 21) : (s.eventDate ?? null),
        eventDateNote: s.dateNote ?? "",
        venue: s.venue ?? "",
        location: s.location ?? "",
        guestCount: s.guests ?? null,
        coverageHours: s.hours ?? null,
        budget: s.budget ?? "",
        valueCents: (s.value ?? 0) * 100,
        leadSource: s.source ?? "",
        inquiryData: s.inquiry,
        notes: "",
        portalToken: `sample-portal-token-${s.n}`,
        lostReason: s.lostReason ?? "",
        isSample: true,
        bookedAt: booked ? new Date(now - (s.stageDaysAgo + 3) * DAY) : null,
        deliveredAt: s.stage === "delivered" ? stageAt : null,
        stageChangedAt: stageAt,
        createdAt: created,
      })
      .onConflictDoNothing()
      .returning({ id: schema.projects.id });
    projects += p.length;

    // timeline: the inquiry, a stage move, and (for some) a note
    await db
      .insert(schema.activities)
      .values({
        id: `crm_sample_a${s.n}_1`,
        projectId: pid,
        contactId: cid,
        kind: "inquiry",
        title: `New ${s.type} inquiry from ${names}`,
        body: s.inquiry["Tell me about it"] ?? "",
        createdAt: created,
      })
      .onConflictDoNothing();
    if (s.stage !== "inquiry") {
      await db
        .insert(schema.activities)
        .values({
          id: `crm_sample_a${s.n}_2`,
          projectId: pid,
          contactId: cid,
          kind: "stage",
          title: `Moved to ${s.stage.replace("_", " ")}`,
          body: s.lostReason ?? "",
          meta: { to: s.stage, by: "studio" },
          createdAt: stageAt,
        })
        .onConflictDoNothing();
    }
    if (s.n % 2 === 1 && s.stage !== "inquiry") {
      await db
        .insert(schema.activities)
        .values({
          id: `crm_sample_a${s.n}_3`,
          projectId: pid,
          contactId: cid,
          kind: "note",
          title: "Note",
          body: "Spoke by phone. Friendly and organised; prefers text over email.",
          createdAt: new Date(stageAt.getTime() + 3_600_000),
        })
        .onConflictDoNothing();
    }
  }

  const tasks = [
    { id: "crm_sample_t1", p: 2, title: "Follow up on the Mila & Theo proposal", due: addDays(today, -2) },
    { id: "crm_sample_t2", p: 4, title: "Send Nora & Eli location ideas", due: today },
    { id: "crm_sample_t3", p: 6, title: "Confirm shot list with Rowan", due: addDays(today, 5) },
    { id: "crm_sample_t4", p: 1, title: "Send Avery & Jordan the engagement-session questionnaire", due: addDays(today, -5) },
    { id: "crm_sample_t5", p: null, title: "Order sample prints for the studio", due: null },
  ];
  for (const t of tasks) {
    await db
      .insert(schema.tasks)
      .values({
        id: t.id,
        projectId: t.p ? `crm_sample_p${t.p}` : null,
        title: t.title,
        dueDate: t.due,
      })
      .onConflictDoNothing();
  }

  return `${contacts} sample contacts, ${projects} sample projects (+ activities, ${tasks.length} to-dos) new this run`;
}
