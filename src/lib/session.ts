/* Session token helpers — no Next imports, so proxy.ts can use them too. */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "se_studio";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 chars — set it in .env.local",
    );
  }
  return new TextEncoder().encode(s);
}

export async function signSession() {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    return payload.role === "owner";
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
};
