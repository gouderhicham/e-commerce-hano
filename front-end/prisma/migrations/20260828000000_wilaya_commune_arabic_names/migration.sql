-- Arabic names for the delivery zones.
--
-- The checkout wilaya/commune dropdowns were the last customer-facing text with
-- no Arabic column at all, so an Arabic shopper picked their address from a
-- French list. Nullable on purpose: a zone without a translation falls back to
-- its French name rather than rendering blank.
-- IF NOT EXISTS: an interrupted run of this migration can leave the columns in
-- place without the migration being recorded as finished, and a deploy that
-- cannot be re-run is a deploy that blocks every later migration.
ALTER TABLE "Wilaya" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;
ALTER TABLE "Commune" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;
