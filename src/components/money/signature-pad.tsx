"use client";
/* Draw-a-signature canvas. Pointer events (finger, stylus, mouse), no page scroll while
   drawing, Clear button, exports a transparent PNG data URL capped at MAX_CHARS. */
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_CHARS = 200_000; // ≤ 200 KB data URL
const INK = "#2a1213";

export function SignaturePad({
  onChange,
  label = "Draw your signature",
}: {
  onChange: (dataUrl: string | null) => void;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const width = useRef(0);
  const inked = useRef(false);
  const [empty, setEmpty] = useState(true);
  // keep the latest callback without re-running effects (re-setup would wipe the canvas)
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 2.4;
    width.current = rect.width;
  }, []);

  const clear = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    setup();
    inked.current = false;
    setEmpty(true);
    cb.current(null);
  }, [setup]);

  useEffect(() => {
    setup();
    const c = canvasRef.current;
    if (!c || typeof ResizeObserver === "undefined") return;
    // iOS fires resizes when the toolbar collapses; only a WIDTH change needs a redraw
    const ro = new ResizeObserver(() => {
      const w = c.getBoundingClientRect().width;
      if (Math.abs(w - width.current) > 1) {
        setup();
        if (inked.current) {
          inked.current = false;
          setEmpty(true);
          cb.current(null);
        }
      }
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [setup]);

  const point = (e: React.PointerEvent | PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const exportPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    let scale = Math.min(1, 700 / c.width);
    for (let attempt = 0; attempt < 6; attempt++) {
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(c.width * scale));
      out.height = Math.max(1, Math.round(c.height * scale));
      out.getContext("2d")?.drawImage(c, 0, 0, out.width, out.height);
      const url = out.toDataURL("image/png");
      if (url.length <= MAX_CHARS) {
        cb.current(url);
        return;
      }
      scale *= 0.7;
    }
    cb.current(null);
  };

  return (
    <div>
      <div className="relative rounded-sm border border-rose bg-cream">
        <canvas
          ref={canvasRef}
          aria-label={label}
          role="img"
          className="block h-44 w-full cursor-crosshair touch-none select-none sm:h-48"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.preventDefault();
            canvasRef.current?.setPointerCapture(e.pointerId);
            drawing.current = true;
            const p = point(e);
            last.current = p;
            const ctx = canvasRef.current?.getContext("2d");
            if (ctx) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvasRef.current?.getContext("2d");
            if (!ctx || !last.current) return;
            const evs =
              typeof e.nativeEvent.getCoalescedEvents === "function"
                ? e.nativeEvent.getCoalescedEvents()
                : [e.nativeEvent];
            for (const ev of evs.length ? evs : [e.nativeEvent]) {
              const p = point(ev);
              const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
              ctx.beginPath();
              ctx.moveTo(last.current.x, last.current.y);
              ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              last.current = p;
            }
            if (!inked.current) {
              inked.current = true;
              setEmpty(false);
            }
          }}
          onPointerUp={() => {
            if (!drawing.current) return;
            drawing.current = false;
            last.current = null;
            if (inked.current) exportPng();
          }}
          onPointerCancel={() => {
            drawing.current = false;
            last.current = null;
            if (inked.current) exportPng();
          }}
        />
        {/* signing line */}
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-rose/70" />
        <span className="pointer-events-none absolute bottom-3 left-6 font-sans text-[0.65rem] uppercase tracking-[0.22em] text-muted">
          {empty ? "Sign here with your finger" : "Signature"}
        </span>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="min-h-11 px-3 font-sans text-[0.7rem] uppercase tracking-[0.2em] text-ink-soft underline-offset-4 hover:text-scarlet hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
