/**
 * Money seed: starter collections + add-ons and three contract templates.
 * Prices are PLACEHOLDERS for Scarlet to set. Idempotent (fixed ids + onConflictDoNothing).
 */
import { db, schema } from "@/db";
import type { ProjectType } from "@/lib/constants";

type P = {
  id: string;
  name: string;
  projectType: ProjectType;
  priceCents: number;
  description: string;
  inclusions: string[];
  isAddon?: boolean;
  sort: number;
};

const PACKAGES: P[] = [
  /* ── weddings ── */
  {
    id: "pkg_wedding_intimate",
    name: "The Intimate",
    projectType: "wedding",
    priceCents: 3200_00,
    description: "For intimate weddings and elopements — the vows, the people and the quiet moments in between.",
    inclusions: [
      "Up to 4 hours of coverage",
      "Digital coverage with a documentary, editorial eye",
      "Online gallery of 300+ hand-edited images",
      "Sneak peeks within 7 days",
      "Personal print release",
      "Timeline planning call",
    ],
    sort: 1,
  },
  {
    id: "pkg_wedding_signature",
    name: "The Signature",
    projectType: "wedding",
    priceCents: 5400_00,
    description: "Full-story coverage from getting ready to the send-off, woven with film.",
    inclusions: [
      "Up to 8 hours of coverage",
      "Film + digital (35mm and medium format film moments)",
      "Online gallery of 600+ hand-edited images",
      "Sneak peeks within 7 days",
      "Personal print release",
      "Timeline planning + location scouting",
    ],
    sort: 2,
  },
  {
    id: "pkg_wedding_heirloom",
    name: "The Heirloom",
    projectType: "wedding",
    priceCents: 8200_00,
    description: "The complete experience — every moment of the day, on film and digital, bound into an heirloom.",
    inclusions: [
      "Full-day coverage (up to 11 hours)",
      "Film + digital throughout the day",
      "Second shooter",
      "Engagement session included",
      "10×10 heirloom album (30 pages)",
      "Online gallery of 800+ hand-edited images",
      "Sneak peeks within 72 hours",
      "Personal print release",
    ],
    sort: 3,
  },
  /* wedding add-ons */
  { id: "pkg_addon_extra_hour", name: "Additional hour of coverage", projectType: "wedding", priceCents: 400_00, isAddon: true, description: "Extend the day by one hour.", inclusions: ["One extra hour of coverage"], sort: 10 },
  { id: "pkg_addon_second_shooter", name: "Second shooter", projectType: "wedding", priceCents: 800_00, isAddon: true, description: "A second photographer for more angles and both sides of getting ready.", inclusions: ["Second photographer for up to 8 hours"], sort: 11 },
  { id: "pkg_addon_film", name: "Film add-on", projectType: "wedding", priceCents: 650_00, isAddon: true, description: "Medium-format film woven through the day.", inclusions: ["3 rolls of medium-format film", "Developing + high-resolution scans"], sort: 12 },
  { id: "pkg_addon_engagement", name: "Engagement session", projectType: "wedding", priceCents: 650_00, isAddon: true, description: "An hour together before the wedding — and a chance to get comfortable in front of the camera.", inclusions: ["1-hour session", "Online gallery of 60+ images"], sort: 13 },
  { id: "pkg_addon_album", name: "Heirloom album", projectType: "wedding", priceCents: 1200_00, isAddon: true, description: "A linen- or leather-bound 10×10 album, designed by Scarlet.", inclusions: ["10×10 album, 30 pages", "Album design + two rounds of revisions"], sort: 14 },
  { id: "pkg_addon_rush", name: "Rush gallery", projectType: "wedding", priceCents: 350_00, isAddon: true, description: "Your full gallery within 2 weeks.", inclusions: ["Full gallery delivered within 14 days"], sort: 15 },

  /* ── engagements / couples ── */
  {
    id: "pkg_engagement_classic",
    name: "The Love Story Session",
    projectType: "engagement",
    priceCents: 650_00,
    description: "An easy, unhurried hour together at one meaningful place.",
    inclusions: ["1 hour", "1 location", "Online gallery of 60+ images", "Styling guide"],
    sort: 1,
  },
  {
    id: "pkg_engagement_editorial",
    name: "The Editorial Engagement",
    projectType: "engagement",
    priceCents: 1100_00,
    description: "Film + digital, two locations and room to wander.",
    inclusions: ["2 hours", "Up to 2 locations", "Film + digital", "Online gallery of 120+ images", "Styling guide"],
    sort: 2,
  },

  /* ── seniors ── */
  {
    id: "pkg_senior_classic",
    name: "The Senior Session",
    projectType: "senior",
    priceCents: 450_00,
    description: "A relaxed session that feels like you.",
    inclusions: ["1 hour", "1 location", "2 outfits", "Online gallery of 50+ images"],
    sort: 1,
  },
  {
    id: "pkg_senior_signature",
    name: "The Senior Signature",
    projectType: "senior",
    priceCents: 750_00,
    description: "More time, more looks, film + digital.",
    inclusions: ["2 hours", "Up to 2 locations", "Unlimited outfits", "Film + digital", "Online gallery of 100+ images"],
    sort: 2,
  },

  /* ── portraits ── */
  {
    id: "pkg_portrait_session",
    name: "The Portrait Session",
    projectType: "portrait",
    priceCents: 375_00,
    description: "Portraits for families, individuals and milestones.",
    inclusions: ["45 minutes", "1 location", "Online gallery of 40+ images"],
    sort: 1,
  },

  /* ── branding ── */
  {
    id: "pkg_branding_mini",
    name: "Brand Mini",
    projectType: "branding",
    priceCents: 650_00,
    description: "Fresh headshots and a handful of lifestyle images for your website and socials.",
    inclusions: ["90 minutes", "1 location", "40+ edited images", "Brand-use license"],
    sort: 1,
  },
  {
    id: "pkg_branding_full",
    name: "Brand Story",
    projectType: "branding",
    priceCents: 1500_00,
    description: "A half-day editorial shoot built around a shot list for your brand.",
    inclusions: ["Up to 4 hours", "Up to 2 locations", "Pre-shoot strategy call + shot list", "100+ edited images", "Brand-use license"],
    sort: 2,
  },
];

