"use client";
/* Print support: <PrintButton/> calls window.print(); wrap printable content in
   <div className="print-area"> and render <PrintStyles/> once on the page — everything
   else on the page (studio sidebar, portal header…) is hidden when printing. */

export function PrintButton({
  label = "Print / save PDF",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-ink/30 px-4 font-sans text-[0.72rem] uppercase tracking-[0.18em] text-ink transition hover:border-ink"
      }
    >
      {label}
    </button>
  );
}

export function PrintStyles() {
  return (
    <style>{`
@media print {
  @page { margin: 16mm 14mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .print-area, .print-area * { visibility: visible !important; }
  .print-area { position: absolute !important; left: 0; top: 0; width: 100% !important; margin: 0 !important;
    padding: 0 !important; border: 0 !important; box-shadow: none !important; background: #fff !important; }
  .print-area .no-print { display: none !important; }
  .print-area .doc-scroll { max-height: none !important; overflow: visible !important; }
}`}</style>
  );
}
