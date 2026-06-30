import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkCredentials, gateToken, ACCESS_EMAIL } from "@/lib/access";

// A THROWAWAY value — NEVER the real production password (public repo; the real one lives only in
// the Vercel env var). The behaviour of checkCredentials/gateToken is identical for any value.
const TEST_PW = "test-pw-not-the-real-one";

describe("access gate — env-var single-user login (password never in code)", () => {
  beforeEach(() => {
    process.env.ARCANUM_ACCESS_PASSWORD = TEST_PW;
  });
  afterEach(() => {
    delete process.env.ARCANUM_ACCESS_PASSWORD;
  });

  it("accepts the fixed email + the env password (constant-time)", () => {
    expect(checkCredentials(ACCESS_EMAIL, TEST_PW)).toBe(true);
    expect(checkCredentials(ACCESS_EMAIL.toUpperCase(), TEST_PW)).toBe(true); // email case-insensitive
  });

  it("rejects a wrong password or a wrong email", () => {
    expect(checkCredentials(ACCESS_EMAIL, "wrong")).toBe(false);
    expect(checkCredentials(ACCESS_EMAIL, TEST_PW.slice(0, -1))).toBe(false); // off by one char (length differs)
    expect(checkCredentials(ACCESS_EMAIL, TEST_PW + "x")).toBe(false); // off by one (same prefix)
    expect(checkCredentials("intruso@x.com", TEST_PW)).toBe(false);
  });

  it("derives a session token that is NOT the password, and is stable", () => {
    const t = gateToken()!;
    expect(t).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
    expect(t).not.toContain(TEST_PW);
    expect(gateToken()).toBe(t); // deterministic
  });

  it("with NO env var (e.g. local dev) the gate is unconfigured — token null, every login fails", () => {
    delete process.env.ARCANUM_ACCESS_PASSWORD;
    expect(gateToken()).toBeNull();
    expect(checkCredentials(ACCESS_EMAIL, "anything")).toBe(false);
  });
});
