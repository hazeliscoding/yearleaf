/**
 * User-facing event mutations, each expressed as a domain command executed
 * through the history — the same single write path the desk objects use, so
 * creating, renaming or cancelling an event is undoable like everything else.
 */

import { Injectable, inject } from '@angular/core';

import {
  AddEventCommand,
  DeleteEventCommand,
  UpdateEventCommand,
  type EventRecord,
  type Occurrence,
} from '@infinite-desk/domain';

import { EventStore } from './event-store';
import { HistoryStore } from './history-store';
import { SelectionStore } from './selection-store';

@Injectable({ providedIn: 'root' })
export class EventActions {
  private readonly events = inject(EventStore);
  private readonly history = inject(HistoryStore);
  private readonly selection = inject(SelectionStore);

  /** Creates an untitled event on a day and selects it. */
  create(date: Date): string {
    const event: EventRecord = {
      id: `event${Date.now()}`,
      title: '',
      color: 'blue',
      date,
    };
    this.history.execute(new AddEventCommand(this.events, event));
    this.selection.select('event', event.id);
    return event.id;
  }

  /** Renames an event; clearing the title removes it, as for a text object. */
  setTitle(id: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) {
      this.remove(id);
      return;
    }
    this.history.execute(
      new UpdateEventCommand(this.events, id, { title: trimmed }, 'Rename event'),
    );
  }

  /** Deletes a stored event; a series takes its overrides with it. */
  remove(id: string): void {
    if (!this.events.get(id)) return;
    this.history.execute(new DeleteEventCommand(this.events, id));
    if (this.selection.selection()?.kind === 'event') this.selection.clear();
  }

  /**
   * Removes one occurrence.
   *
   * A stored occurrence is deleted outright. A computed one has no row to
   * delete, so it is suppressed by materialising a tombstone for that date —
   * RFC 5545's EXDATE, and undoable because it is just another added row.
   *
   * Cancelling one date is the only scope this handles: editing an occurrence
   * still needs the "this / this and following / all" choice.
   */
  removeOccurrence(occurrence: Occurrence): void {
    if (!occurrence.virtual) {
      this.remove(occurrence.event.id);
      return;
    }
    const tombstone: EventRecord = {
      id: `exdate${Date.now()}`,
      title: occurrence.event.title,
      color: occurrence.event.color,
      date: occurrence.date,
      seriesId: occurrence.event.id,
      occurrenceDate: occurrence.date,
      deleted: true,
    };
    this.history.execute(new AddEventCommand(this.events, tombstone));
    if (this.selection.selection()?.kind === 'event') this.selection.clear();
  }
}
