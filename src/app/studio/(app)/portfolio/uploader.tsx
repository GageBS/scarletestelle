"use client";
/* Multi-file photo uploader. Sends ONE request per file, in order, so a big batch
   from an iPhone photo library never trips the request-size limit. */
import { useRef, useState } from "react";
import { cx } from "@/components/studio/ui";
import { uploadPhoto } from "./actions";

type Item = {
  key: string;
  name: string;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

export function Uploader({
  categoryId,
  galleryId,
  label = "Add photos",
}: {
  categoryId?: string;
  galleryId?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function onPick(files: File[]) {
    if (!files.length) return;
    const batch: Item[] = files.map((f, n) => ({
      key: `${Date.now()}-${n}`,
      name: f.name || `photo ${n + 1}`,
      status: "queued",
    }));
    setItems(batch);
    setBusy(true);
    for (const [n, file] of files.entries()) {
      const key = batch[n].key;
      patch(key, { status: "uploading" });
      try {
        const fd = new FormData();
        fd.set("file", file);
        if (galleryId) fd.set("galleryId", galleryId);
        else if (categoryId) fd.set("categoryId", categoryId);
        const res = await uploadPhoto(fd);
        patch(key, res.ok ? { status: "done" } : { status: "error", error: res.error });
      } catch {
        patch(key, {
          status: "error",
          error: "Upload failed (connection lost or file too large). Try this one again.",
        });
      }
    }
    setBusy(false);
  }

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;

  return (
    <div>
      <label
        className={cx(
          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-rose bg-parchment/50 px-4 py-5 text-center font-sans transition hover:border-scarlet",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <span className="label text-ink">{busy ? "Uploading…" : label}</span>
        <span className="text-xs text-ink-soft">
          Tap to choose from your photo library (you can pick many at once)
        </span>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void onPick(files);
          }}
        />
      </label>

      {items.length > 0 && (
        <div className="mt-3 font-sans text-sm" role="status" aria-live="polite">
          <p className="text-ink-soft">
            {busy
              ? `Uploading ${Math.min(done + failed + 1, items.length)} of ${items.length}…`
              : `Finished: ${done} added${failed ? `, ${failed} failed` : ""}.`}
          </p>
          <ul className="mt-2 max-h-56 divide-y divide-rule overflow-y-auto rounded-sm border border-rule bg-cream">
            {items.map((i) => (
              <li key={i.key} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{i.name}</span>
                  {i.error && <span className="block text-xs text-scarlet">{i.error}</span>}
                </span>
                <span
                  className={cx(
                    "shrink-0 text-xs uppercase tracking-wider",
                    i.status === "done" && "text-moss-deep",
                    i.status === "error" && "text-scarlet",
                    (i.status === "queued" || i.status === "uploading") && "text-muted",
                  )}
                >
                  {i.status === "done"
                    ? "Added"
                    : i.status === "error"
                      ? "Failed"
                      : i.status === "uploading"
                        ? "Uploading"
                        : "Waiting"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
