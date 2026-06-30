import { createHash, timingSafeEqual } from "crypto";

// SERVER-ONLY single-user access gate. The password is NEVER in the client bundle nor the public
// repo — it lives in the Vercel env var ARCANUM_ACCESS_PASSWORD and is validated here, server-side.
// Only this logic (which READS the env var) is in the code. Import ONLY from route handlers.

export const ACCESS_EMAIL = "armandofloressal@gmail.com";
export const GATE_COOKIE = "arcanum_gate";

/** The opaque session token = a hash of the configured password (so the cookie never carries the
 *  password itself). Recomputed server-side to validate a cookie. null when not configured. */
export function gateToken(): string | null {
  const pw = process.env.ARCANUM_ACCESS_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update("arcanum:gate:" + pw).digest("hex");
}

/** Constant-time check of a submitted email+password against the fixed user + the env password. */
export function checkCredentials(email: string, password: string): boolean {
  const pw = process.env.ARCANUM_ACCESS_PASSWORD;
  if (!pw) return false;
  if (email.trim().toLowerCase() !== ACCESS_EMAIL) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(pw);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal length
  return timingSafeEqual(a, b);
}
