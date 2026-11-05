/**
 * Comms seed: meeting types, email templates (in Scarlet's voice), questionnaire templates and the
 * default automations. Fixed ids + onConflictDoNothing → safe to re-run, never overwrites edits.
 */
import { db, schema } from "@/db";
import type { AutomationAction, AutomationTrigger, ProjectType, QField, Stage } from "@/lib/constants";

const MEETING_TYPES = [
  {
    id: "mt_consultation",
    slug: "consultation",
    name: "Consultation call",
    description:
      "A relaxed, no-pressure chat about your vision, your date and what you're hoping your photographs will feel like.",
    durationMin: 20,
    location: "video" as const,
    sort: 1,
  },
  {
    id: "mt_wedding_planning",
    slug: "wedding-planning",
    name: "Wedding planning call",
    description:
      "For booked couples: we'll walk through your timeline, family photographs, locations and every detail that matters to you.",
    durationMin: 45,
    location: "video" as const,
    sort: 2,
  },
  {
    id: "mt_branding_discovery",
    slug: "branding-discovery",
    name: "Branding discovery call",
    description:
      "Tell me about your business, the people you serve and where your imagery will live. We'll shape a session around your brand.",
    durationMin: 30,
    location: "phone" as const,
    sort: 3,
  },
];

const SIGN = "With love,\n{{photographer_name}}";