const ATTORNEY = "> Have a licensed attorney in your state review this template before use.";

const COMMON_TAIL = (n: number) => `## ${n}. Limitation of liability
{{studio_name}} takes great care with your images, including duplicate memory cards and multiple backups. If images are lost, damaged or cannot be delivered for a reason within the Photographer's control, the Photographer's total liability is limited to a refund of the fees paid for the affected services, up to the total paid under this agreement. The Photographer is not liable for indirect or consequential damages.

## ${n + 1}. Force majeure
Neither party is responsible for a failure to perform caused by events beyond their reasonable control — including severe weather, fire, flood, natural disaster, epidemics or public-health orders, serious illness or injury, accidents, or government action. If the Photographer cannot attend for one of these reasons, the Photographer will try to arrange a qualified replacement; if the Client declines the replacement or none is available, all payments (including the retainer) are refunded. If the Client's event cannot go ahead for one of these reasons, the retainer may be applied once to a new date within 12 months, subject to availability.

## ${n + 2}. Entire agreement
This agreement, together with the selected collection and invoice, is the entire agreement between the parties. Changes must be agreed in writing (email is fine). If any part of this agreement is found unenforceable, the rest stays in effect.

## ${n + 3}. Governing law
This agreement is governed by the laws of the State of **[STATE]**. Any dispute will be handled in the courts of **[COUNTY]** County, **[STATE]**.

## ${n + 4}. Electronic signatures
Both parties agree that signing electronically is binding and has the same effect as a handwritten signature.`;

