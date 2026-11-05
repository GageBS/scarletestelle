import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { coupleName } from "@/lib/format";
import { ContractDocument } from "@/components/money/contract-document";
import { PrintButton, PrintStyles } from "@/components/money/print";
import { PortalHeading, PortalLink, portalBtn } from "@/components/money/portal-ui";
import { getPortalProject } from "../../portal-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your agreement" };

export default async function ClientContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; ctoken: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, ctoken } = await params;
  const sp = await searchParams;
  const portal = await getPortalProject(token);
  if (!portal) notFound();
  const contract = await db.query.contracts.findFirst({ where: eq(schema.contracts.token, ctoken) });
  if (!contract || contract.projectId !== portal.project.id || contract.status === "draft") notFound();
  const s = await getSettings();

  return (
    <div>
      <PrintStyles />
      <PortalHeading
        script={sp.signed ? "Thank you" : "Your agreement"}
        title={contract.status === "void" ? "This agreement was voided" : contract.title}
      >
        <p>
          {contract.status === "void"
            ? "It's no longer in effect. Please reach out with any questions."
            : contract.status === "countersigned"
              ? "Signed by you and countersigned by the studio. Keep this copy for your records."
              : "You've signed — the studio will countersign shortly. Keep this copy for your records."}
        </p>
      </PortalHeading>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <PrintButton label="Print or save as PDF" className={portalBtn.outline} />
        <PortalLink href={`/c/${token}`} variant="quiet">
          Back to your portal
        </PortalLink>
      </div>

      <div className="print-area mt-10 overflow-hidden rounded-[2px] border border-rule shadow-[0_18px_40px_-28px_rgb(42_18_19/0.45)]">
        <ContractDocument
          contract={contract}
          studioName={s.business.name}
          preparedFor={portal.contact ? coupleName(portal.contact) : undefined}
          timezone={s.business.timezone}
        />
      </div>
    </div>
  );
}
