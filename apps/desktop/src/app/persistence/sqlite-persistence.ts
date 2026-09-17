/**
 * Desktop implementation of {@link DeskPersistence}: each method invokes the
 * matching typed Tauri command, which executes parameterized SQL in Rust
 * (design record: docs/design-sqlite-persistence.md). No SQL crosses IPC.
 */

import { invoke } from '@tauri-apps/api/core';

import type { DeskObject, EventRecord } from '@infinite-desk/domain';
import type { DeskPersistence, DeskSnapshot } from '@infinite-desk/persistence';

import { toEventRecord, toEventWire, type EventWire } from './event-wire';

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

  async loadEvents(deskId: string): Promise<readonly EventRecord[]> {
    const wire = await invoke<EventWire[]>('load_events', { deskId });
    return wire.map(toEventRecord);
  }

  async saveEvent(deskId: string, event: EventRecord): Promise<void> {
    await invoke('save_event', { deskId, event: toEventWire(event) });
  }

  async deleteEvent(deskId: string, eventId: string): Promise<void> {
    await invoke('delete_event', { deskId, eventId });
  }
}
