import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client/wasm";

/**
 * Prisma on Cloudflare Workers.
 *
 * Hyperdrive holds the actual PostgreSQL connection pool on the Cloudflare edge.
 * Inside the worker isolate, we keep a lightweight single-connection client
 * with aggressive idle timeout so frozen isolates never reuse dead TCP sockets.
 */
const clients = new Map<string, PrismaClient>();

export function getPrisma(connectionString: string): PrismaClient {
  const cached = clients.get(connectionString);
  if (cached) return cached;

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  clients.set(connectionString, client);
  return client;
}

export type { PrismaClient };
