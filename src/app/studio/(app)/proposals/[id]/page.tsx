import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { getSettings, siteUrl } from "@/lib/settings";
import { formatDay, formatInstant, money, todayIn } from "@/lib/format";
import { bpsToPercent, describePlan } from "@/lib/billing-math";
import { Badge, Card, LinkButton, Notice, PageHeader } from "@/components/studio/ui";
import { ConfirmButton, CopyButton } from "@/components/studio/client-ui";
import { ProposalForm } from "../proposal-form";
import { builderOptions } from "../options";
import { voidProposal } from "../actions";
import { DEFAULT_PROPOSAL_BODY, DEFAULT_PROPOSAL_SUBJECT } from "../defaults";

export const metadata: Metadata = { title: "Proposal" };

const NOTICES: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  saved: { tone: "ok", text: "Draft saved." },
  "sent-sent": { tone: "ok", text: "Sent! Your client has the link in their inbox." },
  "sent-logged": {
    tone: "warn",
    text: "Marked as sent, but email isn't connected — nothing was delivered. Copy the link below and send it to your client yourself.",
  },
  "sent-failed": {
    tone: "bad",
    text: "Marked as sent, but the email FAILED to send (see Emails for the error). Copy the link below and send it yourself.",
  },
  voided: { tone: "ok", text: "Proposal voided — the client link now shows that it's no longer available." },
  "cannot-void": { tone: "bad", text: "A signed proposal can't be voided." },
};

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStudio();
  const { id } = await params;
  const sp = await searchParams;
  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
  if (!proposal) notFound();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, proposal.projectId) });
  if (!project) notFound();
  const s = await getSettings();
  const tz = s.business.timezone;
  const today = todayIn(tz);
  const link = `${siteUrl()}/c/${project.portalToken}/proposal/${proposal.token}`;
  const editable = proposal.status === "draft" || proposal.status === "sent";
  const notice = NOTICES[String(sp.notice ?? "")];
  const expired =
    (proposal.status === "sent" || proposal.status === "viewed") && proposal.expiresOn && proposal.expiresOn < today;

  const timeline = [
    ["Created", proposal.createdAt],
    ["Sent", proposal.sentAt],
    ["Viewed", proposal.viewedAt],
    ["Signed", proposal.acceptedAt],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow={project.title}
        title={proposal.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={proposal.status === "accepted" ? "ok" : expired ? "warn" : proposal.status === "viewed" ? "rose" : "blush"}>
              {expired ? "expired" : proposal.status}
            </Badge>
            <Link href={`/studio/projects/${project.id}`} className="underline-offset-4 hover:underline">
              Open project
            </Link>
          </span>
        }
        actions={
          <>
            <LinkButton href={link} target="_blank" variant="secondary">
              Preview as client
            </LinkButton>
            {proposal.status !== "draft" && <CopyButton text={link} label="Copy client link" />}
          </>
        }
      />
      {notice && (
        <div className="mb-5">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      )}
      {!emailConfigured() && editable && !notice && (
        <div className="mb-5">
          <Notice tone="warn">
            Email isn&apos;t connected, so “Send” will save the email in your outbox without delivering it. You can
            copy the client link and text or DM it instead.
          </Notice>
        </div>
      )}

      <Card className="mb-6" title="Status">
        <ol className="grid grid-cols-2 gap-3 font-sans text-sm sm:grid-cols-4">
          {timeline.map(([label, at]) => (
            <li key={label} className={at ? "text-ink" : "text-muted"}>
              <p className="label text-muted">{label}</p>
              <p>{at ? formatInstant(at, tz) : "—"}</p>
            </li>
          ))}
        </ol>
      </Card>

      {editable ? (
        <EditView proposalId={proposal.id} />
      ) : (
        <ReadOnly proposalId={proposal.id} tz={tz} portalToken={project.portalToken} />
      )}

      {proposal.status !== "accepted" && proposal.status !== "void" && (
        <Card className="mt-8" title="Void proposal">
          <form action={voidProposal.bind(null, proposal.id)} className="flex flex-wrap items-center gap-3">
            <ConfirmButton>Void proposal</ConfirmButton>
            <span className="font-sans text-xs text-muted">The client link will say it&apos;s no longer available.</span>
          </form>
        </Card>
      )}
    </>
  );
}

