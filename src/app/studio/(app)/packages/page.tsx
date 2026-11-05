import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { money } from "@/lib/format";
import { PROJECT_TYPES, projectTypeLabel } from "@/lib/constants";
import { Badge, Card, EmptyState, Notice, PageHeader, btnStyles, cx } from "@/components/studio/ui";
import { ConfirmButton } from "@/components/studio/client-ui";
import { deletePackage, movePackage } from "./actions";
import { PackageForm } from "./package-form";

export const metadata: Metadata = { title: "Packages & pricing" };

const NOTICES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  deleted: { tone: "ok", text: "Package deleted." },
  "in-use": {
    tone: "bad",
    text: "That package is part of an open proposal, so it can't be deleted. Untick “Active” to stop offering it instead.",
  },
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStudio();
  const sp = await searchParams;
  const notice = NOTICES[String(sp.notice ?? sp.error ?? "")];
  const all = await db.query.packages.findMany({
    orderBy: [asc(schema.packages.isAddon), asc(schema.packages.sort), asc(schema.packages.name)],
  });
  const types = PROJECT_TYPES.filter((t) => all.some((p) => p.projectType === t.value));
  const sel = typeof sp.type === "string" ? sp.type : "wedding";

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Packages & pricing"
        description="Your collections and add-ons. Offer up to three collections on a proposal; clients pick one and any add-ons."
      />
      {notice && (
        <div className="mb-5">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      )}

      <Card className="mb-6">
        <details>
          <summary className="cursor-pointer list-none font-sans text-sm text-ink">
            <span className={cx(btnStyles.accent, "pointer-events-none")}>+ New collection or add-on</span>
          </summary>
          <div className="mt-5">
            <PackageForm
              values={{
                name: "",
                projectType: PROJECT_TYPES.some((t) => t.value === sel) ? sel : "wedding",
                price: "",
                description: "",
                inclusions: "",
                isAddon: false,
                active: true,
                showOnSite: true,
              }}
            />
          </div>
        </details>
      </Card>

      {all.length === 0 ? (
        <Card>
          <EmptyState title="Nothing here yet">
            Add your first collection above — or run <code>npm run db:seed</code> for starter packages.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {types.map((t) => {
            const rows = all.filter((p) => p.projectType === t.value);
            return (
              <Card key={t.value} title={`${projectTypeLabel(t.value)} · ${rows.length}`} pad={false}>
                <ul className="divide-y divide-rule/70">
                  {rows.map((p, i) => {
                    const sameGroup = rows.filter((r) => r.isAddon === p.isAddon);
                    const gi = sameGroup.findIndex((r) => r.id === p.id);
                    const firstAddon = p.isAddon && (i === 0 || !rows[i - 1].isAddon);
                    return (
                      <li key={p.id} className="px-4 py-3 md:px-5">
                        {firstAddon && <p className="label -mt-1 mb-2 text-muted">Add-ons</p>}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-sans text-[0.95rem] text-ink">{p.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="font-sans text-sm text-ink-soft">{money(p.priceCents)}</span>
                              {p.isAddon && <Badge tone="blush">Add-on</Badge>}
                              {!p.active && <Badge tone="warn">Inactive</Badge>}
                              {p.showOnSite && p.active && <Badge tone="ok">On website</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <form action={movePackage.bind(null, p.id, "up")}>
                              <button
                                type="submit"
                                disabled={gi === 0}
                                aria-label={`Move ${p.name} up`}
                                className={cx(btnStyles.ghost, "min-h-11 px-3")}
                              >
                                ↑
                              </button>
                            </form>
                            <form action={movePackage.bind(null, p.id, "down")}>
                              <button
                                type="submit"
                                disabled={gi === sameGroup.length - 1}
                                aria-label={`Move ${p.name} down`}
                                className={cx(btnStyles.ghost, "min-h-11 px-3")}
                              >
                                ↓
                              </button>
                            </form>
                          </div>
                        </div>
                        <details className="mt-2">
                          <summary className="cursor-pointer font-sans text-xs uppercase tracking-[0.16em] text-scarlet">
                            Edit
                          </summary>
                          <div className="mt-4 rounded-sm border border-rule bg-parchment/40 p-4">
                            <PackageForm
                              values={{
                                id: p.id,
                                name: p.name,
                                projectType: p.projectType,
                                price: (p.priceCents / 100).toFixed(2),
                                description: p.description,
                                inclusions: p.inclusions.join("\n"),
                                isAddon: p.isAddon,
                                active: p.active,
                                showOnSite: p.showOnSite,
                              }}
                            />
                            <form action={deletePackage.bind(null, p.id)} className="mt-4 border-t border-rule pt-4">
                              <ConfirmButton>Delete package</ConfirmButton>
                            </form>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
