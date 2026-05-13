import { invoke } from '@tauri-apps/api/core';
import type { Item } from '../../../interfaces';
import type {
  MobileInventoryRow,
  AccessoryInventoryRow,
  ItemImeiRow,
  ImeiLookupResult,
} from '../../modules/inventory/types';

export async function getItems(): Promise<Item[]> {
  return invoke<Item[]>('get_items');
}

export async function insertItem(data: {
  name: string;
  item_type: 'mobile' | 'accessory';
}): Promise<number> {
  return invoke<number>('insert_item', { input: data });
}

export async function updateItem(input: {
  id: number;
  name: string;
}): Promise<void> {
  return invoke('update_item', { input });
}

export async function getInventoryMobiles(): Promise<MobileInventoryRow[]> {
  return invoke('get_inventory_mobiles');
}

export async function getInventoryAccessories(): Promise<AccessoryInventoryRow[]> {
  return invoke('get_inventory_accessories');
}

export async function getItemImeis(itemId: number): Promise<ItemImeiRow[]> {
  return invoke('get_item_imeis', { itemId });
}

export async function lookupImei(imei: string): Promise<ImeiLookupResult | null> {
  return invoke('lookup_imei', { imei });
}
