import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client/wasm";

/**
 * Prisma on Cloudflare Workers with Hyperdrive.
 *
 * Hyperdrive provides native connection pooling at Cloudflare's Edge.
 * Creating the Prisma client per request ensures no frozen TCP sockets
 * or hanging event loops between isolate lifecycles.
 */
export function getPrisma(connectionString: string): PrismaClient {
  const adapter = new PrismaPg(
    { connectionString },
    {
      onPoolError: (err) => {
        console.warn("[PrismaPg pool]", err.message);
      },
      onConnectionError: (err) => {
        console.warn("[PrismaPg connection]", err.message);
      },
    },
  );
  return new PrismaClient({ adapter });
}

export type { PrismaClient };
