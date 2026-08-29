-- Notification targets: every bell row now says what it is about, and carries
-- the id the back office must open (order sheet / contact message / product).

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER', 'MESSAGE', 'STOCK');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "contactMessageId" TEXT,
ADD COLUMN     "productId" INTEGER,
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'ORDER';

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: stock alerts used to be stored against the order that emptied the
-- stock, which sent the admin to the wrong page. Re-point them at the product.
UPDATE "Notification" n
   SET "type" = 'STOCK',
       "productId" = p."id",
       "orderId" = NULL
  FROM "Product" p
 WHERE (n."message" LIKE 'Rupture de stock%' OR n."message" LIKE 'Stock faible%')
   AND n."message" LIKE '%« ' || p."name" || ' »%';

UPDATE "Notification"
   SET "type" = 'STOCK',
       "orderId" = NULL
 WHERE "message" LIKE 'Rupture de stock%' OR "message" LIKE 'Stock faible%';

-- Backfill: contact-message alerts.
UPDATE "Notification" n
   SET "type" = 'MESSAGE',
       "contactMessageId" = m."id"
  FROM "ContactMessage" m
 WHERE n."message" = 'Nouveau message — ' || m."name" || ' : ' || m."subject";

UPDATE "Notification"
   SET "type" = 'MESSAGE'
 WHERE "message" LIKE 'Nouveau message%';

-- Cash on delivery is the only payment method: drop CARD.
UPDATE "Order" SET "method" = 'COD' WHERE "method"::text = 'CARD';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('COD');
ALTER TABLE "Order" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING ("method"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- Settings keeps only the Telegram relay; shop identity, shipping numbers and
-- storefront copy are now static (see src/common/shop-config.ts).
-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "catalogueGuarantees",
DROP COLUMN "deliveryNote",
DROP COLUMN "freeThreshold",
DROP COLUMN "notifyNewOrder",
DROP COLUMN "payCard",
DROP COLUMN "payCod",
DROP COLUMN "paymentText",
DROP COLUMN "paymentTitle",
DROP COLUMN "shipFee",
DROP COLUMN "shippingLabel",
DROP COLUMN "shopAddress",
DROP COLUMN "shopEmail",
DROP COLUMN "shopName",
DROP COLUMN "shopPhone",
DROP COLUMN "warranty";
