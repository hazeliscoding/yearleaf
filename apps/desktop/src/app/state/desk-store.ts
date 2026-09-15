/**
 * The desk's object state: freely positioned objects, layers, and the
 * transient day-flash used by search/Today jumps.
 *
 * Implements the domain {@link DeskObjectStore} contract so commands from
 * `@infinite-desk/domain` mutate it — UI code routes every persistent
 * change through those commands (see HistoryStore), never writes directly.
 */

import { Injectable, signal } from '@angular/core';

import type { DeskObject, DeskObjectStore } from '@infinite-desk/domain';
import type { DbLayer } from '@infinite-desk/deskbound';

import { INITIAL_FLOATS, INITIAL_LAYERS } from '../data/sample-desk';

@Injectable({ providedIn: 'root' })
export class DeskStore implements DeskObjectStore {
  /** Freely positioned desk objects, in z-order. */
  readonly floats = signal<readonly DeskObject[]>([...INITIAL_FLOATS]);
  /** Layer panel rows. */
  readonly layers = signal<readonly DbLayer[]>([...INITIAL_LAYERS]);
  /** Day-of-month currently flash-highlighted after a jump, if any. */
  readonly flashDay = signal<number | null>(null);

  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  /** Returns the object with the given id, if present. */
  get(id: string): DeskObject | undefined {
    return this.floats().find((f) => f.id === id);
  }

  /** Inserts a new object at the top of the z-order. */
  insert(object: DeskObject): void {
    this.floats.update((floats) => [...floats, object]);
  }

  /** Removes the object with the given id. */
  remove(id: string): void {
    this.floats.update((floats) => floats.filter((f) => f.id !== id));
  }

  /** Shallow-merges a patch into the object with the given id. */
  update(id: string, patch: Partial<Omit<DeskObject, 'id'>>): void {
    this.floats.update((floats) =>
      floats.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  /** Toggles a layer's visibility by row index. */
  toggleLayerVisibility(index: number): void {
    this.layers.update((layers) =>
      layers.map((layer, i) =>
        i === index ? { ...layer, visible: layer.visible === false } : layer,
      ),
    );
  }

  /** Flash-highlights a day cell for ~1.8s after a search or Today jump. */
  flash(day: number): void {
    this.flashDay.set(day);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flashDay.set(null), 1800);
  }
}
