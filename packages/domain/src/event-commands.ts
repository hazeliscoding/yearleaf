/**
 * Undoable mutations of the desk's events.
 *
 * Events go through the same command architecture as everything else on the
 * desk: the architecture guardrails require every meaningful mutation to be
 * reversible, and a calendar whose repeating events cannot be undone is worse
 * than one that cannot repeat at all.
 */

import type { Command } from './commands';
import type { EventRecord } from './events';

/**
 * Minimal mutable store contract the event commands operate against.
 *
 * `all` exists because deleting a series must also take its overrides, and
 * undo has to put every one of them back.
 */
export interface EventObjectStore {
  /** Returns the event with the given id, if present. */
  get(id: string): EventRecord | undefined;
  /** Every stored event, for commands that need to snapshot related rows. */
  all(): readonly EventRecord[];
  /** Inserts an event. */
  insert(event: EventRecord): void;
  /** Removes an event, and any overrides belonging to it. */
  remove(id: string): void;
  /** Shallow-merges the patch into the event with the given id. */
  update(id: string, patch: Partial<Omit<EventRecord, 'id'>>): void;
}

/** Adds an event to the desk; undo removes it again. */
export class AddEventCommand implements Command {
  readonly label: string;

  /**
   * @param store - Store the event is inserted into.
   * @param event - The fully constructed event to add.
   */
  constructor(
    private readonly store: EventObjectStore,
    private readonly event: EventRecord,
  ) {
    this.label = event.rrule ? 'Add repeating event' : 'Add event';
  }

  execute(): void {
    this.store.insert(this.event);
  }

  undo(): void {
    this.store.remove(this.event.id);
  }
}

/**
 * Removes an event; undo restores it.
 *
 * Deleting a series cascades to the overrides that replaced individual
 * occurrences, so the snapshot covers those too — otherwise undo would bring
 * back the series having quietly lost every occurrence the user had edited.
 */
export class DeleteEventCommand implements Command {
  readonly label = 'Delete event';
  private snapshot: readonly EventRecord[] = [];

  /**
   * @param store - Store the event is removed from.
   * @param id - Identifier of the event to delete.
   */
  constructor(
    private readonly store: EventObjectStore,
    private readonly id: string,
  ) {}

  execute(): void {
    this.snapshot = this.store
      .all()
      .filter((event) => event.id === this.id || event.seriesId === this.id);
    this.store.remove(this.id);
  }

  undo(): void {
    for (const event of this.snapshot) this.store.insert(event);
  }
}

/** Changes an event's fields, e.g. renaming it or setting a recurrence rule. */
export class UpdateEventCommand implements Command {
  readonly label: string;
  /** The prior values of exactly the keys this command sets. */
  private before: Partial<Omit<EventRecord, 'id'>> = {};

  /**
   * @param store - Store holding the event.
   * @param id - Identifier of the event to change.
   * @param patch - Fields to set.
   * @param label - Human-readable description, e.g. `"Rename event"`.
   */
  constructor(
    private readonly store: EventObjectStore,
    private readonly id: string,
    private readonly patch: Partial<Omit<EventRecord, 'id'>>,
    label = 'Edit event',
  ) {
    this.label = label;
  }

  execute(): void {
    const current = this.store.get(this.id);
    if (current) {
      const before: Record<string, unknown> = {};
      for (const key of Object.keys(this.patch)) {
        before[key] = (current as unknown as Record<string, unknown>)[key];
      }
      this.before = before as Partial<Omit<EventRecord, 'id'>>;
    }
    this.store.update(this.id, this.patch);
  }

  undo(): void {
    this.store.update(this.id, this.before);
  }
}
