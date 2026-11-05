import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { isStudio } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { formatDay, fullName, todayIn } from "@/lib/format";
import { contractPreMerge, proposalStatusForClient } from "@/lib/billing";
import { Flourish, PortalCard, PortalHeading, PortalLink } from "@/components/money/portal-ui";
import { getPortalProject } from "../../portal-data";
import { ProposalFlow, type Offer } from "./proposal-flow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your proposal" };

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string; ptoken: string }>;
}) {
  const { token, ptoken } = await params;
  const portal = await getPortalProject(token);
  if (!portal) notFound();
  const { project, contact } = portal;
  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.token, ptoken) });
  if (!proposal || proposal.projectId !== project.id) notFound();
  const studio = await isStudio();
  if (proposal.status === "draft" && !studio) notFound();

  const s = await getSettings();
  const today = todayIn(s.business.timezone);
  const state = proposalStatusForClient(proposal, today);
  const first = s.business.photographer.split(" ")[0];

  // first open by the client → "viewed" (never for a studio preview)
  if (proposal.status === "sent" && !studio) {
    const r = await db
      .update(schema.proposals)
      .set({ status: "viewed", viewedAt: new Date() })
      .where(and(eq(schema.proposals.id, proposal.id), eq(schema.proposals.status, "sent")))
      .returning({ id: schema.proposals.id });
    if (r.length)
      await logActivity({
        projectId: project.id,
        contactId: project.contactId,
        kind: "proposal",
        title: `Proposal viewed: ${proposal.title}`,
        meta: { proposalId: proposal.id },
      });
  }

  if (state === "void" || state === "expired" || state === "accepted") {
    let links: { href: string; label: string }[] = [];
    if (state === "accepted") {
      const [c, inv] = await Promise.all([
        proposal.contractId
          ? db.query.contracts.findFirst({ where: eq(schema.contracts.id, proposal.contractId) })
          : undefined,
        proposal.invoiceId
          ? db.query.invoices.findFirst({ where: eq(schema.invoices.id, proposal.invoiceId) })
          : undefined,
      ]);
      links = [
        ...(inv ? [{ href: `/c/${token}/invoice/${inv.token}`, label: "View your invoice" }] : []),
        ...(c ? [{ href: `/c/${token}/contract/${c.token}`, label: "Your signed agreement" }] : []),
      ];
    }
    return (
      <div>
        <PortalHeading
          script={state === "accepted" ? "Thank you" : "Oh dear"}
          title={
            state === "accepted"
              ? "This proposal is signed"
              : state === "expired"
                ? "This proposal has expired"
                : "This proposal is no longer available"
          }
        >
          <p>
            {state === "accepted"
              ? `You signed on ${proposal.acceptedAt ? formatDay(todayIn(s.business.timezone, proposal.acceptedAt), "long") : "—"}. Everything you need is below.`
              : state === "expired"
                ? `It was available until ${formatDay(proposal.expiresOn, "long")}. Just reach out and ${first} will happily send a fresh one.`
                : `${first} may have sent you an updated proposal — check your portal, or reach out with any questions.`}
          </p>
        </PortalHeading>
        <Flourish className="mt-10" />
        <PortalCard className="mt-10 text-center">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {links.map((l, i) => (
              <PortalLink key={l.href} href={l.href} variant={i === 0 ? "primary" : "outline"} prefetch={false}>
                {l.label}
              </PortalLink>
            ))}
            <PortalLink href={`/c/${token}`} variant={links.length ? "quiet" : "primary"}>
              Back to your portal
            </PortalLink>
            {state !== "accepted" && s.business.email && (
              <a href={`mailto:${s.business.email}`} className="font-sans text-sm text-scarlet underline-offset-4 hover:underline">
                {s.business.email}
              </a>
            )}
          </div>
        </PortalCard>
      </div>
    );
  }

  // open (or a studio preview of a draft)
  const ids = [...proposal.packageIds, ...proposal.addonIds];
  const rows = ids.length
    ? await db.query.packages.findMany({ where: inArray(schema.packages.id, ids) })
    : [];
  const toOffer = (id: string): Offer | null => {
    const p = rows.find((r) => r.id === id);
    return p
      ? { id: p.id, name: p.name, description: p.description, priceCents: p.priceCents, inclusions: p.inclusions }
      : null;
  };
  const packages = proposal.packageIds.map(toOffer).filter((o): o is Offer => !!o);
  const addons = proposal.addonIds.map(toOffer).filter((o): o is Offer => !!o);
  const template = proposal.contractTemplateId
    ? await db.query.contractTemplates.findFirst({
        where: eq(schema.contractTemplates.id, proposal.contractTemplateId),
      })
    : undefined;
  const ready = packages.length > 0 && !!template;
  const contractPre = template ? await contractPreMerge(project.id, template.body) : "";

  return (
    <div>
      {studio && (
        <p className="mb-8 rounded-[2px] border border-rose bg-blush/40 px-4 py-3 text-center font-sans text-sm text-wine">
          Studio preview{proposal.status === "draft" ? " of a draft" : ""} — this is exactly what your client sees.
          Viewing it here doesn&apos;t mark it as viewed.
        </p>
      )}
      <PortalHeading script="For you" title={proposal.title}>
        {proposal.expiresOn && (
          <p className="font-sans text-[0.75rem] uppercase tracking-[0.22em] text-muted">
            Available until {formatDay(proposal.expiresOn, "long")}
          </p>
        )}
      </PortalHeading>

      {proposal.message && (
        <PortalCard className="mt-10">
          <p className="whitespace-pre-line text-[1.1rem] leading-relaxed">{proposal.message}</p>
          <p className="script inked mt-4 text-4xl text-scarlet">{first}</p>
        </PortalCard>
      )}

      <Flourish className="my-12" />

      {ready ? (
        <ProposalFlow
          token={token}
          ptoken={ptoken}
          packages={packages}
          addons={addons}
          plan={proposal.paymentPlan}
          taxRateBps={proposal.taxRateBps}
          discountCents={proposal.discountCents}
          contractTitle={template!.name}
          contractPre={contractPre}
          signedDay={today}
          eventDate={project.eventDate}
          defaultName={contact ? fullName(contact) : ""}
          preview={studio}
        />
      ) : (
        <PortalCard className="text-center">
          <p className="text-[1.1rem]">
            This proposal isn&apos;t quite ready yet — {first} is putting the finishing touches on it.
          </p>
          {studio && (
            <p className="mt-3 font-sans text-sm text-scarlet">
              Studio: add at least one collection and a contract template before sending.
            </p>
          )}
        </PortalCard>
      )}
    </div>
  );
}
