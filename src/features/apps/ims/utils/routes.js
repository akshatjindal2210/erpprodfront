const IMS = "/ims/dashboard";

export const ROUTES = {
  IMS_DASHBOARD: IMS,
  DASHBOARD: IMS,
  TRAINING: `${IMS}/training`,

  PRODUCT_MASTER: `${IMS}/master/product-master`,
  CUSTOMER_MASTER: `${IMS}/master/customer-master`,
  CUSTOMER_ITEM_CODE: `${IMS}/master/customer-item-code`,
  PACKING_ENTRY: `${IMS}/master/packing-entry`,
  LOCATION_MASTER: `${IMS}/master/location-master`,

  PACKING_STANDARD: `${IMS}/packing-standard`,
  BOX_TABLE: `${IMS}/box`,
  STICKER_MANAGEMENT: `${IMS}/stickers/management`,
  STICKER_OVERRIDE: `${IMS}/stickers/override-customer`,

  INVENTORY_INWARD: `${IMS}/inventory-inward`,
  FORWARDING_NOTE: `${IMS}/forwarding-note`,
  OUT_ENTRY: `${IMS}/out-entry`,

  LOGS: `${IMS}/logs`,
  BOX_TRANSACTION_LOGS: `${IMS}/logs/box-transactions`,

  ANALYTICS: `${IMS}/inventory-report`,
  STOCK_ADJUSTMENT: `${IMS}/stock-adjustment`,
};
