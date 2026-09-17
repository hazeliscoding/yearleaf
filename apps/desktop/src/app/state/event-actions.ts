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
  ruleForPreset,
  type EventRecord,
  type Occurrence,
  type RepeatPreset,
  type StationeryColor,
} from '@infinite-desk/domain';

import { EventStore } from './event-store';
import { HistoryStore } from './history-store';
import { SelectionStore } from './selection-store';

@Injectable({ providedIn: 'root' })
export class EventActions {
  private readonly events = inject(EventStore);
  private readonly history = inject(HistoryStore);
  private readonly selection = inject(SelectionStore);

  /** Monotonic suffix so rows created in the same millisecond differ. */
  private seq = 0;

  /** A fresh row id; a collision would make undo take out two rows at once. */
  private nextId(prefix: string): string {
    return `${prefix}${Date.now()}-${this.seq++}`;
  }

  /**
   * Creates a titled event on a day and selects it.
   *
   * Callers compose the title first and only create once there is one, so an
   * abandoned creation leaves nothing behind — including behind an undo.
   */
  create(date: Date, title: string): string {
    const event: EventRecord = { id: this.nextId('event'), title, color: 'blue', date };
    this.history.execute(new AddEventCommand(this.events, event));
    this.selection.select('event', event.id);
    return event.id;
  }

  /**
   * Renames an event.
   *
   * An empty title is refused rather than treated as a delete: the selected
   * chip may belong to a series, and clearing a text field must never be a way
   * to destroy a series and every occurrence the user had edited.
   */
  setTitle(id: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    this.history.execute(
      new UpdateEventCommand(this.events, id, { title: trimmed }, 'Rename event'),
    );
  }

  /**
   * Turns a computed occurrence into a real row so it can be edited on its own.
   *
   * This is the design record's governing rule: the first change to an
   * occurrence makes it an object that owns its properties from then on. A
   * stored occurrence is already one and is returned unchanged.
   *
   * @returns The id of the row representing that date.
   */
  materialise(occurrence: Occurrence): string {
    if (!occurrence.virtual) return occurrence.event.id;
    const override: EventRecord = {
      id: this.nextId('occurrence'),
      title: occurrence.event.title,
      timeLabel: occurrence.event.timeLabel,
      color: occurrence.event.color,
      variant: occurrence.event.variant,
      date: occurrence.date,
      seriesId: occurrence.event.id,
      occurrenceDate: occurrence.date,
    };
    this.history.execute(new AddEventCommand(this.events, override));
    return override.id;
  }

  /** Recolours an event. */
  setColor(id: string, color: StationeryColor): void {
    this.history.execute(
      new UpdateEventCommand(this.events, id, { color }, 'Recolour event'),
    );
  }

  /**
   * Sets or clears how an event repeats.
   *
   * The rule is anchored on the event's own date, so choosing "weekly" means
   * the weekday it already falls on rather than moving it.
   */
  setRepeat(id: string, preset: RepeatPreset | null): void {
    const event = this.events.get(id);
    // A rule belongs to the series. Storing one on an override would never be
    // expanded, but would still light the repeat glyph and read back as set.
    if (!event || event.seriesId) return;
    const rrule = preset ? ruleForPreset(preset, event.date) : undefined;
    this.history.execute(
      new UpdateEventCommand(
        this.events,
        id,
        { rrule },
        rrule ? 'Repeat event' : 'Stop repeating',
      ),
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
      id: this.nextId('exdate'),
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
