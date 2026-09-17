import { beforeEach, describe, expect, it } from 'vitest';

import { CommandHistory } from './history';
import {
  AddEventCommand,
  DeleteEventCommand,
  UpdateEventCommand,
  type EventObjectStore,
} from './event-commands';
import type { EventRecord } from './events';

/** Plain-map store, matching what the narrow contract is for. */
class MapEventStore implements EventObjectStore {
  private readonly events = new Map<string, EventRecord>();

  get(id: string): EventRecord | undefined {
    return this.events.get(id);
  }

  all(): readonly EventRecord[] {
    return [...this.events.values()];
  }

  insert(event: EventRecord): void {
    this.events.set(event.id, event);
  }

  remove(id: string): void {
    this.events.delete(id);
    for (const [key, event] of this.events) {
      if (event.seriesId === id) this.events.delete(key);
    }
  }

  update(id: string, patch: Partial<Omit<EventRecord, 'id'>>): void {
    const current = this.events.get(id);
    if (current) this.events.set(id, { ...current, ...patch });
  }
}

const series: EventRecord = {
  id: 'seminar',
  title: 'Seminar',
  color: 'blue',
  date: new Date(2026, 8, 1),
  rrule: 'FREQ=WEEKLY;BYDAY=TU',
};

const override: EventRecord = {
  id: 'moved',
  title: 'Seminar (room change)',
  color: 'blue',
  date: new Date(2026, 8, 15),
  seriesId: 'seminar',
  occurrenceDate: new Date(2026, 8, 15),
};

describe('event commands', () => {
  let store: MapEventStore;
  let history: CommandHistory;

  beforeEach(() => {
    store = new MapEventStore();
    history = new CommandHistory();
  });

  it('adds and removes an event symmetrically', () => {
    history.execute(new AddEventCommand(store, series));
    expect(store.get('seminar')).toBeDefined();

    history.undo();
    expect(store.get('seminar')).toBeUndefined();

    history.redo();
    expect(store.get('seminar')).toBeDefined();
  });

  it('labels a repeating event distinctly', () => {
    expect(new AddEventCommand(store, series).label).toBe('Add repeating event');
    expect(new AddEventCommand(store, { ...series, rrule: undefined }).label).toBe('Add event');
  });

  it('restores a deleted series together with its overrides', () => {
    store.insert(series);
    store.insert(override);

    history.execute(new DeleteEventCommand(store, 'seminar'));
    expect(store.all()).toEqual([]);

    // Undo must not bring the series back having silently lost the occurrence
    // the user had edited.
    history.undo();
    expect(store.all().map((e) => e.id).sort()).toEqual(['moved', 'seminar']);
  });

  it('reverts only the fields an update touched', () => {
    store.insert(series);
    history.execute(new UpdateEventCommand(store, 'seminar', { title: 'Reading group' }));
    expect(store.get('seminar')!.title).toBe('Reading group');
    expect(store.get('seminar')!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU');

    history.undo();
    expect(store.get('seminar')!.title).toBe('Seminar');
    expect(store.get('seminar')!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU');
  });

  it('restores a field that was previously absent', () => {
    store.insert({ ...series, rrule: undefined });
    history.execute(
      new UpdateEventCommand(store, 'seminar', { rrule: 'FREQ=WEEKLY;BYDAY=TU' }, 'Repeat weekly'),
    );
    expect(store.get('seminar')!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU');

    history.undo();
    expect(store.get('seminar')!.rrule).toBeUndefined();
  });

  it('survives a mixed run of edits undone and redone in full', () => {
    history.execute(new AddEventCommand(store, series));
    history.execute(new UpdateEventCommand(store, 'seminar', { title: 'Reading group' }));
    history.execute(new AddEventCommand(store, override));
    history.execute(new DeleteEventCommand(store, 'seminar'));
    expect(store.all()).toEqual([]);

    history.undo();
    history.undo();
    history.undo();
    history.undo();
    expect(store.all()).toEqual([]);

    history.redo();
    history.redo();
    history.redo();
    expect(store.get('seminar')!.title).toBe('Reading group');
    expect(store.get('moved')).toBeDefined();
  });
});
