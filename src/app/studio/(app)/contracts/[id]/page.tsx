import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { getSettings, siteUrl } from "@/lib/settings";
import { coupleName } from "@/lib/format";
import { sha256 } from "@/lib/billing";
import { Badge, Card, LinkButton, Notice, PageHeader } from "@/components/studio/ui";
import { ConfirmButton, CopyButton } from "@/components/studio/client-ui";
import { ContractDocument } from "@/components/money/contract-document";
import { PrintButton, PrintStyles } from "@/components/money/print";
import { countersign } from "../actions";

export const metadata: Metadata = { title: "Contract" };

export default async function ContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStudio();
  const { id } = await params;
  const sp = await searchParams;
  const contract = await db.query.contracts.findFirst({ where: eq(schema.contracts.id, id) });
  if (!contract) notFound();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, contract.projectId) });
  if (!project) notFound();
  const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, project.contactId) });
  const s = await getSettings();
  const clientUrl = `${siteUrl()}/c/${project.portalToken}/contract/${contract.token}`;
  const hashMatches = contract.bodyHash ? sha256(contract.body) === contract.bodyHash : undefined;
  const sigName = s.business.signatureName || s.business.photographer;

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow={project.title}
        title={contract.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={contract.status === "countersigned" ? "ok" : contract.status === "signed" ? "warn" : "muted"}>
              {contract.status === "signed" ? "Signed by client — needs your countersignature" : contract.status}
            </Badge>
            <Link href={`/studio/projects/${project.id}`} className="underline-offset-4 hover:underline">
              Open project
            </Link>
          </span>
        }
        actions={
          <>
            <PrintButton />
            <CopyButton text={clientUrl} label="Copy client link" />
            <LinkButton href={clientUrl} target="_blank" variant="ghost">
              Client view
            </LinkButton>
          </>
        }
      />

      {sp.notice === "countersigned" && (
        <div className="mb-5">
          <Notice tone="ok">Countersigned as {contract.studioSignatureName}. Your client&apos;s copy now shows both signatures.</Notice>
        </div>
      )}
      {sp.error === "not-signed" && (
        <div className="mb-5">
          <Notice tone="bad">Only a contract the client has signed (and not yet countersigned) can be countersigned.</Notice>
        </div>
      )}
      {hashMatches === false && (
        <div className="mb-5">
          <Notice tone="bad">
            The stored text doesn&apos;t match the fingerprint recorded at signing. Don&apos;t rely on this copy — check
            your database backups.
          </Notice>
        </div>
      )}

      {contract.status === "signed" && (
        <Card className="mb-6" title="Countersign">
          <form action={countersign.bind(null, contract.id)} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1 font-sans text-sm text-ink-soft">
              Sign as <span className="script text-2xl text-ink">{sigName}</span> — change this name in Settings →
              Business.
            </p>
            <ConfirmButton variant="accent" confirmText="Tap again to sign">
              Countersign
            </ConfirmButton>
          </form>
        </Card>
      )}

      <div className="print-area overflow-hidden rounded-sm border border-rule">
        <ContractDocument
          contract={contract}
          studioName={s.business.name}
          preparedFor={contact ? coupleName(contact) : undefined}
          timezone={s.business.timezone}
          hashMatches={hashMatches}
        />
      </div>
    </>
  );
}
