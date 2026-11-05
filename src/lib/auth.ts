import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySessionToken,
} from "@/lib/session";

/** True when the current request carries a valid studio session. */
export async function isStudio() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Call at the top of EVERY studio page and server action.
 * The proxy also guards /studio, but server actions must check for themselves.
 */
export async function requireStudio() {
  if (!(await isStudio())) redirect("/studio/login");
}

/** Check a login attempt against STUDIO_PASSWORD_HASH (bcrypt) or STUDIO_PASSWORD. */
export async function checkPassword(attempt: string) {
  const hash = process.env.STUDIO_PASSWORD_HASH;
  if (hash) return bcrypt.compare(attempt, hash);
  const plain = process.env.STUDIO_PASSWORD;
  if (!plain) return false;
  // constant-time-ish compare
  if (attempt.length !== plain.length) return false;
  let diff = 0;
  for (let i = 0; i < plain.length; i++) diff |= attempt.charCodeAt(i) ^ plain.charCodeAt(i);
  return diff === 0;
}

export async function startSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(), sessionCookieOptions);
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
