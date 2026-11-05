/* Single source of truth for enums shared by the site, studio and DB. */

export const PROJECT_TYPES = [
  { value: "wedding", label: "Wedding", category: "weddings" },
  { value: "elopement", label: "Elopement", category: "weddings" },
  { value: "engagement", label: "Engagement", category: "couples" },
  { value: "couples", label: "Couples", category: "couples" },
  { value: "senior", label: "Senior", category: "seniors" },
  { value: "branding", label: "Branding", category: "branding" },
  { value: "portrait", label: "Portrait", category: "seniors" },
  { value: "other", label: "Other", category: null },
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number]["value"];
export const projectTypeLabel = (t: string) =>
  PROJECT_TYPES.find((p) => p.value === t)?.label ?? t;

// pipeline order (left → right on the board)
export const STAGES = [
  { value: "inquiry", label: "Inquiry", tone: "scarlet" },
  { value: "follow_up", label: "Follow-up", tone: "rose" },
  { value: "consultation", label: "Consultation", tone: "rose" },
  { value: "proposal_sent", label: "Proposal sent", tone: "blush" },
  { value: "booked", label: "Booked", tone: "moss" },
  { value: "planning", label: "Planning", tone: "moss" },
  { value: "editing", label: "Editing", tone: "ink" },
  { value: "delivered", label: "Gallery delivered", tone: "ink" },
  { value: "completed", label: "Completed", tone: "muted" },
  { value: "lost", label: "Not booked", tone: "muted" },
] as const;
export type Stage = (typeof STAGES)[number]["value"];
export const stageLabel = (s: string) =>
  STAGES.find((x) => x.value === s)?.label ?? s;
// stages that count as "a booked client" for reports
export const BOOKED_STAGES: Stage[] = [
  "booked",
  "planning",
  "editing",
  "delivered",
  "completed",
];
export const OPEN_LEAD_STAGES: Stage[] = [
  "inquiry",
  "follow_up",
  "consultation",
  "proposal_sent",
];

export const LEAD_SOURCES = [
  "Instagram",
  "TikTok",
  "Google",
  "Pinterest",
  "Referral from a past client",
  "Venue or vendor referral",
  "The Knot / WeddingWire",
  "Saw my work at an event",
  "Other",
] as const;

export const BUDGET_RANGES = [
  "Under $1,000",
  "$1,000 – $2,500",
  "$2,500 – $4,500",
  "$4,500 – $7,000",
  "$7,000+",
  "Not sure yet",
] as const;

export type ActivityKind =
  | "inquiry"
  | "note"
  | "email"
  | "stage"
  | "proposal"
  | "contract"
  | "invoice"
  | "payment"
  | "questionnaire"
  | "meeting"
  | "task"
  | "automation"
  | "portal";

export type PaymentPlan =
  | { kind: "full"; dueDaysAfterSigning: number }
  | {
      kind: "retainer";
      retainerPercent: number; // e.g. 30
      balanceDueDaysBeforeEvent: number; // e.g. 30
    }
  | {
      kind: "installments";
      count: number; // total payments incl. first
      firstPercent: number; // first payment %, rest split evenly
      finalDueDaysBeforeEvent: number;
    };

export type LineItem = {
  description: string;
  quantity: number;
  unitCents: number;
};

export type QField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "time" | "select" | "checkboxes" | "heading";
  help?: string;
  options?: string[];
  required?: boolean;
};

export const AUTOMATION_TRIGGERS = [
  { value: "inquiry_received", label: "A new inquiry comes in", timed: false },
  { value: "proposal_sent", label: "A proposal is sent", timed: false },
  {
    value: "proposal_unaccepted",
    label: "Days after a proposal was sent and not yet signed",
    timed: true,
  },
  { value: "proposal_accepted", label: "A client signs their proposal", timed: false },
  { value: "payment_received", label: "A payment is received", timed: false },
  { value: "installment_due", label: "Days before a payment is due", timed: true },
  { value: "questionnaire_submitted", label: "A questionnaire is submitted", timed: false },
  { value: "stage_changed", label: "A project moves to a stage", timed: false },
  { value: "before_event", label: "Days before the session / wedding", timed: true },
  { value: "after_event", label: "Days after the session / wedding", timed: true },
  { value: "after_delivery", label: "Days after the gallery is delivered", timed: true },
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number]["value"];

export const AUTOMATION_ACTIONS = [
  { value: "send_email", label: "Send an email" },
  { value: "send_questionnaire", label: "Send a questionnaire" },
  { value: "create_task", label: "Create a to-do for me" },
  { value: "move_stage", label: "Move the project to a stage" },
] as const;
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number]["value"];

export type TimeRange = { start: string; end: string }; // "09:00"–"17:00"
export type WeeklyHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  TimeRange[]
>;

export const EXPENSE_CATEGORIES = [
  "Gear",
  "Film & developing",
  "Editing & software",
  "Travel",
  "Marketing",
  "Education",
  "Prints & products",
  "Second shooter / assistant",
  "Insurance & fees",
  "Other",
] as const;

export const PAYMENT_METHODS = [
  { value: "stripe", label: "Card (Stripe)" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
] as const;
