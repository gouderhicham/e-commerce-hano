import { Hono } from "hono";
import type { Context } from "hono";
import type { AppBindings } from "../env";
import { requireAdmin } from "../http/auth";
import { BadRequestError } from "../http/errors";
import { uploadImage } from "../infra/storage";

/**
 * Admin image upload for the product and content forms.
 *
 * No upload middleware: a Worker parses `multipart/form-data` with the
 * platform's own `request.formData()`, and the resulting `File` goes straight
 * into Postgres — there is no temp directory to configure.
 */
async function handleUpload(
  c: Context<AppBindings>,
  prefix: "products" | "categories" | "showcase",
) {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new BadRequestError("Formulaire multipart invalide.");
  }

  const file = form.get("file");
  const result = await uploadImage(
    c.var.prisma,
    c.env.PUBLIC_BASE_URL,
    prefix,
    file instanceof File ? file : null,
  );
  return c.json(result, 201);
}

export const uploadRoutes = new Hono<AppBindings>()
  .use("*", requireAdmin)
  .post("/product-image", (c) => handleUpload(c, "products"))
  .post("/category-image", (c) => handleUpload(c, "categories"))
  .post("/showcase-image", (c) => handleUpload(c, "showcase"));
