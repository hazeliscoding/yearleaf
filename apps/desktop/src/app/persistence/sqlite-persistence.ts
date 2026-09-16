/**
 * Desktop implementation of {@link DeskPersistence}: each method invokes the
 * matching typed Tauri command, which executes parameterized SQL in Rust
 * (design record: docs/design-sqlite-persistence.md). No SQL crosses IPC.
 */

import { invoke } from '@tauri-apps/api/core';

import type { DeskObject } from '@infinite-desk/domain';
import type { DeskPersistence, DeskSnapshot } from '@infinite-desk/persistence';

export class SQLitePersistence implements DeskPersistence {
  async loadDesk(deskId: string): Promise<DeskSnapshot | null> {
    return await invoke<DeskSnapshot | null>('load_desk', { deskId });
  }

  async saveObject(deskId: string, object: DeskObject): Promise<void> {
    await invoke('save_object', { deskId, object });
  }

  async deleteObject(deskId: string, objectId: string): Promise<void> {
    await invoke('delete_object', { deskId, objectId });
  }
}
