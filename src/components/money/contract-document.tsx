/* The frozen, signed contract: body + signature block (+ optional audit trail).
   Used by the studio (/studio/contracts/[id]) and the client copy (/c/.../contract/...). */
import { Monogram } from "@/components/brand";
import { Markdown } from "./markdown";
import { formatInstant } from "@/lib/format";

type Contract = {
  title: string;
  body: string;
  bodyHash: string;
  status: string;
  clientSignatureName: string | null;
  clientSignatureImage: string | null;
  clientSignedAt: Date | null;
  clientSignedIp: string | null;
  clientSignedUa: string | null;
  studioSignatureName: string | null;
  studioSignedAt: Date | null;
};

export function ContractDocument({
  contract,
  studioName,
  preparedFor,
  timezone,
  hashMatches,
  showAudit = true,
}: {
  contract: Contract;
  studioName: string;
  preparedFor?: string;
  timezone: string;
  hashMatches?: boolean;
  showAudit?: boolean;
}) {
  const tz = timezone;
  const zoneLabel =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(contract.clientSignedAt ?? new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  const when = (d: Date | null) => (d ? `${formatInstant(d, tz)} ${zoneLabel}`.trim() : "—");
  return (
    <article className="bg-cream px-5 py-8 sm:px-10 sm:py-12">
      <header className="mb-8 flex flex-col items-center text-center">
        <Monogram size={54} className="text-ink" />
        <p className="label mt-4 text-muted">{studioName}</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">{contract.title}</h1>
        {preparedFor && <p className="mt-2 font-sans text-sm text-ink-soft">Prepared for {preparedFor}</p>}
      </header>

      <Markdown text={contract.body} className="doc-prose text-[1.02rem] leading-relaxed" />

      <section className="mt-12 grid gap-8 border-t border-rule pt-8 sm:grid-cols-2">
        <div>
          <p className="label text-muted">Client</p>
          <div className="mt-2 flex h-24 items-end border-b border-ink/40 pb-1">
            {contract.clientSignatureImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL signature
              <img
                src={contract.clientSignatureImage}
                alt={`Signature of ${contract.clientSignatureName ?? "client"}`}
                className="max-h-24 max-w-full object-contain object-left-bottom"
              />
            ) : (
              <span className="font-sans text-sm text-muted">Not signed yet</span>
            )}
          </div>
          <p className="mt-2 text-base">{contract.clientSignatureName ?? "—"}</p>
          <p className="font-sans text-xs text-ink-soft">
            {contract.clientSignedAt ? `Signed electronically · ${when(contract.clientSignedAt)}` : "Awaiting signature"}
          </p>
        </div>
        <div>
          <p className="label text-muted">Photographer</p>
          <div className="mt-2 flex h-24 items-end border-b border-ink/40 pb-1">
            {contract.studioSignatureName ? (
              <span className="script inked text-[2.6rem] leading-none text-ink">{contract.studioSignatureName}</span>
            ) : (
              <span className="font-sans text-sm text-muted">Awaiting countersignature</span>
            )}
          </div>
          <p className="mt-2 text-base">{contract.studioSignatureName ?? studioName}</p>
          <p className="font-sans text-xs text-ink-soft">
            {contract.studioSignedAt ? `Countersigned · ${when(contract.studioSignedAt)}` : "—"}
          </p>
        </div>
      </section>

      {showAudit && contract.clientSignedAt && (
        <section className="mt-10 rounded-sm border border-rule bg-parchment/60 p-4 font-sans text-xs text-ink-soft">
          <p className="label mb-2 text-ink">Signature audit trail</p>
          <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[9rem_1fr]">
            <dt className="text-muted">Signed by</dt>
            <dd>{contract.clientSignatureName}</dd>
            <dt className="text-muted">Signed at</dt>
            <dd>{when(contract.clientSignedAt)}</dd>
            <dt className="text-muted">IP address</dt>
            <dd className="break-all">{contract.clientSignedIp || "—"}</dd>
            <dt className="text-muted">Device</dt>
            <dd className="break-all">{contract.clientSignedUa || "—"}</dd>
            <dt className="text-muted">Document SHA-256</dt>
            <dd className="break-all font-mono text-[0.7rem]">{contract.bodyHash || "—"}</dd>
            {hashMatches !== undefined && (
              <>
                <dt className="text-muted">Integrity</dt>
                <dd className={hashMatches ? "text-moss-deep" : "text-scarlet"}>
                  {hashMatches
                    ? "Verified — the text is unchanged since it was signed."
                    : "WARNING — the stored text no longer matches the signed fingerprint."}
                </dd>
              </>
            )}
            {contract.studioSignedAt && (
              <>
                <dt className="text-muted">Countersigned</dt>
                <dd>
                  {contract.studioSignatureName} · {when(contract.studioSignedAt)}
                </dd>
              </>
            )}
          </dl>
        </section>
      )}
    </article>
  );
}