const EMAIL_TEMPLATES = [
  {
    id: "et_inquiry_auto_reply",
    name: "Inquiry auto-reply",
    subject: "Thank you, {{client_first_name}} — I'd love to hear more",
    body: `Hi {{client_first_name}},

Thank you so much for reaching out. I read every inquiry myself, and yours made my day.

I'll look over everything you shared and write back personally within a day or two. In the meantime, if you'd like to talk it through, I'd love to meet you. You can choose a time that suits you here, no pressure at all:

{{booking_link}}

A call is a lovely way to hear your story, answer questions and see whether we're a good fit. I can't wait to get to know you.

${SIGN}`,
  },
  {
    id: "et_proposal_followup",
    name: "Proposal follow-up",
    subject: "Checking in on your proposal, {{client_first_name}}",
    body: `Hi {{client_first_name}},

I wanted to gently check in on the proposal I sent over. I know there's a lot to think about, and there's no rush at all, but I'd hate for it to get lost in your inbox.

You can look it over, choose your collection and sign whenever you're ready:

{{portal_link}}

If anything feels unclear, or you'd like to adjust something to suit you better, just reply here or book a quick call at {{booking_link}}. I'm happy to help.

${SIGN}`,
  },
  {
    id: "et_booking_welcome",
    name: "Booking confirmation & welcome",
    subject: "You're officially booked, {{client_first_name}}!",
    body: `Dear {{couple_names}},

It's official, and I am so happy. Thank you for trusting me with this. I'm honored to be the one to photograph {{event_date}}.

Here is what happens next:

- Your client portal is where everything lives: your contract, invoices, questionnaires and messages. Bookmark it: {{portal_link}}
- I'll send a short questionnaire so I can learn the little details that make your story yours.
- As your date gets closer, I'll be in touch with a timeline and everything you need to feel ready.

If a question comes up at any point, big or small, just reply to this email. It's my favorite part of the job.

${SIGN}`,
  },
  {
    id: "et_questionnaire_invite",
    name: "Questionnaire invitation",
    subject: "A few questions to make this day yours — {{questionnaire_title}}",
    body: `Hi {{client_first_name}},

So I can plan every detail with you, I've put together a short questionnaire. Take your time, and answer as much or as little as you like. It saves as you go, so you can come back to it whenever you have a quiet moment.

{{questionnaire_link}}

The more I know about you, the more your photographs will feel like you.

${SIGN}`,
  },
  {
    id: "et_session_prep",
    name: "Session prep guide",
    subject: "Getting ready for your session on {{event_date}}",
    body: `Hi {{client_first_name}},

Your session is almost here, and I'm so excited! A few things to help you feel completely at ease.

**When & where**
{{event_date}} at {{event_time}}
{{location}} {{venue}}

**What to wear**
- Choose outfits you feel like yourself in, since comfort always shows in photographs.
- Soft, solid colors and timeless textures photograph beautifully. Try to avoid large logos and very busy patterns.
- Bring a second outfit if you'd like variety. Layers, a jacket or a pretty accessory change a look in seconds.
- Think about the setting: flowing fabrics love open spaces, and structured pieces suit city streets.

**How we'll spend our time**
We'll start with a few relaxed moments to settle in, then move through our locations at an easy pace. There's no need to know how to pose. I'll guide you gently the whole way, and the best moments usually happen in between.

**A few small things**
- Eat something light beforehand and bring water.
- Arrive a few minutes early so we're not rushed.
- Check the weather the day before. If we need to adjust, I'll let you know.

If anything changes, just reply here. See you very soon!

${SIGN}`,
  },
  {
    id: "et_payment_reminder",
    name: "Payment reminder",
    subject: "A gentle reminder: your {{payment_label}} is due {{payment_due_date}}",
    body: `Hi {{client_first_name}},

A friendly note that your {{payment_label}} of {{payment_amount}} is due on {{payment_due_date}}.

You can see the details and pay securely here:

{{invoice_link}}

If you've already taken care of it, thank you, and please ignore this message. And if you need a little flexibility or have any questions about your invoice, just reply and we'll sort it out together.

${SIGN}`,
  },
  {
    id: "et_thank_you",
    name: "Thank-you after the session",
    subject: "Thank you, {{client_first_name}}",
    body: `Hi {{client_first_name}},

I'm still smiling from our time together. Thank you for trusting me with such a special day, and for being so wonderful to photograph.

I'm now beginning the careful part, going through every frame and shaping them into a story that feels like you. I'll let you know as soon as your gallery is ready, and I can't wait for you to see it.

If you ever want to share a favorite moment from the day, or just say hello, my inbox is always open.

${SIGN}`,
  },
  {
    id: "et_gallery_delivered",
    name: "Gallery delivered",
    subject: "Your gallery is ready, {{client_first_name}}",
    body: `Dear {{client_first_name}},

Your photographs are finished, and I'm so proud of them. I hope they feel just the way the day did.

You can view and download your gallery here:

{{gallery_link}}

My suggestion: make a cup of tea, settle in somewhere quiet and take your time with them. Then print your favorites! Photographs are meant to be held, and I'm happy to point you toward beautiful printing options.

Thank you again for letting me be part of your story.

${SIGN}`,
  },
  {
    id: "et_review_request",
    name: "Review request",
    subject: "Would you share a few words, {{client_first_name}}?",
    body: `Hi {{client_first_name}},

I hope you're still enjoying your photographs! I'm so grateful to have been part of your story.

As a small, independent studio, kind words from clients mean the world to me and help other couples and families find me. If you have a couple of minutes, I'd be so thankful if you'd share how your experience felt:

{{review_link}}

Whatever you write, thank you, truly.

${SIGN}`,
  },
  {
    id: "et_anniversary",
    name: "Anniversary note",
    subject: "Thinking of you today, {{client_first_name}}",
    body: `Hi {{client_first_name}},

I was thinking of you today and wanted to send a little note. It's been a year since I had the joy of photographing {{event_date}}, and I still remember it so fondly.

I hope this year has been kind to you. If you'd like to celebrate with an anniversary session, or simply print a favorite photograph for your wall, I'd love to help. And if you ever need anything, you know where to find me.

${SIGN}`,
  },
];

/* ───────────── questionnaires ───────────── */
const f = (id: string, label: string, type: QField["type"], extra: Partial<QField> = {}): QField => ({
  id,
  label,
  type,
  ...extra,
});

