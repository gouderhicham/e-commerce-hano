-- Cash on delivery: an order is never "awaiting payment". Orders that carried
-- the PAIEMENT_EN_ATTENTE status become NOUVELLE; whether they are paid is
-- already tracked by paymentStatus.
UPDATE "Order" SET "status" = 'NOUVELLE' WHERE "status"::text = 'PAIEMENT_EN_ATTENTE';

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('NOUVELLE', 'EN_TRAITEMENT', 'PRETE_A_LIVRER', 'LIVREE', 'ANNULEE');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'NOUVELLE';
COMMIT;