async function EditView({ proposalId }: { proposalId: string }) {
  const proposal = (await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) }))!;
  const project = (await db.query.projects.findFirst({ where: eq(schema.projects.id, proposal.projectId) }))!;
  const [s, opts] = await Promise.all([getSettings(), builderOptions(project.type)]);
  return (
    <ProposalForm
      project={{ id: project.id, title: project.title, eventDate: project.eventDate }}
      packages={opts.packages}
      templates={opts.templates}
      today={todayIn(s.business.timezone)}
      sent={proposal.status === "sent"}
      values={{
        id: proposal.id,
        title: proposal.title,
        message: proposal.message,
        packageIds: proposal.packageIds,
        addonIds: proposal.addonIds,
        contractTemplateId: proposal.contractTemplateId ?? "",
        plan: proposal.paymentPlan,
        taxPercent: bpsToPercent(proposal.taxRateBps),
        discount: proposal.discountCents ? (proposal.discountCents / 100).toFixed(2) : "",
        expiresOn: proposal.expiresOn ?? "",
        emailSubject: DEFAULT_PROPOSAL_SUBJECT,
        emailBody: DEFAULT_PROPOSAL_BODY,
      }}
    />
  );
}

async function ReadOnly({ proposalId, tz, portalToken }: { proposalId: string; tz: string; portalToken: string }) {
  const proposal = (await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) }))!;
  const ids = [...proposal.packageIds, ...proposal.addonIds];
  const pkgs = ids.length ? await db.query.packages.findMany({ where: inArray(schema.packages.id, ids) }) : [];
  const [contract, invoice] = await Promise.all([
    proposal.contractId ? db.query.contracts.findFirst({ where: eq(schema.contracts.id, proposal.contractId) }) : undefined,
    proposal.invoiceId ? db.query.invoices.findFirst({ where: eq(schema.invoices.id, proposal.invoiceId) }) : undefined,
  ]);
  const name = (id: string) => pkgs.find((p) => p.id === id);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title="Offered">
        <ul className="flex flex-col gap-1.5 font-sans text-sm">
          {proposal.packageIds.map((id) => (
            <li key={id} className="flex justify-between gap-3">
              <span>
                {name(id)?.name ?? "(deleted package)"}
                {proposal.selectedPackageId === id && <Badge tone="ok" className="ml-2">Chosen</Badge>}
              </span>
              <span className="text-ink-soft">{money(name(id)?.priceCents)}</span>
            </li>
          ))}
          {proposal.addonIds.map((id) => (
            <li key={id} className="flex justify-between gap-3 text-ink-soft">
              <span>
                + {name(id)?.name ?? "(deleted add-on)"}
                {proposal.selectedAddonIds.includes(id) && <Badge tone="ok" className="ml-2">Added</Badge>}
              </span>
              <span>{money(name(id)?.priceCents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-sans text-xs text-ink-soft">
          {describePlan(proposal.paymentPlan)}
          {proposal.taxRateBps ? ` · tax ${bpsToPercent(proposal.taxRateBps)}%` : ""}
          {proposal.discountCents ? ` · discount ${money(proposal.discountCents)}` : ""}
          {proposal.expiresOn ? ` · expires ${formatDay(proposal.expiresOn, "medium")}` : ""}
        </p>
      </Card>
      <Card title="Result">
        {proposal.status === "accepted" ? (
          <div className="flex flex-col gap-3 font-sans text-sm">
            <p>Signed {formatInstant(proposal.acceptedAt, tz)}.</p>
            <div className="flex flex-wrap gap-2">
              {contract && (
                <LinkButton href={`/studio/contracts/${contract.id}`} variant="secondary">
                  Contract · {contract.status === "signed" ? "needs countersign" : contract.status}
                </LinkButton>
              )}
              {invoice && (
                <LinkButton href={`/studio/invoices/${invoice.id}`} variant="secondary">
                  Invoice {invoice.number} · {invoice.status}
                </LinkButton>
              )}
            </div>
          </div>
        ) : proposal.status === "viewed" ? (
          <p className="font-sans text-sm text-ink-soft">
            Your client has opened this proposal, so it&apos;s locked. To change the offer, void it and send a new one.
            {" "}
            <Link className="text-scarlet underline-offset-4 hover:underline" href={`/studio/proposals/new?project=${proposal.projectId}`}>
              New proposal for this project
            </Link>
          </p>
        ) : (
          <p className="font-sans text-sm text-ink-soft">
            This proposal was voided. The client link{" "}
            <span className="break-all">/c/{portalToken.slice(0, 6)}…</span> shows that it&apos;s no longer available.
          </p>
        )}
      </Card>
    </div>
  );
}
