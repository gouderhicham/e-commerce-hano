-- The checkout only asks for wilaya + commune: the shop calls the customer to
-- arrange the drop-off, so the street address and the delivery note are gone.
-- Destructive: the addresses and notes of past orders are dropped with them.
ALTER TABLE "Order" DROP COLUMN "address",
DROP COLUMN "notes";
