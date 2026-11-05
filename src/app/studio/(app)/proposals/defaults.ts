/* Default copy for the "proposal sent" email (merge fields allowed). */
export const DEFAULT_PROPOSAL_SUBJECT = "Your proposal from {{studio_name}}";
export const DEFAULT_PROPOSAL_BODY = `Hi {{client_first_name}},

Thank you so much for reaching out — it would be an honor to tell your story. Your proposal is ready:

{{proposal_link}}

Inside you can choose your collection, read and sign your agreement, and pay your retainer to reserve your date — all in one place, right from your phone.

With love,
{{photographer_name}}`;

export const DEFAULT_PROPOSAL_MESSAGE = (firstName: string, _photographer?: string) =>
  `Hi ${firstName || "there"},

I'm so glad you found me. I put together the collections I think fit your day best — choose the one that feels right, add anything extra, and reserve your date when you're ready.

If you have any questions at all, just reply to my email.`;
