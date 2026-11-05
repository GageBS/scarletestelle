import { customAlphabet } from "nanoid";

const alpha = "0123456789abcdefghijklmnopqrstuvwxyz";
/** short row id */
export const newId = customAlphabet(alpha, 14);
/** unguessable token for client-facing links (portal, proposal, invoice…) */
export const newToken = customAlphabet(
  "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
  28,
);
export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
