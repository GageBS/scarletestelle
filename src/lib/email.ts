/**
 * Outgoing email. Every message is recorded in `messages` (the studio Outbox).
 *  - RESEND_API_KEY + EMAIL_FROM set → delivered through Resend, status "sent"
 *  - not set                         → saved only, status "logged" (studio shows a banner)
 *  - provider error                  → status "failed" with the error text (never silent)
 */
import { db, schema } from "@/db";
import { newId } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export const emailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text (with blank-line paragraphs, **bold**, and bare links) → simple branded HTML. */
export function textToHtml(body: string, studioName: string) {
  const paras = body
    .trim()
    .split(/\n{2,}/)
    .map((p) =>
      escapeHtml(p)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#8f1d21">$1</a>')
        .replace(/\n/g, "<br>"),
    )
    .map((p) => `<p style="margin:0 0 16px">${p}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f3ece1;padding:32px 16px">
<div style="max-width:560px;margin:0 auto;background:#fbf7f0;padding:36px 32px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#2a1213">
${paras}
<p style="margin:28px 0 0;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8a7570">${escapeHtml(studioName)}</p>
</div></body></html>`;
}

export type SendResult = {
  id: string;
  status: "sent" | "logged" | "failed";
  error?: string;
};

export async function sendEmail(m: {
  to: string;
  subject: string;
  body: string;
  projectId?: string | null;
  contactId?: string | null;
  automationId?: string | null;
  replyTo?: string;
  logToTimeline?: boolean; // default true
}): Promise<SendResult> {
  const s = await getSettings();
  const id = newId();
  const from = process.env.EMAIL_FROM ?? "";
  let status: SendResult["status"] = "logged";
  let providerId: string | null = null;
  let error: string | undefined;

  if (!m.to) {
    status = "failed";
    error = "No recipient email address";
  } else if (emailConfigured()) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [m.to],
          subject: m.subject,
          text: m.body,
          html: textToHtml(m.body, s.business.name),
          reply_to: m.replyTo || s.business.email || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) {
        status = "sent";
        providerId = json.id ?? null;
      } else {
        status = "failed";
        error = `Resend ${res.status}: ${json.message ?? res.statusText}`;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await db.insert(schema.messages).values({
    id,
    projectId: m.projectId ?? null,
    contactId: m.contactId ?? null,
    direction: "out",
    toEmail: m.to,
    fromEmail: from,
    subject: m.subject,
    body: m.body,
    status,
    provider: emailConfigured() ? "resend" : "log",
    providerId,
    error: error ?? null,
    automationId: m.automationId ?? null,
  });

  if (m.logToTimeline !== false && (m.projectId || m.contactId)) {
    await logActivity({
      projectId: m.projectId,
      contactId: m.contactId,
      kind: "email",
      title:
        status === "sent"
          ? `Email sent: ${m.subject}`
          : status === "logged"
            ? `Email saved (email not connected): ${m.subject}`
            : `Email FAILED: ${m.subject}`,
      body: error ?? "",
      meta: { messageId: id, to: m.to },
    });
  }
  return { id, status, error };
}
