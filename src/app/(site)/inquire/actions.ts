"use server";
import { createInquiry, inquirySchema } from "@/lib/inquiries";

export type InquiryState =
  | { status: "idle" }
  | { status: "ok"; firstName: string }
  | { status: "error"; message: string; fields?: Record<string, string> };

const EXTRA_KEYS: Record<string, string> = {
  school: "School",
  gradYear: "Graduation year",
  businessName: "Business",
  website: "Website / Instagram",
  imageUse: "Images will be used for",
  coverage: "Coverage wanted",
};

export async function submitInquiry(_prev: InquiryState, fd: FormData): Promise<InquiryState> {
  // spam guards: hidden honeypot + a human takes more than 3s to fill this in
  if (String(fd.get("company_url") ?? "").trim() !== "") return { status: "ok", firstName: "" };
  const started = Number(fd.get("started_at") ?? 0);
  if (started && Date.now() - started < 3000) {
    return { status: "error", message: "That was fast! Please take a moment and try again." };
  }

  const extras: Record<string, string> = {};
  for (const [k, label] of Object.entries(EXTRA_KEYS)) {
    const v = String(fd.get(k) ?? "").trim();
    if (v) extras[label] = v;
  }
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const parsed = inquirySchema.safeParse({
    type: g("type"),
    firstName: g("firstName"),
    lastName: g("lastName"),
    email: g("email"),
    phone: g("phone"),
    instagram: g("instagram"),
    partnerFirstName: g("partnerFirstName"),
    partnerLastName: g("partnerLastName"),
    eventDate: g("eventDate"),
    eventDateNote: g("eventDateNote"),
    location: g("location"),
    venue: g("venue"),
    guestCount: g("guestCount"),
    budget: g("budget"),
    source: g("source"),
    extras,
    story: g("story"),
    why: g("why"),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fields[key]) fields[key] = issue.message;
    }
    return { status: "error", message: "A couple of details need another look.", fields };
  }
  try {
    await createInquiry(parsed.data);
  } catch (e) {
    console.error("[inquiry] failed", e);
    return {
      status: "error",
      message:
        "Something went wrong sending your inquiry. Please try again, or message me on Instagram so it doesn't get lost.",
    };
  }
  return { status: "ok", firstName: parsed.data.firstName };
}
