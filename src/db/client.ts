import Database from '@tauri-apps/plugin-sql';

let _db: Database | null = null;
let _loading: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  if (!_loading) {
    _loading = Database.load('sqlite:pos.db').catch(e => {
      _loading = null; // allow retry on next call
      throw e;
    });
  }
  _db = await _loading;
  return _db;
}
