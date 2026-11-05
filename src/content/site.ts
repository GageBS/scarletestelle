/**
 * ALL public-site wording lives here — edit freely.
 * Lines marked DRAFT are placeholder copy for Scarlet to rewrite in her own voice.
 */

export const brand = {
  name: "Scarlet Estelle",
  legalName: "Scarlet Estelle Photography",
  photographer: "Scarlet Summers",
  tagline: "Film & Digital Photography",
  description:
    "Luxury wedding, engagement, couples, senior, portrait and branding photography on film and digital — documenting moments as they naturally unfold.",
  instagram: "scarletestelle",
  email: "", // shown in the footer when filled in
  serving: "Available for travel", // DRAFT e.g. "Based in Phoenix · traveling everywhere"
  established: "", // e.g. "2021" — shown as "Est. 2021" when filled in
};

export const nav = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/approach", label: "Approach" },
  { href: "/experience", label: "Experience" },
  { href: "/kind-words", label: "Kind Words" },
  { href: "/about", label: "About" },
];

/** The approach statement — Scarlet's own words. */
export const approachQuote =
  "My approach to photography is rooted in documenting moments as they naturally unfold while offering gentle direction when needed. I want my clients to feel comfortable enough to be themselves in front of my camera, allowing me to capture the genuine emotions, in-between moments, and little details that make their story uniquely theirs.";

export const home = {
  heroKicker: "Film & Digital",
  heroServices: "weddings · couples · seniors · portraits · branding",
  welcomeScript: "Welcome",
  welcomeLead: "Timeless images of the moments you were too busy living to notice.", // DRAFT
  welcomeBody: [
    // DRAFT
    "A gallery should read like the pages of a well-loved book — every image a sentence, each one giving meaning to the one before and the one after. The quiet moments, the loud ones, and every glance in-between.",
    "I photograph on both film and digital, with a documentary eye and an editorial soul — so your images feel honest, artful, and entirely yours.",
  ],
  servicesTitle: "What I photograph",
  approachScript: "I vow to be present & intentional.",
  ctaScript: "Let's create something timeless",
  ctaLine: "It would be an honor to tell your story.",
};

export const approachPage = {
  intro: "Capturing your story is not something I take for granted.", // DRAFT
  vowLead: "Therefore,",
  vowScript: "I vow to be present & intentional.",
  body: [approachQuote],
  closing: "Looking forward to creating with you!",
  filmDigital: {
    script: "Film & Digital",
    lead:
      // DRAFT
      "I shoot both — and I love weaving them together. Film gives your images a softness, grain and color that simply can't be replicated. Digital gives you range, speed and full coverage of every moment. Together, they tell your story completely.",
    film: {
      title: "On Film",
      points: [
        "Soft, natural skin tones and that dreamy, timeless glow",
        "Real grain and color — no filter can fake it",
        "Slower and more intentional; every frame is considered",
        "Shines in natural light — portraits, details, golden hour",
        "Developed and scanned by a professional film lab",
      ],
    },
    digital: {
      title: "On Digital",
      points: [
        "Complete coverage — nothing important is missed",
        "Fearless in low light: receptions, dancing, indoor venues",
        "Fast-moving moments: the kiss, the toss, the exit",
        "Hundreds of images to tell the full story",
        "Edited by hand to sit beautifully beside the film images",
      ],
    },
    both: {
      title: "My approach: both",
      body:
        // DRAFT
        "Digital is the backbone of your gallery — it documents everything as it unfolds. Film is woven in for the portraits, details and the quiet in-between, adding a timeless layer only film can give. Your gallery arrives as one seamless story, with film images marked so you can see the difference.",
    },
  },
  tailored: {
    title: "A day fully tailored to you",
    script: "& nothing less",
    body: [
      // DRAFT
      "Every session is fully customized. Once you book, we'll plan together — timeline, locations, the details that matter most to you, and exactly what to wear and bring.",
      "Ongoing communication means you'll always know what's next, and on the day itself you can simply be present.",
    ],
  },
  steps: [
    // DRAFT
    { n: "01", title: "Inquire", body: "Tell me about you and what you're dreaming of." },
    { n: "02", title: "Connect", body: "A relaxed call to get to know each other and talk through the details." },
    { n: "03", title: "Book", body: "Choose your collection, sign your contract, and secure your date — all online." },
    { n: "04", title: "Plan", body: "A planning questionnaire, timeline help, and location and outfit guidance." },
    { n: "05", title: "Create", body: "The fun part. Gentle direction, lots of laughter, and room to just be you." },
    { n: "06", title: "Receive", body: "Your hand-edited gallery, delivered in a private online gallery to download, share and print." },
  ],
  craft: {
    script: "Obsessed with the craft",
    line: "Collections are fully custom — see the Experience page for starting prices.", // DRAFT
  },
};

export const aboutPage = {
  script: "Behind the lens",
  hello: "Hi, I'm Scarlet",
  kicker: "A storyteller with a camera in each hand", // DRAFT
  body: [
    // DRAFT — replace with Scarlet's story
    "I'm the photographer behind Scarlet Estelle — a lover of old film cameras, golden light, and the little in-between moments most people miss.",
    "I photograph weddings, couples, seniors, portraits and brands, on film and digital. Whatever we're creating, my goal is the same: that you feel comfortable enough to be completely yourself, and that your photos feel like you.",
    "When I'm not behind the camera you can find me … (tell your story here — favorite coffee order, the film stock you can't live without, where you'd love to travel next).",
  ],
  favorites: [
    // DRAFT
    { k: "Favorite film stock", v: "Kodak Portra 400" },
    { k: "Always in my bag", v: "Two cameras, extra film, and a lip balm for you" },
    { k: "Dream session", v: "Golden hour somewhere wild" },
  ],
};

export const experiencePage = {
  script: "The Experience",
  lead:
    // DRAFT
    "Luxury isn't just beautiful images — it's how you feel from the first email to the moment your gallery arrives.",
  included: [
    // DRAFT
    "A personal planning call and custom timeline help",
    "Location scouting and styling guidance",
    "Gentle direction with room to be yourselves",
    "A blend of film and digital (by collection)",
    "Every image culled and edited by hand",
    "A private online gallery to download, share and order prints",
  ],
  note: "Every collection can be tailored. Inquire for a full price guide.", // DRAFT
};

export const portfolioIntro = {
  script: "The Archives",
  line: "A curated selection of stories told through my lens",
};

export const kindWordsPage = {
  script: "Kind Words",
  line: "From the people who trusted me with their stories",
};

export const inquirePage = {
  script: "Let's work together",
  line: "Tell me everything — I can't wait to hear from you.",
  responseTime: "I reply to every inquiry personally within 48 hours.", // DRAFT
  thanksScript: "Thank you",
  thanksLine: "Your inquiry is in my inbox. I'll be in touch very soon.",
};
