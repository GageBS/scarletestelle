"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAction, loadSlotsForManage, rescheduleAction, type SlotsPayload } from "../../actions";
import { SlotPicker } from "../../slot-picker";

export function ManageFlow({ token, canChange }: { token: string; canChange: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "resched" | "cancel">("idle");
  const [data, setData] = useState<SlotsPayload | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!canChange) return null;

  function openResched() {
    setMode("resched");
    setMsg(null);
    start(async () => setData(await loadSlotsForManage(token)));
  }
  function doResched() {
    if (picked == null) return;
    start(async () => {
      const r = await rescheduleAction(token, picked);
      if (r.ok) {
        setMsg({ tone: "ok", text: `Done — you're now booked for ${r.when}.` });
        setMode("idle");
        setPicked(null);
        router.refresh();
      } else {
        setMsg({ tone: "bad", text: r.error });
        if (r.slotTaken) {
          setPicked(null);
          setData(await loadSlotsForManage(token));
        }
      }
    });
  }
  function doCancel() {
    start(async () => {
      const r = await cancelAction(token);
      if (r.ok) {
        setMode("idle");
        router.refresh();
      } else setMsg({ tone: "bad", text: r.error });
    });
  }

  const btn =
    "inline-flex min-h-11 items-center justify-center rounded-sm px-5 font-sans text-[0.72rem] uppercase tracking-[0.18em] transition disabled:opacity-50";
  return (
    <div className="mt-8">
      {msg && (
        <p
          role="status"
          className={`mb-5 rounded-sm border px-4 py-3 font-sans text-sm ${
            msg.tone === "ok"
              ? "border-moss/40 bg-moss/10 text-moss-deep"
              : "border-scarlet/40 bg-scarlet/10 text-scarlet"
          }`}
        >
          {msg.text}
        </p>
      )}
      {mode === "idle" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button className={`${btn} bg-ink text-cream hover:bg-wine`} onClick={openResched}>
            Reschedule
          </button>
          <button
            className={`${btn} border border-scarlet/50 text-scarlet hover:bg-scarlet hover:text-cream`}
            onClick={() => {
              setMode("cancel");
              setMsg(null);
            }}
          >
            Cancel this call
          </button>
        </div>
      )}
      {mode === "cancel" && (
        <div className="rounded-sm border border-scarlet/30 bg-cream p-5 text-center">
          <p className="font-sans text-sm text-ink-soft">Are you sure you&apos;d like to cancel?</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button disabled={pending} className={`${btn} bg-scarlet text-cream hover:bg-wine`} onClick={doCancel}>
              {pending ? "Cancelling…" : "Yes, cancel"}
            </button>
            <button className={`${btn} border border-ink/30`} onClick={() => setMode("idle")}>
              Keep my time
            </button>
          </div>
        </div>
      )}
      {mode === "resched" && (
        <div>
          <h2 className="label mb-4 text-ink">Pick a new time</h2>
          {data ? (
            <SlotPicker data={data} selected={picked} onSelect={setPicked} />
          ) : (
            <p className="font-sans text-sm text-muted">{pending ? "Loading times…" : "Couldn't load times."}</p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              disabled={pending || picked == null}
              className={`${btn} bg-scarlet text-cream hover:bg-wine`}
              onClick={doResched}
            >
              {pending ? "Saving…" : "Confirm new time"}
            </button>
            <button className={`${btn} border border-ink/30`} onClick={() => setMode("idle")}>
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
