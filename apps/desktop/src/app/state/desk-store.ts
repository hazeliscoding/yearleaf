/**
 * The desk's object state: freely positioned objects and the transient
 * day-flash used by search/Today jumps.
 *
 * Implements the domain {@link DeskObjectStore} contract so commands from
 * `@infinite-desk/domain` mutate it — UI code routes every persistent
 * change through those commands (see HistoryStore), never writes directly.
 * Because every command path (execute, undo, redo) lands in `insert`,
 * `remove`, or `update`, those three methods are also the persistence
 * write-through: each forwards the committed state to the storage adapter.
 */

import { Injectable, inject, signal } from '@angular/core';

import type { DeskObject, DeskObjectStore } from '@infinite-desk/domain';

import { INITIAL_FLOATS } from '../data/sample-desk';
import { DESK_PERSISTENCE } from '../persistence/desk-persistence.token';

/** The single desk of version 1; desk management arrives with schema growth. */
export const DESK_ID = 'default';

@Injectable({ providedIn: 'root' })
export class DeskStore implements DeskObjectStore {
  private readonly persistence = inject(DESK_PERSISTENCE);

  /** Freely positioned desk objects, in z-order. */
  readonly floats = signal<readonly DeskObject[]>([...INITIAL_FLOATS]);
  /** Day currently flash-highlighted after a jump, if any. */
  readonly flashDate = signal<Date | null>(null);

  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    void this.hydrate();
  }

  /**
   * Replaces the sample floats with the stored desk; on first run (no stored
   * desk) the sample desk is persisted as the initial content instead.
   */
  private async hydrate(): Promise<void> {
    try {
      const snapshot = await this.persistence.loadDesk(DESK_ID);
      if (snapshot) {
        this.floats.set([...snapshot.objects]);
        return;
      }
      for (const object of this.floats()) {
        await this.persistence.saveObject(DESK_ID, object);
      }
    } catch (error) {
      console.error('desk hydration failed', error);
    }
  }

  /** Fire-and-forget persistence write; failures are logged, never thrown. */
  private persist(work: Promise<void>): void {
    work.catch((error) => console.error('desk persistence write failed', error));
  }

  /** Returns the object with the given id, if present. */
  get(id: string): DeskObject | undefined {
    return this.floats().find((f) => f.id === id);
  }

  /** Inserts a new object at the top of the z-order. */
  insert(object: DeskObject): void {
    this.floats.update((floats) => [...floats, object]);
    this.persist(this.persistence.saveObject(DESK_ID, object));
  }

  /** Removes the object with the given id. */
  remove(id: string): void {
    this.floats.update((floats) => floats.filter((f) => f.id !== id));
    this.persist(this.persistence.deleteObject(DESK_ID, id));
  }

  /** Shallow-merges a patch into the object with the given id. */
  update(id: string, patch: Partial<Omit<DeskObject, 'id'>>): void {
    this.floats.update((floats) =>
      floats.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
    const updated = this.get(id);
    if (updated) this.persist(this.persistence.saveObject(DESK_ID, updated));
  }

  /** Flash-highlights a day cell for ~1.8s after a search or Today jump. */
  flash(date: Date): void {
    this.flashDate.set(date);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flashDate.set(null), 1800);
  }
}
