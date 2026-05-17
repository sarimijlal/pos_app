-- Replace the global unique constraint on imei_units.imei with a partial
-- unique index scoped to in_stock status only. This allows the same IMEI
-- to be purchased again after it has been sold (buy-back scenario).
DROP INDEX IF EXISTS `imei_units_imei_unique`;
CREATE UNIQUE INDEX `uq_imei_in_stock` ON `imei_units` (`imei`) WHERE `status` = 'in_stock';