const WEDDING_FIELDS: QField[] = [
  f("h_day", "The day at a glance", "heading"),
  f("ceremony_time", "What time does your ceremony start?", "time", { required: true }),
  f("getting_ready", "Where will each of you get ready?", "textarea", {
    required: true,
    help: "Names and addresses of each location, and the time you'd like me to arrive at each.",
  }),
  f("first_look", "Are you planning a first look?", "select", {
    options: ["Yes", "No", "Not sure yet, I'd love your advice"],
  }),
  f("timeline", "Your timeline so far", "textarea", {
    help: "Paste or type what you have: ceremony, cocktail hour, dinner, toasts, first dance, send-off, and so on. Rough is perfectly fine.",
  }),
  f("h_family", "Family photographs", "heading"),
  f("family_formals", "Family formal groupings you'd like", "textarea", {
    required: true,
    help: "One grouping per line, e.g. “Bride + both parents”, “Groom's side, all siblings”, “Grandparents with both of us”.",
  }),
  f("family_notes", "Anything I should know about family dynamics?", "textarea", {
    help: "Divorced parents, family members who aren't speaking, someone who needs extra care. It stays between us.",
  }),
  f("h_vips", "The people who matter most", "heading"),
  f("vips", "VIPs I should know about", "textarea", {
    help: "Grandparents, best friends, anyone you'd love to have special attention.",
  }),
  f("remembered", "Is there someone you'd like to honor or remember on the day?", "textarea"),
  f("h_vendors", "Your team", "heading"),
  f("vendors", "Your vendors and contacts", "textarea", {
    help: "Planner, venue coordinator, florist, hair & makeup, videographer, DJ or band, officiant. Names and phone numbers if you have them.",
  }),
  f("h_moments", "Moments & details", "heading"),
  f("must_have", "Your must-have moments", "textarea", {
    required: true,
    help: "The things you'd be heartbroken to miss: a tearful grandparent, a private moment, a family tradition.",
  }),
  f("details", "Details you'd like photographed", "checkboxes", {
    options: [
      "Rings",
      "Invitation suite",
      "Dress & veil",
      "Shoes",
      "Jewelry",
      "Florals & bouquet",
      "Stationery & signage",
      "Cake & desserts",
      "Table settings",
      "Heirlooms or something borrowed",
    ],
  }),
  f("h_film", "Film & style", "heading"),
  f("film_pref", "How would you like me to shoot your day?", "select", {
    options: ["Mostly film", "A mix of film and digital", "Mostly digital", "I trust your instincts"],
  }),
  f("film_moments", "Moments you'd especially love on film", "checkboxes", {
    options: [
      "Getting ready",
      "Portraits of the two of us",
      "Ceremony",
      "Family formals",
      "Candid guests",
      "Reception & dancing",
      "Details",
    ],
  }),
  f("inspiration", "Inspiration", "textarea", {
    help: "Links to a Pinterest board, favorite photographs, or a few words about how you want your photographs to feel.",
  }),
  f("anything_else", "Anything else you'd like me to know?", "textarea"),
];

const SENIOR_FIELDS: QField[] = [
  f("h_you", "About you", "heading"),
  f("school", "Your school and graduation year", "text", { required: true }),
  f("interests", "What do you love? Hobbies, sports, music, clubs", "textarea", { required: true }),
  f("personality", "Three words your best friend would use to describe you", "text"),
  f("h_session", "Your session", "heading"),
  f("outfits", "How many outfits would you like to bring?", "select", { options: ["2", "3", "4", "More than 4"] }),
  f("outfit_vibes", "The outfit vibes you're drawn to", "checkboxes", {
    options: ["Classic & timeless", "Casual & comfy", "Dressy / formal", "Trendy", "Letterman or team gear", "Cap & gown"],
  }),
  f("locations", "Places that mean something to you", "textarea", {
    help: "A favorite park, your school, a downtown street, a field near home.",
  }),
  f("props", "Anything you'd like to bring?", "textarea", {
    help: "An instrument, a car, a pet, sports gear, a favorite book.",
  }),
  f("hair_makeup", "Will you have hair & makeup done?", "select", {
    options: ["Yes, professionally", "I'll do it myself", "Not sure yet"],
  }),
  f("h_comfort", "Feeling comfortable", "heading"),
  f("nervous", "Is there anything that makes you nervous about being photographed?", "textarea"),
  f("parents", "Would you like a parent or friend with you?", "select", {
    options: ["Yes", "No, just me", "Whichever you suggest"],
  }),
  f("favorites", "Photographs you've loved", "textarea", { help: "Links or a few words about what you liked in them." }),
  f("anything_else", "Anything else I should know?", "textarea"),
];

