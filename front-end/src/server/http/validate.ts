import type { Context } from "hono";
import type { z } from "zod";
import { ValidationError } from "./errors";

/**
 * Zod → the front-end's validation contract.
 *
 * `400 { errors: { field: "message" } }` — the FIRST issue per field, in
 * French, with nested paths flattened to dots (`lines.0.qty`). That is exactly
 * the shape the forms read.
 *
 * Zod is the whole validation layer: it needs no decorator metadata (which
 * Workers cannot provide), and it is the same validator the front-end forms
 * already use — so each rule is written once instead of once per dialect.
 */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    // First issue only — the contract shows one message per field.
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}

/** Parse a value or throw the 400 field-error response. */
export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(toFieldErrors(result.error));
  return result.data;
}

/** Validate the JSON body. A malformed body is a field error, not a 500. */
export async function body<T extends z.ZodType>(
  c: Context,
  schema: T,
): Promise<z.output<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError({ body: "Corps de requête JSON invalide." });
  }
  return parseOrThrow(schema, raw);
}

/** Validate the query string. Repeated keys collapse to the last value. */
export function query<T extends z.ZodType>(
  c: Context,
  schema: T,
): z.output<T> {
  return parseOrThrow(schema, c.req.query());
}

/** Validate the route params. */
export function params<T extends z.ZodType>(
  c: Context,
  schema: T,
): z.output<T> {
  return parseOrThrow(schema, c.req.param());
}

/**
 * Validate a `multipart/form-data` body. Every field arrives as a string, so
 * the schema is expected to coerce.
 */
export async function formBody<T extends z.ZodType>(
  c: Context,
  schema: T,
): Promise<{ data: z.output<T>; form: FormData }> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new ValidationError({ body: "Formulaire multipart invalide." });
  }

  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") raw[key] = value;
  }
  return { data: parseOrThrow(schema, raw), form };
}
