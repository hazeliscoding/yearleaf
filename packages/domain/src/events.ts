/**
 * Events and the occurrences they produce.
 *
 * A repeating event is stored once; the dates it lands on are computed for the
 * window being drawn. Touching one occurrence stores a row that overrides the
 * series on that date, which is how a moved or annotated occurrence keeps its
 * changes without the series expanding into rows (docs/design-recurrence.md).
 */

import type { StationeryColor } from './objects';
import { expandRecurrence, parseRecurrenceRule, type DateWindow } from './recurrence';

/** Visual/status variant of an event chip. */
export type EventVariant = 'timed' | 'allday' | 'tentative' | 'completed';

/**
 * An event as stored: a plain event, the head of a series, or a materialised
 * occurrence overriding one of a series' dates.
 */
export interface EventRecord {
  /** Row id, shared with the owning `calendar_object`. */
  readonly id: string;
  readonly title: string;
  /** Start time as displayed, e.g. `"14:00"`; absent for all-day events. */
  readonly timeLabel?: string;
  readonly color: StationeryColor;
  readonly variant?: EventVariant;
  /**
   * The date this row sits on. For a series head this is the anchor the rule
   * counts from (`DTSTART`).
   */
  readonly date: Date;
  /** `RRULE` body when this row heads a series. */
  readonly rrule?: string;
  /** The series this row overrides; set together with {@link occurrenceDate}. */
  readonly seriesId?: string;
  /** The date within that series this row replaces. */
  readonly occurrenceDate?: Date;
  /** Suppresses the occurrence instead of replacing it (an RFC 5545 EXDATE). */
  readonly deleted?: boolean;
}

/** One occurrence to draw. */
export interface Occurrence {
  /**
   * Stable identity: the row id for a stored occurrence, or a derived
   * `<series-id>:<date>` for one that exists only as a computation.
   */
  readonly id: string;
  /** The date it falls on. */
  readonly date: Date;
  /** The event supplying its content — the override when one exists. */
  readonly event: EventRecord;
  /**
   * `true` while the occurrence is computed from the rule and has no row.
   * A virtual occurrence draws in its day cell; moving one materialises it.
   */
  readonly virtual: boolean;
}

/** `YYYY-MM-DD` key for a floating date. */
export function dateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** `true` when the date falls inside the inclusive window. */
function inWindow(date: Date, window: DateWindow): boolean {
  const key = dateKey(date);
  return key >= dateKey(window.from) && key <= dateKey(window.to);
}

/**
 * Resolves the events visible in a window into concrete occurrences.
 *
 * Plain events appear as themselves. A series contributes one occurrence per
 * date its rule produces, except where a stored override replaces it — or
 * suppresses it, when the override is a tombstone.
 *
 * An override whose date the rule no longer produces is **still returned**.
 * It is a real object holding real user work, and a rule edit must not make it
 * disappear; it simply no longer belongs to the series.
 *
 * @param events - Every stored event row for the desk.
 * @param window - Inclusive date range being drawn, typically the visible months.
 * @returns Occurrences in ascending date order.
 */
export function occurrencesInWindow(
  events: readonly EventRecord[],
  window: DateWindow,
): Occurrence[] {
  const overridesBySeries = new Map<string, Map<string, EventRecord>>();
  for (const event of events) {
    if (!event.seriesId || !event.occurrenceDate) continue;
    let byDate = overridesBySeries.get(event.seriesId);
    if (!byDate) overridesBySeries.set(event.seriesId, (byDate = new Map()));
    byDate.set(dateKey(event.occurrenceDate), event);
  }

  const found: Occurrence[] = [];

  for (const event of events) {
    // A materialised occurrence is an ordinary stored object; a tombstone is
    // only a suppression marker and draws nothing.
    if (event.seriesId && event.occurrenceDate) {
      if (!event.deleted && inWindow(event.occurrenceDate, window)) {
        found.push({ id: event.id, date: event.occurrenceDate, event, virtual: false });
      }
      continue;
    }

    if (!event.rrule) {
      if (inWindow(event.date, window)) {
        found.push({ id: event.id, date: event.date, event, virtual: false });
      }
      continue;
    }

    const overrides = overridesBySeries.get(event.id);
    const rule = parseRecurrenceRule(event.rrule);
    for (const date of expandRecurrence(rule, event.date, window)) {
      // An overridden date is represented by its stored row, which was already
      // emitted above (or deliberately suppressed).
      if (overrides?.has(dateKey(date))) continue;
      found.push({
        id: `${event.id}:${dateKey(date)}`,
        date,
        event,
        virtual: true,
      });
    }
  }

  return found.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
}
