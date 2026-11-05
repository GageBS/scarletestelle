// Studio navigation — one list drives the sidebar, the mobile drawer and the bottom bar.
export type NavItem = { href: string; label: string; icon: string; group: string; mobileBar?: boolean };

export const STUDIO_NAV: NavItem[] = [
  { href: "/studio", label: "Dashboard", icon: "home", group: "Studio", mobileBar: true },
  { href: "/studio/pipeline", label: "Pipeline", icon: "columns", group: "Studio", mobileBar: true },
  { href: "/studio/clients", label: "Clients", icon: "users", group: "Studio" },
  { href: "/studio/calendar", label: "Calendar", icon: "calendar", group: "Studio", mobileBar: true },
  { href: "/studio/tasks", label: "To-dos", icon: "check", group: "Studio", mobileBar: true },
  { href: "/studio/outbox", label: "Emails", icon: "mail", group: "Studio" },

  { href: "/studio/proposals", label: "Proposals", icon: "file", group: "Money" },
  { href: "/studio/contracts", label: "Contracts", icon: "pen", group: "Money" },
  { href: "/studio/invoices", label: "Invoices", icon: "receipt", group: "Money" },
  { href: "/studio/packages", label: "Packages & pricing", icon: "tag", group: "Money" },
  { href: "/studio/expenses", label: "Expenses", icon: "wallet", group: "Money" },
  { href: "/studio/reports", label: "Reports", icon: "chart", group: "Money" },

  { href: "/studio/scheduler", label: "Scheduler", icon: "clock", group: "Workflow" },
  { href: "/studio/questionnaires", label: "Questionnaires", icon: "list", group: "Workflow" },
  { href: "/studio/templates", label: "Email templates", icon: "template", group: "Workflow" },
  { href: "/studio/automations", label: "Automations", icon: "bolt", group: "Workflow" },

  { href: "/studio/portfolio", label: "Portfolio", icon: "image", group: "Website" },
  { href: "/studio/reviews", label: "Reviews", icon: "star", group: "Website" },
  { href: "/studio/settings", label: "Settings", icon: "gear", group: "Website" },
];
