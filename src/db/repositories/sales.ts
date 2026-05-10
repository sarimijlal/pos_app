import { invoke } from '@tauri-apps/api/core';
import type { Salesperson } from '../../../interfaces';

export async function getSalespersons(): Promise<Salesperson[]> {
  return invoke<Salesperson[]>('get_salespersons');
}

export async function insertSalesperson(data: { name: string }): Promise<number> {
  return invoke<number>('insert_salesperson', { input: data });
}
