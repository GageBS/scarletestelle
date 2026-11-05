/* Formatting helpers — safe on server and client. */

export function money(cents: number | null | undefined, opts?: { cents?: boolean }) {
  const v = (cents ?? 0) / 100;
  const showCents = opts?.cents ?? !Number.isInteger(v);
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

/** "$1,234.50" | "1234.5" | "1,234" → cents (integer). Returns null when unparseable. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[$,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Calendar day "YYYY-MM-DD" → Date at UTC midnight (no tz drift). */
export function dayToDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function formatDay(
  day: string | null | undefined,
  style: "long" | "medium" | "short" = "medium",
) {
  if (!day) return "Date TBD";
  const d = dayToDate(day);
  const o: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : style === "medium"
        ? { month: "short", day: "numeric", year: "numeric" }
        : { month: "numeric", day: "numeric", year: "2-digit" };
  return d.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
}

/** Add days to a "YYYY-MM-DD" day. */
export function addDays(day: string, n: number) {
  const d = dayToDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today's calendar day in the studio's time zone. */
export function todayIn(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA gives YYYY-MM-DD
}

export function daysBetween(fromDay: string, toDay: string) {
  return Math.round(
    (dayToDate(toDay).getTime() - dayToDate(fromDay).getTime()) / 86_400_000,
  );
}

/** Instant → "Jun 12, 2027, 3:30 PM" in the studio time zone. */
export function formatInstant(
  d: Date | number | null | undefined,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
) {
  if (d == null) return "—";
  const date = typeof d === "number" ? new Date(d) : d;
  return date.toLocaleString("en-US", { ...opts, timeZone });
}

export function formatTime(hhmm: string) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function relativeFromNow(d: Date | number) {
  const ms = (typeof d === "number" ? d : d.getTime()) - Date.now();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(ms);
  if (abs < 3_600_000) return rtf.format(Math.round(ms / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(ms / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(ms / 86_400_000), "day");
  return rtf.format(Math.round(ms / (30 * 86_400_000)), "month");
}

export function fullName(c: { firstName: string; lastName?: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

export function coupleName(c: {
  firstName: string;
  partnerFirstName?: string | null;
}) {
  return c.partnerFirstName ? `${c.firstName} & ${c.partnerFirstName}` : c.firstName;
}
