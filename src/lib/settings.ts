import { db, schema } from "@/db";
import type { WeeklyHours } from "@/lib/constants";

export type BusinessSettings = {
  name: string;
  photographer: string;
  email: string; // studio inbox (shown to clients, reply-to)
  phone: string;
  instagram: string;
  location: string; // "Phoenix, Arizona · travels everywhere"
  timezone: string; // IANA zone used for "today", reminders, scheduler
  invoicePrefix: string;
  signatureName: string; // name used when Scarlet countersigns
};
export type PaymentSettings = {
  venmo: string;
  zelle: string;
  checkPayableTo: string;
  instructions: string; // extra manual-payment instructions
  defaultTaxRateBps: number;
};
export type AvailabilitySettings = {
  weekly: WeeklyHours;
  minNoticeHours: number;
  bufferMin: number;
  horizonDays: number;
  maxPerDay: number;
};
export type NotificationSettings = {
  notifyEmail: string; // where new-inquiry alerts go
  notifyOnInquiry: boolean;
  notifyOnSigned: boolean;
  notifyOnPayment: boolean;
};

export type StudioSettings = {
  business: BusinessSettings;
  payments: PaymentSettings;
  availability: AvailabilitySettings;
  notifications: NotificationSettings;
};

export const DEFAULT_SETTINGS: StudioSettings = {
  business: {
    name: "Scarlet Estelle Photography",
    photographer: "Scarlet Summers",
    email: "",
    phone: "",
    instagram: "@scarletestelle",
    location: "",
    timezone: "America/Phoenix",
    invoicePrefix: "SE",
    signatureName: "Scarlet Summers",
  },
  payments: {
    venmo: "",
    zelle: "",
    checkPayableTo: "Scarlet Summers",
    instructions: "",
    defaultTaxRateBps: 0,
  },
  availability: {
    weekly: {
      mon: [{ start: "10:00", end: "18:00" }],
      tue: [{ start: "10:00", end: "18:00" }],
      wed: [{ start: "10:00", end: "18:00" }],
      thu: [{ start: "10:00", end: "18:00" }],
      fri: [{ start: "10:00", end: "15:00" }],
      sat: [],
      sun: [],
    },
    minNoticeHours: 24,
    bufferMin: 15,
    horizonDays: 60,
    maxPerDay: 3,
  },
  notifications: {
    notifyEmail: "",
    notifyOnInquiry: true,
    notifyOnSigned: true,
    notifyOnPayment: true,
  },
};

export async function getSettings(): Promise<StudioSettings> {
  const rows = await db.select().from(schema.settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const k of Object.keys(out) as (keyof StudioSettings)[]) {
    const v = map.get(k);
    if (v && typeof v === "object") Object.assign(out[k], v);
  }
  return out;
}

export async function saveSettings<K extends keyof StudioSettings>(
  key: K,
  value: StudioSettings[K],
) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

export const siteUrl = () =>
  (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
