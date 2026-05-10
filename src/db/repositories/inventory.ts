import { invoke } from '@tauri-apps/api/core';
import type { Item } from '../../../interfaces';

export async function getItems(): Promise<Item[]> {
  return invoke<Item[]>('get_items');
}

export async function insertItem(data: {
  name: string;
  item_type: 'mobile' | 'accessory';
}): Promise<number> {
  return invoke<number>('insert_item', { input: data });
}