const ENGAGEMENT_FIELDS: QField[] = [
  f("h_story", "Your story", "heading"),
  f("how_met", "How did you meet?", "textarea", { required: true }),
  f("proposal", "How did the proposal happen?", "textarea"),
  f("together", "What do you love doing together?", "textarea", { required: true }),
  f("h_session", "Your session", "heading"),
  f("locations", "Places that feel like “you”", "textarea", {
    help: "Where you had your first date, a favorite trail, your home, a spot in the city.",
  }),
  f("time_of_day", "Preferred time of day", "select", {
    options: ["Golden hour / sunset", "Morning light", "Midday, whatever works", "I trust your advice"],
  }),
  f("outfit_vibes", "The mood you're picturing", "checkboxes", {
    options: ["Romantic & soft", "Editorial & polished", "Casual & playful", "Adventurous", "Classic & timeless"],
  }),
  f("comfort", "How comfortable are you in front of a camera?", "select", {
    options: ["Totally fine", "A bit shy", "Honestly a little nervous"],
  }),
  f("pets_kids", "Anyone else joining? Pets, family, a dog we must meet", "text"),
  f("h_use", "Using your photographs", "heading"),
  f("use", "What will you use them for?", "checkboxes", {
    options: ["Save the dates", "Wedding website", "Invitations", "Prints for our home", "Social media", "Just for us"],
  }),
  f("anything_else", "Anything else I should know?", "textarea"),
];

const BRANDING_FIELDS: QField[] = [
  f("h_brand", "Your brand", "heading"),
  f("business", "Business name and website or Instagram", "text", { required: true }),
  f("what", "What do you do, in a sentence or two?", "textarea", { required: true }),
  f("client", "Who is your ideal client?", "textarea", { required: true }),
  f("words", "Three words you want your brand to feel like", "text", { required: true }),
  f("colors", "Brand colors, fonts or a brand guide link", "text"),
  f("h_images", "The images you need", "heading"),
  f("need", "What kinds of photographs would you like?", "checkboxes", {
    options: [
      "Headshots / portraits",
      "Behind-the-scenes",
      "Lifestyle & in-action",
      "Product or work details",
      "Website hero images",
      "Social media content",
      "Team photos",
    ],
  }),
  f("where", "Where will the images be used?", "textarea", {
    help: "Website, Instagram, print, press, packaging, and so on.",
  }),
  f("h_logistics", "Logistics", "heading"),
  f("location", "Where should we shoot?", "textarea", {
    help: "Your studio, shop, home, an outdoor setting. Share the address if you know it.",
  }),
  f("references", "Mood references", "textarea", { help: "Links to brands, images or accounts whose look you admire." }),
  f("deadline", "Do you have a deadline?", "date"),
  f("anything_else", "Anything else I should know?", "textarea"),
];

const Q_TEMPLATES: {
  id: string;
  name: string;
  projectType: ProjectType | "any";
  intro: string;
  fields: QField[];
}[] = [
  {
    id: "qt_wedding",
    name: "Wedding day questionnaire",
    projectType: "wedding",
    intro:
      "Congratulations again! These questions help me understand your day, the people in it and what matters most to you. Answer what you can now. It saves as you go, and we can fill in the rest together.",
    fields: WEDDING_FIELDS,
  },
  {
    id: "qt_senior",
    name: "Senior session questionnaire",
    projectType: "senior",
    intro: "I want your photographs to feel like you. A little about who you are will help me plan a session you'll love.",
    fields: SENIOR_FIELDS,
  },
  {
    id: "qt_engagement",
    name: "Engagement session questionnaire",
    projectType: "engagement",
    intro: "Tell me your story. The more I know about the two of you, the more your session will feel like you.",
    fields: ENGAGEMENT_FIELDS,
  },
  {
    id: "qt_branding",
    name: "Branding brief",
    projectType: "branding",
    intro: "Let's make imagery that looks and feels like your business. This brief helps me plan a session around your brand.",
    fields: BRANDING_FIELDS,
  },
];

/* ───────────── automations ───────────── */
type Auto = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  offsetDays?: number;
  projectTypes?: ProjectType[];
  action: AutomationAction;
  emailTemplateId?: string;
  questionnaireTemplateId?: string;
  taskTitle?: string;
  stage?: Stage;
};

