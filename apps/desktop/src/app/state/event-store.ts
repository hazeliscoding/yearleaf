/**
 * The desk's events.
 *
 * Only stored rows live here — series heads, plain events, and the overrides
 * that replace individual occurrences. The dates a series actually lands on
 * are computed per visible window by the domain, so a weekly seminar stays one
 * record no matter how far the user scrolls (docs/design-recurrence.md).
 */

import { Injectable, inject, signal } from '@angular/core';

import {
  dateKey,
  occurrencesInWindow,
  type EventRecord,
  type Occurrence,
} from '@infinite-desk/domain';

import { MONTH_CONTENT } from '../data/sample-desk';
import { DESK_PERSISTENCE } from '../persistence/desk-persistence.token';
import { DESK_ID } from './desk-store';

/**
 * The sample September as real, editable events.
 *
 * The demo desk was previously drawn from a constant, so its events could not
 * be renamed or removed. Seeding them as rows on first run keeps the desk
 * lived-in while making every chip on it real.
 */
function sampleEventRecords(): EventRecord[] {
  const seeded: EventRecord[] = [];
  for (const [day, content] of Object.entries(MONTH_CONTENT)) {
    content.events?.forEach((event, index) => {
      seeded.push({
        id: `seed-09-${day}-${index}`,
        title: event.title,
        timeLabel: event.time,
        color: event.color,
        variant: event.variant,
        date: new Date(2026, 8, Number(day)),
      });
    });
  }
  return seeded;
}

@Injectable({ providedIn: 'root' })
export class EventStore {
  private readonly persistence = inject(DESK_PERSISTENCE);

  /** Every stored event on the desk. */
  readonly events = signal<readonly EventRecord[]>([]);

  constructor() {
    void this.hydrate();
  }

  /** Loads stored events, seeding the sample month on a desk that has none. */
  private async hydrate(): Promise<void> {
    try {
      const stored = await this.persistence.loadEvents(DESK_ID);
      if (stored.length) {
        this.events.set(stored);
        return;
      }
      const seeded = sampleEventRecords();
      this.events.set(seeded);
      for (const event of seeded) await this.persistence.saveEvent(DESK_ID, event);
    } catch (error) {
      console.error('event hydration failed', error);
    }
  }

  /** Returns the event with the given id, if present. */
  get(id: string): EventRecord | undefined {
    return this.events().find((e) => e.id === id);
  }

  /**
   * Groups the occurrences falling in a window by date.
   *
   * @param window - Inclusive range, normally the months about to be drawn.
   * @returns Occurrences keyed by `YYYY-MM-DD`, in the order they should draw.
   */
  occurrencesByDate(window: { from: Date; to: Date }): ReadonlyMap<string, Occurrence[]> {
    const index = new Map<string, Occurrence[]>();
    for (const occurrence of occurrencesInWindow(this.events(), window)) {
      const key = dateKey(occurrence.date);
      const bucket = index.get(key);
      if (bucket) bucket.push(occurrence);
      else index.set(key, [occurrence]);
    }
    return index;
  }

  /** Adds an event and persists it. */
  insert(event: EventRecord): void {
    this.events.update((events) => [...events, event]);
    this.persist(this.persistence.saveEvent(DESK_ID, event));
  }

  /** Shallow-merges a patch into one event and persists the result. */
  update(id: string, patch: Partial<Omit<EventRecord, 'id'>>): void {
    let updated: EventRecord | undefined;
    this.events.update((events) =>
      events.map((event) => (event.id === id ? (updated = { ...event, ...patch }) : event)),
    );
    if (updated) this.persist(this.persistence.saveEvent(DESK_ID, updated));
  }

  /** Removes an event; a series takes its overrides with it. */
  remove(id: string): void {
    this.events.update((events) =>
      events.filter((event) => event.id !== id && event.seriesId !== id),
    );
    this.persist(this.persistence.deleteEvent(DESK_ID, id));
  }

  /** Fire-and-forget persistence write; failures are logged, never thrown. */
  private persist(work: Promise<void>): void {
    work.catch((error) => console.error('event persistence write failed', error));
  }
}
