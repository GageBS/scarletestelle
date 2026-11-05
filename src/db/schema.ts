/**
 * Scarlet Estelle — studio database (SQLite / libSQL via Drizzle).
 *
 * Conventions (every module follows these):
 *  - ids: text nanoid (see newId() in lib/ids.ts)
 *  - money: integer CENTS, never floats
 *  - calendar days (event dates, due dates): text "YYYY-MM-DD"
 *  - instants (created/sent/signed/paid/meeting start): integer ms → Date
 *  - JSON blobs: text({ mode: "json" }).$type<T>()
 *  - public client links use an unguessable `token` column (lib/ids.ts newToken())
 */
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  ProjectType,
  Stage,
  PaymentPlan,
  LineItem,
  QField,
  AutomationTrigger,
  AutomationAction,
} from "@/lib/constants";

const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const bool = (name: string) => integer(name, { mode: "boolean" });

/* ───────────────────────── settings ───────────────────────── */
// key/value store. Known keys + shapes live in lib/settings.ts
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
});

/* ───────────────────────── CRM core ───────────────────────── */
export const contacts = sqliteTable(
  "contacts",
  {
    id: id(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    instagram: text("instagram").notNull().default(""),
    partnerFirstName: text("partner_first_name").notNull().default(""),
    partnerLastName: text("partner_last_name").notNull().default(""),
    partnerEmail: text("partner_email").notNull().default(""),
    partnerPhone: text("partner_phone").notNull().default(""),
    source: text("source").notNull().default(""), // how they found Scarlet
    notes: text("notes").notNull().default(""),
    isSample: bool("is_sample").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contacts_email_idx").on(t.email)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    title: text("title").notNull(), // "Hannah & Eric — Wedding"
    type: text("type").$type<ProjectType>().notNull(),
    stage: text("stage").$type<Stage>().notNull().default("inquiry"),
    eventDate: text("event_date"), // YYYY-MM-DD, null = TBD
    eventDateNote: text("event_date_note").notNull().default(""), // "flexible, fall 2027"
    startTime: text("start_time").notNull().default(""), // "15:30"
    endTime: text("end_time").notNull().default(""),
    location: text("location").notNull().default(""), // city / area
    venue: text("venue").notNull().default(""),
    guestCount: integer("guest_count"),
    coverageHours: real("coverage_hours"),
    budget: text("budget").notNull().default(""),
    valueCents: integer("value_cents").notNull().default(0), // booked value
    leadSource: text("lead_source").notNull().default(""),
    inquiryData: text("inquiry_data", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'`),
    notes: text("notes").notNull().default(""),
    portalToken: text("portal_token").notNull().unique(),
    galleryUrl: text("gallery_url").notNull().default(""),
    lostReason: text("lost_reason").notNull().default(""),
    archived: bool("archived").notNull().default(false),
    isSample: bool("is_sample").notNull().default(false),
    bookedAt: ts("booked_at"),
    deliveredAt: ts("delivered_at"),
    stageChangedAt: ts("stage_changed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("projects_stage_idx").on(t.stage),
    index("projects_contact_idx").on(t.contactId),
    index("projects_event_idx").on(t.eventDate),
  ],
);

// timeline of everything that happened on a project / contact
export const activities = sqliteTable(
  "activities",
  {
    id: id(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(), // see ActivityKind in lib/constants.ts
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    meta: text("meta", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    createdAt: createdAt(),
  },
  (t) => [index("activities_project_idx").on(t.projectId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    dueDate: text("due_date"), // YYYY-MM-DD
    done: bool("done").notNull().default(false),
    doneAt: ts("done_at"),
    source: text("source").notNull().default("manual"), // manual | automation
    createdAt: createdAt(),
  },
  (t) => [index("tasks_project_idx").on(t.projectId)],
);

/* ─────────────────── services, proposals, money ─────────────────── */
export const packages = sqliteTable("packages", {
  id: id(),
  name: text("name").notNull(),
  projectType: text("project_type").$type<ProjectType>().notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  inclusions: text("inclusions", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  isAddon: bool("is_addon").notNull().default(false),
  active: bool("active").notNull().default(true),
  showOnSite: bool("show_on_site").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contractTemplates = sqliteTable("contract_templates", {
  id: id(),
  name: text("name").notNull(),
  projectType: text("project_type").$type<ProjectType | "any">().notNull().default("any"),
  body: text("body").notNull(), // markdown with {{merge_fields}}
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// HoneyBook-style "smart file": choose package → sign contract → pay retainer
export const proposals = sqliteTable(
  "proposals",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    title: text("title").notNull(),
    message: text("message").notNull().default(""),
    status: text("status")
      .$type<"draft" | "sent" | "viewed" | "accepted" | "void">()
      .notNull()
      .default("draft"),
    packageIds: text("package_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    addonIds: text("addon_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    selectedPackageId: text("selected_package_id"),
    selectedAddonIds: text("selected_addon_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    contractTemplateId: text("contract_template_id"),
    contractId: text("contract_id"),
    invoiceId: text("invoice_id"),
    paymentPlan: text("payment_plan", { mode: "json" })
      .$type<PaymentPlan>()
      .notNull(),
    taxRateBps: integer("tax_rate_bps").notNull().default(0), // 825 = 8.25%
    discountCents: integer("discount_cents").notNull().default(0),
    expiresOn: text("expires_on"), // YYYY-MM-DD
    sentAt: ts("sent_at"),
    viewedAt: ts("viewed_at"),
    acceptedAt: ts("accepted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("proposals_project_idx").on(t.projectId)],
);

export const contracts = sqliteTable(
  "contracts",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id"),
    token: text("token").notNull().unique(),
    title: text("title").notNull(),
    body: text("body").notNull(), // FINAL merged text, frozen when sent
    bodyHash: text("body_hash").notNull().default(""), // sha256 of body at signing
    status: text("status")
      .$type<"draft" | "sent" | "signed" | "countersigned" | "void">()
      .notNull()
      .default("draft"),
    clientSignatureName: text("client_signature_name"),
    clientSignatureImage: text("client_signature_image"), // data:image/png;base64
    clientSignedAt: ts("client_signed_at"),
    clientSignedIp: text("client_signed_ip"),
    clientSignedUa: text("client_signed_ua"),
    studioSignatureName: text("studio_signature_name"),
    studioSignedAt: ts("studio_signed_at"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contracts_project_idx").on(t.projectId)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id"),
    token: text("token").notNull().unique(),
    number: text("number").notNull().unique(), // SE-2026-0001
    title: text("title").notNull(),
    lineItems: text("line_items", { mode: "json" })
      .$type<LineItem[]>()
      .notNull()
      .default(sql`'[]'`),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    status: text("status")
      .$type<"draft" | "sent" | "partial" | "paid" | "void">()
      .notNull()
      .default("draft"),
    sentAt: ts("sent_at"),
    paidAt: ts("paid_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("invoices_project_idx").on(t.projectId)],
);

// the payment schedule of an invoice (retainer, balance, …). Paid rows = payments.
export const installments = sqliteTable(
  "installments",
  {
    id: id(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    sort: integer("sort").notNull().default(0),
    label: text("label").notNull(), // "Retainer", "Balance"
    amountCents: integer("amount_cents").notNull(),
    dueDate: text("due_date").notNull(), // YYYY-MM-DD
    status: text("status").$type<"due" | "paid">().notNull().default("due"),
    paidAt: ts("paid_at"),
    method: text("method").$type<
      "stripe" | "venmo" | "zelle" | "cash" | "check" | "other" | null
    >(),
    reference: text("reference").notNull().default(""),
    stripeSessionId: text("stripe_session_id"),
    createdAt: createdAt(),
  },
  (t) => [index("installments_invoice_idx").on(t.invoiceId)],
);

export const expenses = sqliteTable("expenses", {
  id: id(),
  date: text("date").notNull(), // YYYY-MM-DD
  category: text("category").notNull(), // gear, film & dev, travel, software…
  vendor: text("vendor").notNull().default(""),
  amountCents: integer("amount_cents").notNull(),
  notes: text("notes").notNull().default(""),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

/* ─────────────────── questionnaires ─────────────────── */
export const questionnaireTemplates = sqliteTable("questionnaire_templates", {
  id: id(),
  name: text("name").notNull(),
  projectType: text("project_type").$type<ProjectType | "any">().notNull().default("any"),
  intro: text("intro").notNull().default(""),
  fields: text("fields", { mode: "json" })
    .$type<QField[]>()
    .notNull()
    .default(sql`'[]'`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const questionnaires = sqliteTable(
  "questionnaires",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    templateId: text("template_id"),
    token: text("token").notNull().unique(),
    title: text("title").notNull(),
    intro: text("intro").notNull().default(""),
    fields: text("fields", { mode: "json" })
      .$type<QField[]>()
      .notNull()
      .default(sql`'[]'`),
    answers: text("answers", { mode: "json" })
      .$type<Record<string, string | string[]>>()
      .notNull()
      .default(sql`'{}'`),
    status: text("status")
      .$type<"draft" | "sent" | "submitted">()
      .notNull()
      .default("draft"),
    sentAt: ts("sent_at"),
    submittedAt: ts("submitted_at"),
    createdAt: createdAt(),
  },
  (t) => [index("questionnaires_project_idx").on(t.projectId)],
);

/* ─────────────────── email + automations ─────────────────── */
export const emailTemplates = sqliteTable("email_templates", {
  id: id(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // plain text / light markdown with {{merge_fields}}
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// every email the studio sends (or would send when email isn't connected)
export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    direction: text("direction").$type<"out" | "in">().notNull().default("out"),
    toEmail: text("to_email").notNull(),
    fromEmail: text("from_email").notNull().default(""),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // sent = delivered to provider; logged = email not connected, saved only; failed = provider error
    status: text("status").$type<"sent" | "logged" | "failed">().notNull(),
    provider: text("provider").notNull().default("log"),
    providerId: text("provider_id"),
    error: text("error"),
    automationId: text("automation_id"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_project_idx").on(t.projectId)],
);

export const automations = sqliteTable("automations", {
  id: id(),
  name: text("name").notNull(),
  trigger: text("trigger").$type<AutomationTrigger>().notNull(),
  offsetDays: integer("offset_days").notNull().default(0),
  projectTypes: text("project_types", { mode: "json" })
    .$type<ProjectType[]>()
    .notNull()
    .default(sql`'[]'`), // empty = all types
  stage: text("stage").$type<Stage | null>(), // for stage_changed trigger
  action: text("action").$type<AutomationAction>().notNull(),
  emailTemplateId: text("email_template_id"),
  questionnaireTemplateId: text("questionnaire_template_id"),
  taskTitle: text("task_title"),
  toStage: text("to_stage").$type<Stage | null>(),
  active: bool("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// idempotency ledger: an automation runs at most once per (project, subject)
export const automationRuns = sqliteTable(
  "automation_runs",
  {
    id: id(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    subjectKey: text("subject_key").notNull().default(""),
    status: text("status").$type<"done" | "failed" | "skipped">().notNull(),
    detail: text("detail").notNull().default(""),
    runAt: createdAt(),
  },
  (t) => [
    uniqueIndex("automation_runs_once").on(
      t.automationId,
      t.projectId,
      t.subjectKey,
    ),
  ],
);

/* ─────────────────── scheduler ─────────────────── */
export const meetingTypes = sqliteTable("meeting_types", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull().default(30),
  location: text("location")
    .$type<"phone" | "video" | "in_person">()
    .notNull()
    .default("video"),
  locationDetail: text("location_detail").notNull().default(""),
  active: bool("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
});

export const meetings = sqliteTable(
  "meetings",
  {
    id: id(),
    meetingTypeId: text("meeting_type_id"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status")
      .$type<"scheduled" | "cancelled" | "completed">()
      .notNull()
      .default("scheduled"),
    manageToken: text("manage_token").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("meetings_starts_idx").on(t.startsAt)],
);

export const blockedDates = sqliteTable("blocked_dates", {
  id: id(),
  date: text("date").notNull(), // YYYY-MM-DD
  reason: text("reason").notNull().default(""),
  createdAt: createdAt(),
});

/* ─────────────────── portfolio + reviews (public site) ─────────────────── */
export const categories = sqliteTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(), // weddings | couples | seniors | branding
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  coverPhotoId: text("cover_photo_id"),
  visible: bool("visible").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

// a full gallery / story ("Hannah & Eric at The Acreage")
export const galleries = sqliteTable(
  "galleries",
  {
    id: id(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    location: text("location").notNull().default(""),
    date: text("date"),
    description: text("description").notNull().default(""),
    coverPhotoId: text("cover_photo_id"),
    published: bool("published").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("galleries_category_idx").on(t.categoryId)],
);

export const photos = sqliteTable(
  "photos",
  {
    id: id(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    galleryId: text("gallery_id").references(() => galleries.id, {
      onDelete: "cascade",
    }),
    src: text("src").notNull(), // /media/… or /demo/…
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    medium: text("medium").$type<"film" | "digital" | null>(),
    featured: bool("featured").notNull().default(false), // shows on home page
    sort: integer("sort").notNull().default(0),
    isDemo: bool("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("photos_category_idx").on(t.categoryId),
    index("photos_gallery_idx").on(t.galleryId),
  ],
);

export const testimonials = sqliteTable("testimonials", {
  id: id(),
  name: text("name").notNull(), // "Hannah & Eric"
  sessionType: text("session_type").notNull().default(""), // "Wedding · Sedona"
  quote: text("quote").notNull(),
  pullQuote: text("pull_quote").notNull().default(""), // short line for script display
  photoId: text("photo_id"),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  rating: integer("rating"),
  featured: bool("featured").notNull().default(false),
  published: bool("published").notNull().default(false),
  source: text("source").$type<"manual" | "client">().notNull().default("manual"),
  isDemo: bool("is_demo").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
});