const NON_WEDDING: ProjectType[] = ["engagement", "couples", "senior", "branding", "portrait", "other"];

const AUTOMATIONS: Auto[] = [
  { id: "auto_inquiry_reply", name: "Inquiry auto-reply", trigger: "inquiry_received", action: "send_email", emailTemplateId: "et_inquiry_auto_reply" },
  { id: "auto_proposal_followup", name: "Proposal follow-up, 3 days after sending", trigger: "proposal_unaccepted", offsetDays: 3, action: "send_email", emailTemplateId: "et_proposal_followup" },
  { id: "auto_booking_welcome", name: "Booking confirmation & welcome", trigger: "stage_changed", stage: "booked", action: "send_email", emailTemplateId: "et_booking_welcome" },
  { id: "auto_q_wedding", name: "Send wedding questionnaire when booked", trigger: "stage_changed", stage: "booked", projectTypes: ["wedding", "elopement"], action: "send_questionnaire", questionnaireTemplateId: "qt_wedding", emailTemplateId: "et_questionnaire_invite" },
  { id: "auto_q_engagement", name: "Send engagement questionnaire when booked", trigger: "stage_changed", stage: "booked", projectTypes: ["engagement", "couples"], action: "send_questionnaire", questionnaireTemplateId: "qt_engagement", emailTemplateId: "et_questionnaire_invite" },
  { id: "auto_q_senior", name: "Send senior questionnaire when booked", trigger: "stage_changed", stage: "booked", projectTypes: ["senior", "portrait"], action: "send_questionnaire", questionnaireTemplateId: "qt_senior", emailTemplateId: "et_questionnaire_invite" },
  { id: "auto_q_branding", name: "Send branding brief when booked", trigger: "stage_changed", stage: "booked", projectTypes: ["branding"], action: "send_questionnaire", questionnaireTemplateId: "qt_branding", emailTemplateId: "et_questionnaire_invite" },
  { id: "auto_session_prep", name: "Session prep guide, 7 days before", trigger: "before_event", offsetDays: 7, projectTypes: NON_WEDDING, action: "send_email", emailTemplateId: "et_session_prep" },
  { id: "auto_wedding_timeline", name: "Wedding timeline to-do, 30 days before", trigger: "before_event", offsetDays: 30, projectTypes: ["wedding", "elopement"], action: "create_task", taskTitle: "Finalize timeline with {{couple_names}}" },
  { id: "auto_payment_reminder", name: "Payment reminder, 3 days before due", trigger: "installment_due", offsetDays: 3, action: "send_email", emailTemplateId: "et_payment_reminder" },
  { id: "auto_thank_you", name: "Thank-you, 1 day after the session", trigger: "after_event", offsetDays: 1, action: "send_email", emailTemplateId: "et_thank_you" },
  { id: "auto_review_request", name: "Review request, 14 days after delivery", trigger: "after_delivery", offsetDays: 14, action: "send_email", emailTemplateId: "et_review_request" },
];

export async function seed(): Promise<string> {
  for (const m of MEETING_TYPES) await db.insert(schema.meetingTypes).values(m).onConflictDoNothing();
  for (const t of EMAIL_TEMPLATES) await db.insert(schema.emailTemplates).values(t).onConflictDoNothing();
  for (const q of Q_TEMPLATES) await db.insert(schema.questionnaireTemplates).values(q).onConflictDoNothing();
  for (const a of AUTOMATIONS)
    await db
      .insert(schema.automations)
      .values({
        id: a.id,
        name: a.name,
        trigger: a.trigger,
        offsetDays: a.offsetDays ?? 0,
        projectTypes: a.projectTypes ?? [],
        action: a.action,
        emailTemplateId: a.emailTemplateId ?? null,
        questionnaireTemplateId: a.questionnaireTemplateId ?? null,
        taskTitle: a.taskTitle ?? null,
        stage: a.stage ?? null,
        active: true,
      })
      .onConflictDoNothing();
  return `${MEETING_TYPES.length} meeting types, ${EMAIL_TEMPLATES.length} email templates, ${Q_TEMPLATES.length} questionnaires, ${AUTOMATIONS.length} automations`;
}
