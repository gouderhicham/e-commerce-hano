-- Uploaded images live in Postgres: a Worker has no disk and no long-lived TCP
-- socket, so there is nowhere else to put a file. `data` is a bytea; images are
-- compressed and capped in the application layer (domain/image-policy.ts).
CREATE TABLE "MediaObject" (
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("key")
);
