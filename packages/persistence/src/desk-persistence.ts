/**
 * Persistence contracts for the desk.
 *
 * Platform-specific adapters (SQLite through Tauri commands on desktop,
 * IndexedDB in the browser later) implement {@link DeskPersistence}; shared
 * packages and the application depend only on this interface, never on a
 * concrete storage technology.
 */

import type { DeskObject } from '@infinite-desk/domain';

/** A saved desk: identity plus every object placed on it. */
export interface DeskSnapshot {
  /** Stable desk identifier. */
  readonly deskId: string;
  /** Display name shown in desk management UI. */
  readonly name: string;
  /** Every freely positioned object on the desk. */
  readonly objects: readonly DeskObject[];
}

/**
 * Storage boundary for desks and their objects.
 *
 * All methods are asynchronous because the desktop implementation crosses
 * the Tauri IPC boundary; implementations must be safe to call from the
 * UI thread at gesture-commit frequency (once per finished gesture, never
 * once per pointer move).
 */
export interface DeskPersistence {
  /** Loads a desk snapshot, or `null` when the desk does not exist. */
  loadDesk(deskId: string): Promise<DeskSnapshot | null>;
  /** Creates or replaces the stored state of one object. */
  saveObject(deskId: string, object: DeskObject): Promise<void>;
  /** Removes one object from the desk. */
  deleteObject(deskId: string, objectId: string): Promise<void>;
}

/**
 * In-memory {@link DeskPersistence} used by tests and by the application
 * until the SQLite adapter lands. Data lives only for the session.
 */
export class InMemoryDeskPersistence implements DeskPersistence {
  private readonly desks = new Map<string, Map<string, DeskObject>>();

  /**
   * Seeds a desk so `loadDesk` can return it.
   *
   * @param deskId - Identifier of the desk to create or replace.
   * @param objects - Initial objects placed on the desk.
   */
  seed(deskId: string, objects: readonly DeskObject[]): void {
    this.desks.set(deskId, new Map(objects.map((o) => [o.id, o])));
  }

  async loadDesk(deskId: string): Promise<DeskSnapshot | null> {
    const objects = this.desks.get(deskId);
    if (!objects) return null;
    return { deskId, name: deskId, objects: [...objects.values()] };
  }

  async saveObject(deskId: string, object: DeskObject): Promise<void> {
    let objects = this.desks.get(deskId);
    if (!objects) {
      objects = new Map();
      this.desks.set(deskId, objects);
    }
    objects.set(object.id, object);
  }

  async deleteObject(deskId: string, objectId: string): Promise<void> {
    this.desks.get(deskId)?.delete(objectId);
  }
}
