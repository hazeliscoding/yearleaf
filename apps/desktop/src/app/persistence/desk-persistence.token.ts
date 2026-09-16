/**
 * Injection seam for the storage adapter, per the architecture record:
 * desktop-only capabilities are reached through interfaces, never imported
 * directly into shared code. Under Tauri this is SQLite; in a plain browser
 * (`ng serve` outside the shell, tests) it falls back to the in-memory
 * adapter so the app still runs, just without durability.
 */

import { InjectionToken } from '@angular/core';
import { isTauri } from '@tauri-apps/api/core';

import { InMemoryDeskPersistence, type DeskPersistence } from '@infinite-desk/persistence';

import { SQLitePersistence } from './sqlite-persistence';

export const DESK_PERSISTENCE = new InjectionToken<DeskPersistence>('DESK_PERSISTENCE', {
  providedIn: 'root',
  factory: () => (isTauri() ? new SQLitePersistence() : new InMemoryDeskPersistence()),
});
