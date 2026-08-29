import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  hashPassword,
  isLegacyHash,
  needsRehash,
  verifyPassword,
} from "@/server/infra/password";
import { signSession, verifySession } from "@/server/infra/jwt";
import { durationToSeconds, sessionCookieOptions } from "@/server/infra/cookies";

const SECRET = "test-secret-not-a-real-key";

describe("password hashing", () => {
  it("round-trips a password", async () => {
    const digest = await hashPassword("client123");
    expect(await verifyPassword("client123", digest)).toBe(true);
    expect(await verifyPassword("client124", digest)).toBe(false);
  });

  it("salts: the same password never produces the same digest twice", async () => {
    const [a, b] = await Promise.all([
      hashPassword("client123"),
      hashPassword("client123"),
    ]);
    expect(a).not.toBe(b);
  });

  it("still accepts older bcrypt digests", async () => {
    // What a pre-PBKDF2 account would have stored, at its cost factor.
    const legacy = bcrypt.hashSync("admin123", 10);
    expect(isLegacyHash(legacy)).toBe(true);
    expect(await verifyPassword("admin123", legacy)).toBe(true);
    expect(await verifyPassword("wrong", legacy)).toBe(false);
  });

  it("flags legacy digests for upgrade and fresh ones as current", async () => {
    expect(needsRehash(bcrypt.hashSync("admin123", 10))).toBe(true);
    expect(needsRehash(await hashPassword("admin123"))).toBe(false);
  });

  it("treats a malformed digest as a failed login, not a crash", async () => {
    for (const junk of ["", "not-a-hash", "pbkdf2-sha256$$$", "$2x$broken"]) {
      expect(await verifyPassword("anything", junk)).toBe(false);
    }
  });
});

describe("session tokens", () => {
  it("round-trips the claims the guards read", async () => {
    const token = await signSession({ sub: "usr_1", role: "ADMIN" }, SECRET, "7d");
    expect(await verifySession(token, SECRET)).toEqual({
      sub: "usr_1",
      role: "ADMIN",
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession({ sub: "usr_1", role: "ADMIN" }, SECRET, "7d");
    expect(await verifySession(token, "another-secret")).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSession({ sub: "usr_1", role: "CLIENT" }, SECRET, "0s");
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it("rejects garbage rather than throwing", async () => {
    for (const junk of ["", "abc", "a.b.c"]) {
      expect(await verifySession(junk, SECRET)).toBeNull();
    }
  });

  it("refuses a role the app does not define", async () => {
    // A token whose signature is valid but whose role claim is not one of ours
    // must not resolve to a user — otherwise an unknown role reads as "not
    // ADMIN but logged in", which is a state no guard was written for.
    const token = await signSession(
      { sub: "usr_1", role: "SUPERUSER" as "ADMIN" },
      SECRET,
      "7d",
    );
    expect(await verifySession(token, SECRET)).toBeNull();
  });
});

describe("session cookie", () => {
  it("parses the JWT-style durations the config uses", () => {
    expect(durationToSeconds("7d")).toBe(604800);
    expect(durationToSeconds("12h")).toBe(43200);
    expect(durationToSeconds("30m")).toBe(1800);
    expect(durationToSeconds("3600s")).toBe(3600);
    expect(durationToSeconds("3600")).toBe(3600);
  });

  it("falls back to 7 days on an unparseable duration", () => {
    expect(durationToSeconds("banana")).toBe(604800);
  });

  it("is always httpOnly, and Secure only over https", () => {
    expect(sessionCookieOptions(true, 60)).toMatchObject({
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      path: "/",
    });
    // Plain http on localhost: a Secure cookie would simply never be stored.
    expect(sessionCookieOptions(false, 60).secure).toBe(false);
  });
});
