import path from "node:path";
import process from "node:process";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration (`package.json#prisma` is deprecated in 6 and gone
 * in 7).
 *
 * A config file does NOT load `.env` the way the old key did, so it is loaded
 * explicitly here — without it every CLI command fails with "Environment
 * variable not found: DATABASE_URL".
 *
 * Guarded, because `loadEnvFile` OVERWRITES variables that are already set: an
 * explicit `DATABASE_URL=<production> npx prisma migrate deploy` would silently
 * run against the local database instead. An explicit value always wins.
 * `loadEnvFile` also throws when the file is absent — normal in CI, where the
 * variables come from the environment.
 */
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(path.join(__dirname, ".env"));
  } catch {
    // No .env — the variables are expected to be in the environment already.
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    // tsx runs the TypeScript seed directly, so it can import the app's own
    // domain modules — SHIP_FEE, the password hashing and the image policy are
    // shared with the running app rather than duplicated here.
    seed: "tsx prisma/seed.ts",
  },
});
