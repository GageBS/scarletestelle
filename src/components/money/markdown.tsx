/* Tiny, safe Markdown → React renderer for contracts (no HTML injection possible).
   Supports: # / ## / ### headings, paragraphs (single newlines kept as line breaks),
   - bullets, 1. numbered lists, > quotes, --- rules, **bold**, *italic*.
   Server-safe and client-safe (no hooks). */
import { Fragment, type ReactNode } from "react";

type Block =
  | { t: "h"; level: 1 | 2 | 3; text: string }
  | { t: "p"; lines: string[] }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "quote"; lines: string[] }
  | { t: "hr" };

const RE_H = /^(#{1,3})\s+(.*)$/;
const RE_HR = /^(-{3,}|\*{3,}|_{3,})$/;
const RE_UL = /^[-*•]\s+/;
const RE_OL = /^\d+[.)]\s+/;
const RE_Q = /^>\s?/;
const isBlockStart = (t: string) =>
  RE_H.test(t) || RE_HR.test(t) || RE_UL.test(t) || RE_OL.test(t) || RE_Q.test(t);

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const tr = lines[i].trim();
    if (!tr) {
      i++;
      continue;
    }
    const h = tr.match(RE_H);
    if (h) {
      out.push({ t: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      i++;
    } else if (RE_HR.test(tr)) {
      out.push({ t: "hr" });
      i++;
    } else if (RE_UL.test(tr) || RE_OL.test(tr)) {
      const re = RE_UL.test(tr) ? RE_UL : RE_OL;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(re, ""));
        i++;
      }
      out.push({ t: re === RE_UL ? "ul" : "ol", items });
    } else if (RE_Q.test(tr)) {
      const q: string[] = [];
      while (i < lines.length && RE_Q.test(lines[i].trim())) {
        q.push(lines[i].trim().replace(RE_Q, ""));
        i++;
      }
      out.push({ t: "quote", lines: q });
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i].trim())) {
        para.push(lines[i].trim());
        i++;
      }
      out.push({ t: "p", lines: para });
    }
  }
  return out;
}

const RE_INLINE = /(\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*|\{\{\s*[a-z_]+\s*\}\})/g;

function inline(text: string, highlightFields: boolean): ReactNode[] {
  return text.split(RE_INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("{{") && part.endsWith("}}"))
      return highlightFields ? (
        <mark key={i} className="rounded-sm bg-blush/70 px-1 font-sans text-[0.85em] text-wine">
          {part}
        </mark>
      ) : (
        part
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function lines(ls: string[], hl: boolean) {
  return ls.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {inline(l, hl)}
    </Fragment>
  ));
}

export function Markdown({
  text,
  className = "doc-prose",
  highlightFields = false,
}: {
  text: string;
  className?: string;
  highlightFields?: boolean;
}) {
  const blocks = parseMarkdown(text);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h": {
            const H = (`h${b.level}` as "h1" | "h2" | "h3");
            return <H key={i}>{inline(b.text, highlightFields)}</H>;
          }
          case "p":
            return <p key={i}>{lines(b.lines, highlightFields)}</p>;
          case "ul":
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, highlightFields)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, highlightFields)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={i} className="my-4 border-l-2 border-scarlet/50 pl-4 italic text-ink-soft">
                {lines(b.lines, highlightFields)}
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="my-6 border-rule" />;
        }
      })}
    </div>
  );
}
