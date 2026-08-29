import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppBindings, AuthUser } from "../env";
import { USER_PUBLIC_SELECT } from "../http/auth";
import { UnauthorizedError, badRequest } from "../http/errors";
import { body } from "../http/validate";
import { durationToSeconds, isSecureRequest, sessionCookieOptions } from "../infra/cookies";
import { signSession } from "../infra/jwt";
import { hashPassword, needsRehash, verifyPassword } from "../infra/password";
import { afterResponse } from "../infra/notify";
import { byIp } from "../http/rate-limit";
import type { Context } from "hono";

const PHONE_REGEX = /^0[567]\d{8}$/;

const registerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  email: z.email("Email invalide."),
  phone: z.string().regex(PHONE_REGEX, "Numéro de téléphone invalide."),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères."),
});

const loginSchema = z.object({
  email: z.email("Email invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

/** Sign the session JWT and set it as the httpOnly cookie. */
async function issueSession(
  c: Context<AppBindings>,
  user: AuthUser,
): Promise<void> {
  const token = await signSession(
    { sub: user.id, role: user.role },
    c.env.JWT_SECRET,
    c.env.JWT_EXPIRES_IN,
  );
  setCookie(
    c,
    c.env.COOKIE_NAME,
    token,
    sessionCookieOptions(
      isSecureRequest(c.req.url),
      durationToSeconds(c.env.JWT_EXPIRES_IN),
    ),
  );
}

export const authRoutes = new Hono<AppBindings>()
  /** Register a CLIENT (rule 3: no admin registration) and log them in. */
  .post("/register", async (c) => {
    const dto = await body(c, registerSchema);

    const existing = await c.var.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    // Contract (PROMPTS §3): unique-email failure is a 400 field error.
    if (existing) badRequest({ email: "Cet email est déjà utilisé." });

    const user = await c.var.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash: await hashPassword(dto.password),
        role: "CLIENT",
      },
      select: USER_PUBLIC_SELECT,
    });

    await issueSession(c, user);
    return c.json({ user }, 201);
  })

  // Throttled at the edge; the old @Throttle({ limit: 5, ttl: 60s }) override.
  .post("/login", byIp, async (c) => {
    const dto = await body(c, loginSchema);

    const user = await c.var.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Verify even when the user is missing? No — bcrypt/PBKDF2 both cost real
    // CPU, and an unconditional hash on every unknown email is a free DoS
    // amplifier on a metered runtime. The 401 is identical either way.
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    // Transparently upgrade legacy bcrypt digests now that we know the
    // plaintext is correct — past the response, so login stays fast.
    if (needsRehash(user.passwordHash)) {
      afterResponse(
        c,
        hashPassword(dto.password).then((passwordHash) =>
          c.var.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
          }),
        ),
      );
    }

    const publicUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
      wilayaCode: user.wilayaCode,
      communeId: user.communeId,
      adresse: user.adresse,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    await issueSession(c, publicUser);
    return c.json({ user: publicUser });
  })

  .post("/logout", (c) => {
    deleteCookie(c, c.env.COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  })

  /** Optional auth: never throws — returns the current user or null. */
  .get("/me", (c) => c.json({ user: c.var.user }));
