import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma on Cloudflare Workers.
 *
 * Workers cannot open a TCP socket, so Prisma's own connection pool is not an
 * option: queries go through the `pg` driver adapter pointed at Hyperdrive's
 * local connection string, and Hyperdrive holds the real pool next to the
 * database.
 *
 * A Worker isolate handles many requests, so the client is cached per
 * connection string rather than constructed per request — but it is NOT a
 * module-level singleton, because each isolate gets its own `env` and a stale
 * client would outlive a binding change.
 */
const clients = new Map<string, PrismaClient>();

export function getPrisma(connectionString: string): PrismaClient {
  const cached = clients.get(connectionString);
  if (cached) return cached;

  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });
  clients.set(connectionString, client);
  return client;
}

export type { PrismaClient };