const WEDDING = `${ATTORNEY}

# Wedding Photography Agreement

This agreement is made on {{today}} between **{{studio_name}}**, represented by {{photographer_name}} (the "Photographer"), and **{{client_full_name}}** (the "Client") for the wedding of **{{couple_names}}**.

## 1. The wedding
- **Date:** {{event_date}}
- **Start time:** {{event_time}}
- **Venue:** {{venue}}
- **Location:** {{location}}

## 2. Services
The Photographer will provide the collection **{{package_name}}** ({{package_price}}), which includes:

{{package_inclusions}}

**Add-ons:**

{{addons}}

Any additional services must be agreed in writing (email is fine) and will be added to the invoice.

## 3. Fees & payment schedule
The total fee is **{{total}}** (subtotal {{subtotal}}, discount {{discount}}, tax {{tax}}), paid as follows:

{{payment_schedule}}

The final payment is due by **{{balance_due_date}}**. If a payment is more than 14 days late and the Client hasn't been in touch, the Photographer may treat the booking as cancelled by the Client under Section 5.

## 4. Retainer
The retainer of **{{retainer}}** reserves the wedding date — the Photographer turns away other work for it. **The retainer is non-refundable** and is credited toward the total fee.

## 5. Rescheduling & cancellation
- **Rescheduling:** The Photographer will happily try to move the booking to a new date. The retainer transfers once to a new date within 12 months, subject to availability. If the Photographer is unavailable on the new date, the change is treated as a cancellation.
- **Cancellation by the Client:** must be in writing. The retainer is non-refundable. If the Client cancels more than 90 days before the wedding, any payments beyond the retainer are refunded. If the Client cancels 90 days or less before the wedding, payments made are non-refundable because the date can no longer realistically be rebooked.
- **Cancellation by the Photographer:** if the Photographer must cancel for any reason other than Section 13, all payments — including the retainer — are refunded, and the Photographer will do their best to recommend a trusted replacement.

## 6. The day itself — timeline, meals & breaks
- Coverage begins at the agreed start time. Extra time can be added on the day at the hourly add-on rate if the Photographer is able to stay.
- The Client will share the final timeline, family photo list and a day-of contact at least 14 days before the wedding.
- For coverage of 6 hours or more, the Client will provide a hot meal for the Photographer (and any second shooter), served at the same time as guests, and a short break to eat.
- The Photographer is not responsible for missed images caused by venue or officiant restrictions, weather, lighting, guests' cameras or phones, or changes to the timeline.
- The Photographer may pause or leave coverage if subjected to harassment or unsafe conditions; no refund is owed in that case.

## 7. Travel
Travel within 50 miles of the Photographer's home base is included. Beyond that, mileage (at the current IRS rate), and lodging when the wedding ends after 10 PM or is more than 3 hours away, will be quoted in advance and added to the invoice. Destination weddings are quoted separately.

## 8. Image delivery
- Sneak peeks are delivered within 7 days of the wedding.
- The full gallery is delivered by private online gallery within 8 weeks (film scans may take up to 10 weeks).
- The Photographer selects and edits images in their signature style. Unedited/RAW files and film negatives are not delivered. Please don't apply filters or re-edit images that are shared publicly with credit.
- The gallery stays online for at least 6 months. The Client is responsible for downloading and backing up their images.

## 9. Copyright & personal-use license
The Photographer owns the copyright to all images. The Client receives a lifetime **personal-use license** to print, share and post the images (credit is always appreciated). The images may not be sold, licensed, entered into contests or used commercially without the Photographer's written permission. Vendors may request images for their own marketing with credit to the Photographer.

## 10. Portfolio use & model release
The Client allows the Photographer to use images from the wedding in the Photographer's portfolio, website, social media, publications, submissions and advertising. **Opting out:** the Client may opt out of any public use — or ask that particular images or people not be shared — by emailing {{studio_email}} at any time before the gallery is delivered. The Photographer will honor that request.

## 11. Guests & minors
The Client is responsible for letting guests know they may be photographed, and for telling the Photographer about anyone who must not appear in public images.

${COMMON_TAIL(12)}
`;

const PORTRAIT = `${ATTORNEY}

# Portrait & Session Agreement

This agreement is made on {{today}} between **{{studio_name}}**, represented by {{photographer_name}} (the "Photographer"), and **{{client_full_name}}** (the "Client").

## 1. The session
- **Session:** {{session_type}}
- **Date:** {{event_date}}
- **Start time:** {{event_time}}
- **Location:** {{location}}

## 2. Services
The Photographer will provide **{{package_name}}** ({{package_price}}), which includes:

{{package_inclusions}}

**Add-ons:**

{{addons}}

## 3. Fees & payment
The total fee is **{{total}}**, paid as follows:

{{payment_schedule}}

Any remaining balance is due by **{{balance_due_date}}**.

## 4. Retainer
The retainer of **{{retainer}}** reserves the session date and time. **The retainer is non-refundable** and is credited toward the total fee.

## 5. Rescheduling & cancellation
- The session may be rescheduled once at no charge with at least 48 hours' notice, subject to availability. Weather-related reschedules suggested by the Photographer never count against this.
- If the Client cancels, or doesn't arrive within 20 minutes of the start time without notice, the retainer is kept and any later payments are refunded.
- Arriving late shortens the session; the session will still end at the scheduled time.
- If the Photographer must cancel, the session is rescheduled at the Client's convenience or all payments are refunded.

## 6. Minors
If the person being photographed is under 18, the parent or guardian signing this agreement consents to the session and to the terms below on their behalf, and will be present or reachable during the session.

## 7. Travel
Travel within 30 miles of the Photographer's home base is included. Locations farther away may carry a travel fee, quoted in advance.

## 8. Image delivery
The online gallery is delivered within 3 weeks of the session (film scans may take up to 5 weeks). The Photographer selects and edits images in their signature style; unedited/RAW files are not delivered. The Client is responsible for downloading and backing up their images; the gallery stays online for at least 3 months.

## 9. Copyright & personal-use license
The Photographer owns the copyright to all images. The Client receives a lifetime **personal-use license** to print, share and post the images. Images may not be sold, licensed or used commercially without written permission.

## 10. Portfolio use & model release
The Client allows the Photographer to use images from the session in the Photographer's portfolio, website, social media and advertising. **Opting out:** the Client may opt out of any public use by emailing {{studio_email}} before the gallery is delivered; the Photographer will honor it. Images of minors are never shared with their full name or school details.

${COMMON_TAIL(11)}
`;

