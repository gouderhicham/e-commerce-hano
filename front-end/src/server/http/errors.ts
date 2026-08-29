import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { translateErrors, translateMessage } from "../domain/messages";
import { localeFromHeaders } from "../domain/locale";

const INTERNAL_ERROR_FR = "Erreur interne du serveur.";

/**
 * The API's error contract - the exact shapes the storefront's forms read:
 *
 *   validation  400 `{ errors: { field: "message" } }`
 *   everything  4xx `{ error: "message" }`
 *   unexpected  500 `{ error: "Erreur interne du serveur." }`
 *
 * Messages are authored in French throughout the codebase and translated HERE,
 * once, from the request's `x-locale` header.
 */

/** A 400 carrying per-field messages, the shape the front-end forms read. */
export class ValidationError extends HTTPException {
  constructor(public readonly errors: Record<string, string>) {
    super(400, { message: "Validation failed" });
  }
}

/**
 * Named errors, one per status the API answers with, so a handler states its
 * intent instead of threading a number through.
 */
export class BadRequestError extends HTTPException {
  constructor(message: string) {
    super(400, { message });
  }
}

export class UnauthorizedError extends HTTPException {
  constructor(message: string) {
    super(401, { message });
  }
}

export class ForbiddenError extends HTTPException {
  constructor(message: string) {
    super(403, { message });
  }
}

export class NotFoundError extends HTTPException {
  constructor(message: string) {
    super(404, { message });
  }
}

export class ConflictError extends HTTPException {
  constructor(message: string) {
    super(409, { message });
  }
}

/** Throw a 400 carrying per-field messages. */
export function badRequest(errors: Record<string, string>): never {
  throw new ValidationError(errors);
}

/**
 * Hono's `onError`. Mirrors the old `AllExceptionsFilter`, including the rule
 * that an unexpected error is logged in full but answered with an opaque
 * message — stack traces never reach the client.
 */
export function handleError(err: Error, c: Context): Response {
  const locale = localeFromHeaders(
    Object.fromEntries(c.req.raw.headers) as Record<string, string>,
  );

  if (err instanceof ValidationError) {
    return c.json({ errors: translateErrors(err.errors, locale) }, 400);
  }

  if (err instanceof HTTPException) {
    return c.json(
      { error: translateMessage(err.message, locale) },
      err.status,
    );
  }

  console.error(
    `Unhandled exception on ${c.req.method} ${c.req.path}`,
    err instanceof Error ? err.stack : String(err),
  );
  return c.json({ error: translateMessage(INTERNAL_ERROR_FR, locale) }, 500);
}
