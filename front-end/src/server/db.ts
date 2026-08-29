import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client/wasm";

/**
 * Prisma on Cloudflare Workers.
 *
 * Workers connect to Hyperdrive, which handles pooling natively on Cloudflare's edge.
 */
const clients = new Map<string, PrismaClient>();

export function getPrisma(connectionString: string): PrismaClient {
  const cached = clients.get(connectionString);
  if (cached) return cached;

  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  clients.set(connectionString, client);
  return client;
}

export type { PrismaClient };