const BRAND = `${ATTORNEY}

# Brand Photography Agreement

This agreement is made on {{today}} between **{{studio_name}}**, represented by {{photographer_name}} (the "Photographer"), and **{{client_full_name}}** (the "Client"), on behalf of the Client's business.

## 1. The shoot
- **Date:** {{event_date}}
- **Start time:** {{event_time}}
- **Location:** {{location}}

## 2. Services
The Photographer will provide **{{package_name}}** ({{package_price}}), which includes:

{{package_inclusions}}

**Add-ons:**

{{addons}}

The Client will share a shot list, brand references and any products, props or team members needed at least 7 days before the shoot. Location fees, permits, models, stylists, hair and makeup are the Client's responsibility unless included above.

## 3. Fees & payment
The total fee is **{{total}}**, paid as follows:

{{payment_schedule}}

Any remaining balance is due by **{{balance_due_date}}**. Images are delivered once the balance is paid in full.

## 4. Retainer
The retainer of **{{retainer}}** reserves the date. **The retainer is non-refundable** and is credited toward the total fee.

## 5. Rescheduling & cancellation
- The shoot may be rescheduled once with at least 7 days' notice, subject to availability.
- If the Client cancels, the retainer is kept; cancellations within 7 days of the shoot owe 50% of the total fee.
- If the Photographer must cancel, the shoot is rescheduled or all payments are refunded.

## 6. Travel
Travel within 30 miles of the Photographer's home base is included. Locations farther away carry a travel fee, quoted in advance.

## 7. Image delivery
Edited images are delivered by online gallery within 3 weeks of the shoot. Unedited/RAW files are not delivered. Additional retouching beyond the Photographer's standard edit is billed at the Photographer's hourly rate.

## 8. Copyright & brand-use license
The Photographer owns the copyright to all images. Once paid in full, the Client receives a **non-exclusive, non-transferable license** to use the images to market the Client's own business — website, social media, email, print and paid ads — for as long as the business operates. The Client may not sell, sublicense or transfer the images, submit them to stock agencies, or use them in trademarks or logos. Use by third parties (publications, partners, product brands) requires the Photographer's written permission. Please credit the Photographer where practical.

## 9. Portfolio use & release
The Client allows the Photographer to use images from the shoot in the Photographer's portfolio, website, social media and advertising. **Opting out:** if images must stay private (for example, before a launch), the Client may opt out — fully or until a specific date — by emailing {{studio_email}}; the Photographer will honor it. The Client confirms that everyone photographed on the Client's behalf has agreed to be photographed for these uses.

${COMMON_TAIL(10)}
`;

const TEMPLATES = [
  { id: "ct_wedding", name: "Wedding Photography Agreement", projectType: "wedding" as const, body: WEDDING },
  { id: "ct_portrait", name: "Portrait & Session Agreement", projectType: "any" as const, body: PORTRAIT },
  { id: "ct_brand", name: "Brand Photography Agreement", projectType: "branding" as const, body: BRAND },
];

export async function seed() {
  let p = 0;
  for (const pkg of PACKAGES) {
    const r = await db
      .insert(schema.packages)
      .values({ ...pkg, isAddon: pkg.isAddon ?? false, active: true, showOnSite: !pkg.isAddon })
      .onConflictDoNothing()
      .returning({ id: schema.packages.id });
    p += r.length;
  }
  let t = 0;
  for (const tpl of TEMPLATES) {
    const r = await db
      .insert(schema.contractTemplates)
      .values(tpl)
      .onConflictDoNothing()
      .returning({ id: schema.contractTemplates.id });
    t += r.length;
  }
  return `${p}/${PACKAGES.length} packages, ${t}/${TEMPLATES.length} contract templates added`;
}
