import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { coupleName, formatDay, formatTime, money, todayIn } from "@/lib/format";
import { projectTypeLabel } from "@/lib/constants";
import { invoiceProgress } from "@/lib/billing-math";
import {
  DocLink,
  Flourish,
  Pill,
  PortalCard,
  PortalHeading,
  PortalLink,
  PortalSection,
} from "@/components/money/portal-ui";
import { getPortalProject } from "./portal-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your client portal" };

export default async function PortalHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPortalProject(token);
  if (!portal) notFound();
  const { project, contact } = portal;
  const s = await getSettings();
  const today = todayIn(s.business.timezone);
  const base = `/c/${token}`;

  const [proposals, contracts, invoices, questionnaires] = await Promise.all([
    db.query.proposals.findMany({
      where: eq(schema.proposals.projectId, project.id),
      orderBy: desc(schema.proposals.createdAt),
    }),
    db.query.contracts.findMany({
      where: eq(schema.contracts.projectId, project.id),
      orderBy: desc(schema.contracts.createdAt),
    }),
    db.query.invoices.findMany({
      where: eq(schema.invoices.projectId, project.id),
      orderBy: desc(schema.invoices.createdAt),
    }),
    db.query.questionnaires.findMany({
      where: eq(schema.questionnaires.projectId, project.id),
      orderBy: desc(schema.questionnaires.createdAt),
    }),
  ]);
  const visibleInvoices = invoices.filter((i) => ["sent", "partial", "paid"].includes(i.status));
  const inst = visibleInvoices.length
    ? await db.query.installments.findMany({
        where: inArray(
          schema.installments.invoiceId,
          visibleInvoices.map((i) => i.id),
        ),
      })
    : [];
  const invRows = visibleInvoices.map((inv) => {
    const rows = inst.filter((i) => i.invoiceId === inv.id);
    return { inv, prog: invoiceProgress(inv, rows, today) };
  });
  const visibleProposals = proposals.filter((p) => ["sent", "viewed", "accepted"].includes(p.status));
  const openProposal = visibleProposals.find(
    (p) => p.status !== "accepted" && !(p.expiresOn && p.expiresOn < today),
  );
  const visibleContracts = contracts.filter((c) => c.status === "signed" || c.status === "countersigned");
  const visibleQs = questionnaires.filter((q) => q.status === "sent" || q.status === "submitted");
  const openQ = visibleQs.find((q) => q.status === "sent");
  const nextPay = invRows
    .filter((r) => r.prog.next)
    .sort((a, b) => a.prog.next!.dueDate.localeCompare(b.prog.next!.dueDate))[0];
  const reviewOpen = project.stage === "delivered" || project.stage === "completed";

  const names = contact ? coupleName(contact) : project.title;
  const when = project.eventDate ? formatDay(project.eventDate, "long") : project.eventDateNote || "Date to be decided";
  const where = [project.venue, project.location].filter(Boolean).join(" · ");

  // the one thing the client should do next
  let next: { text: string; href: string; cta: string; external?: boolean } | null = null;
  if (openProposal)
    next = {
      text: "Your proposal is ready. Choose your collection, sign your agreement and reserve your date.",
      href: `${base}/proposal/${openProposal.token}`,
      cta: "Review your proposal",
    };
  else if (nextPay?.prog.next)
    next = {
      text: `${nextPay.prog.next.label} of ${money(nextPay.prog.next.amountCents)} is ${
        nextPay.prog.next.dueDate < today
          ? `past due (was due ${formatDay(nextPay.prog.next.dueDate, "long")})`
          : nextPay.prog.next.dueDate === today
            ? "due today"
            : `due ${formatDay(nextPay.prog.next.dueDate, "long")}`
      }.`,
      href: `${base}/invoice/${nextPay.inv.token}`,
      cta: "View & pay",
    };
  else if (openQ)
    next = {
      text: "A few questions so every detail is planned just right.",
      href: `${base}/questionnaire/${openQ.token}`,
      cta: "Fill out questionnaire",
    };
  else if (project.galleryUrl && (project.stage === "delivered" || project.stage === "completed"))
    next = { text: "Your gallery is ready to view.", href: project.galleryUrl, cta: "Open your gallery", external: true };

  return (
    <div>
      <PortalHeading script="Welcome" title={names}>
        <p className="font-sans text-[0.78rem] uppercase tracking-[0.22em] text-ink-soft">
          {projectTypeLabel(project.type)} · {when}
          {project.startTime ? ` · ${formatTime(project.startTime)}` : ""}
        </p>
        {where && <p className="mt-1 italic">{where}</p>}
      </PortalHeading>

      <Flourish className="mt-10" />

      <PortalSection title="Your next step">
        <PortalCard className="text-center">
          {next ? (
            <>
              <p className="mx-auto max-w-md text-[1.15rem] leading-relaxed">{next.text}</p>
              <div className="mt-6">
                {next.external ? (
                  <a href={next.href} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-[2px] bg-ink px-7 font-sans text-[0.72rem] uppercase tracking-[0.24em] text-cream transition hover:bg-wine">
                    {next.cta}
                  </a>
                ) : (
                  <PortalLink href={next.href} prefetch={false}>
                    {next.cta}
                  </PortalLink>
                )}
              </div>
            </>
          ) : (
            <p className="mx-auto max-w-md text-[1.15rem] leading-relaxed">
              You&apos;re all set for now — {s.business.photographer.split(" ")[0]} will be in touch as
              your date gets closer.
            </p>
          )}
        </PortalCard>
      </PortalSection>

      <PortalSection title="Your documents">
        <div className="flex flex-col gap-3">
          {visibleProposals.map((p) => {
            const expired = p.status !== "accepted" && p.expiresOn && p.expiresOn < today;
            return (
              <DocLink
                key={p.id}
                href={`${base}/proposal/${p.token}`}
                kicker="Proposal"
                title={p.title}
                meta={
                  p.status === "accepted"
                    ? "Signed — thank you"
                    : p.expiresOn
                      ? `${expired ? "Expired" : "Available until"} ${formatDay(p.expiresOn, "medium")}`
                      : "Ready to review"
                }
                status={
                  p.status === "accepted" ? (
                    <Pill tone="moss">Accepted</Pill>
                  ) : expired ? (
                    <Pill>Expired</Pill>
                  ) : (
                    <Pill tone="scarlet">To review</Pill>
                  )
                }
                cta={p.status === "accepted" ? "View" : "Review"}
              />
            );
          })}
          {visibleContracts.map((c) => (
            <DocLink
              key={c.id}
              href={`${base}/contract/${c.token}`}
              kicker="Agreement"
              title={c.title}
              meta={
                c.clientSignedAt
                  ? `Signed ${formatDay(todayIn(s.business.timezone, c.clientSignedAt), "medium")}`
                  : undefined
              }
              status={<Pill tone="moss">{c.status === "countersigned" ? "Fully signed" : "Signed"}</Pill>}
              cta="View copy"
            />
          ))}
          {invRows.map(({ inv, prog }) => (
            <DocLink
              key={inv.id}
              href={`${base}/invoice/${inv.token}`}
              kicker={`Invoice ${inv.number}`}
              title={inv.title}
              meta={
                inv.status === "paid"
                  ? `Paid in full · ${money(inv.totalCents)}`
                  : `${money(prog.paidCents)} paid · ${money(prog.remainingCents)} remaining`
              }
              status={
                inv.status === "paid" ? (
                  <Pill tone="moss">Paid</Pill>
                ) : prog.overdue ? (
                  <Pill tone="scarlet">Past due</Pill>
                ) : (
                  <Pill tone="ink">{prog.next ? `Next ${formatDay(prog.next.dueDate, "short")}` : "Open"}</Pill>
                )
              }
              cta={inv.status === "paid" ? "View" : "Pay"}
            />
          ))}
          {visibleQs.map((q) => (
            <DocLink
              key={q.id}
              href={`${base}/questionnaire/${q.token}`}
              kicker="Questionnaire"
              title={q.title}
              status={q.status === "submitted" ? <Pill tone="moss">Received</Pill> : <Pill tone="scarlet">To do</Pill>}
              cta={q.status === "submitted" ? "View" : "Start"}
            />
          ))}
          {project.galleryUrl && (
            <DocLink
              href={project.galleryUrl}
              external
              kicker="Gallery"
              title="Your photographs"
              meta="Opens your online gallery"
              cta="Open"
            />
          )}
          {reviewOpen && (
            <DocLink
              href={`${base}/review`}
              kicker="Kind words"
              title="Leave a review"
              meta="It would mean the world to hear about your experience."
              cta="Write"
            />
          )}
          {visibleProposals.length + visibleContracts.length + invRows.length + visibleQs.length === 0 &&
            !project.galleryUrl &&
            !reviewOpen && (
              <p className="text-center italic text-ink-soft">
                Your documents will appear here as soon as they&apos;re ready.
              </p>
            )}
        </div>
      </PortalSection>
    </div>
  );
}
