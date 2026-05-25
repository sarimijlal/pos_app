DROP INDEX IF EXISTS `imei_units_imei_unique`;
CREATE UNIQUE INDEX `uq_imei_in_stock` ON `imei_units` (`imei`) WHERE `status` = 'in_stock';