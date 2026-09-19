/**
 * User-facing event mutations, each expressed as a domain command executed
 * through the history — the same single write path the desk objects use, so
 * creating, renaming or cancelling an event is undoable like everything else.
 */

import { Injectable, inject } from '@angular/core';

import {
  AddEventCommand,
  CompositeCommand,
  DeleteEventCommand,
  UpdateEventCommand,
  dateKey,
  expandRecurrence,
  parseRecurrenceRule,
  ruleEnd,
  ruleForPreset,
  withRuleEnd,
  type Command,
  type EventRecord,
  type Occurrence,
  type RepeatEnd,
  type RepeatPreset,
  type StationeryColor,
} from '@infinite-desk/domain';

import { EventStore } from './event-store';
import { HistoryStore } from './history-store';
import { SelectionStore } from './selection-store';

/**
 * Reads a typed start time as a clock value, or refuses it.
 *
 * The domain documents `timeLabel` as a start time shown as written, e.g.
 * `"14:00"`, and the chip reserves room for it before the title. Storing
 * whatever was typed would let a sentence take the whole chip and push the
 * event's own name off the calendar — so an entry that is not a time is
 * refused rather than displayed. Accepts `9:30`, `09.30` and `9 30`, and pads
 * to two digits so the day cell reads in a single column.
 *
 * @returns The normalised label, `''` to mean all-day, or `null` to refuse.
 */
export function normaliseTimeLabel(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = /^(\d{1,2})[:. ]?(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

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
    this.selection.occurrence.set(this.occurrenceFor(event));
    return event.id;
  }

  /**
   * The occurrence the desk would draw today for a held one's date and event.
   *
   * `null` when nothing stands there any more, which leaves the caller to
   * decide what a snapshot of something gone should mean. An override is
   * matched through its `seriesId`, since materialising one replaces the
   * series' own row on that date with a row of its own.
   */
  private liveOccurrence(stale: Occurrence): Occurrence | null {
    const day = stale.date;
    return (
      [...this.events.occurrencesByDate({ from: day, to: day }).values()]
        .flat()
        .find(
          (occurrence) =>
            occurrence.event.id === stale.event.id ||
            occurrence.event.seriesId === stale.event.id,
        ) ?? null
    );
  }

  /**
   * The occurrence describing a stored event on its own date.
   *
   * Selecting an event without one used to be possible only in {@link create},
   * and the inspector edits exclusively through the occurrence — so the panel
   * drew every control against its fallbacks and wrote through none of them.
   *
   * Resolved by asking the store to expand rather than by assembling one, so
   * the event is described the same way the chips on the calendar are. There
   * is no ordering problem to work around: `occurrencesByDate` is a pure query
   * over stored events, not the viewport-scoped cache the renderer memoises,
   * and the command has already inserted the row synchronously. A plain event
   * yields exactly one occurrence, on the day it was created for.
   */
  private occurrenceFor(event: EventRecord): Occurrence | null {
    const day = event.occurrenceDate ?? event.date;
    return (
      [...this.events.occurrencesByDate({ from: day, to: day }).values()]
        .flat()
        .find((occurrence) => occurrence.event.id === event.id) ?? null
    );
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
   * Sets or clears an event's start time.
   *
   * Emptying the field is a real edit here, unlike {@link setTitle}: having no
   * time is precisely what makes an event all-day, so a cleared field has to
   * null the stored label rather than be refused.
   *
   * The variant has to travel with the time, because the chip's treatment is
   * chosen from the variant alone — set one without the other and a newly timed
   * event keeps the solid all-day fill it no longer deserves. But `EventVariant`
   * carries two unrelated things under one name: whether a chip draws as timed
   * or all-day, and whether it is tentative or completed. Only the first
   * follows the clock, so a tentative or completed event keeps its status and
   * just gains a time. Rewriting it to `'timed'` would quietly discard
   * something the user set on purpose.
   *
   * An entry that is not a clock value is refused outright — see
   * {@link normaliseTimeLabel} for why displaying it would cost the event its
   * name on the calendar.
   */
  setTime(id: string, timeLabel: string): void {
    const event = this.events.get(id);
    if (!event) return;
    const trimmed = normaliseTimeLabel(timeLabel);
    if (trimmed === null) return;
    if ((event.timeLabel ?? '') === trimmed) return;

    const status = event.variant === 'tentative' || event.variant === 'completed';
    this.history.execute(
      new UpdateEventCommand(
        this.events,
        id,
        {
          timeLabel: trimmed || undefined,
          variant: status ? event.variant : trimmed ? 'timed' : 'allday',
        },
        'Set event time',
      ),
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
    // Changing how often it repeats does not change when it stops: "weekly,
    // 16 times" edited to monthly is still a commitment with a horizon, and
    // dropping the end here would quietly unbound it.
    const end = event.rrule ? this.endOf(event.rrule) : null;
    const rrule = preset ? withRuleEnd(ruleForPreset(preset, event.date), end) : undefined;
    // Carrying a count across a frequency change can also *shrink* the
    // horizon — monthly×4 reaches December, weekly×4 ends in September — so
    // the same sweep that guards setRepeatEnd runs here, or the chip past the
    // end this file promises cannot exist would exist by this route instead.
    const doomed = rrule ? this.beyondTheEnd(id, rrule, event.date) : [];
    const steps: Command[] = [
      new UpdateEventCommand(
        this.events,
        id,
        { rrule },
        withPruneCount(rrule ? 'Repeat event' : 'Stop repeating', doomed.length),
      ),
      ...doomed,
    ];
    this.history.execute(
      steps.length === 1 ? steps[0] : new CompositeCommand(steps, steps[0].label),
    );
  }

  /** The end a rule carries, with garbage read as forever rather than thrown. */
  private endOf(rrule: string): RepeatEnd | null {
    try {
      return ruleEnd(rrule);
    } catch {
      return null;
    }
  }

  /**
   * Delete-steps for every series row past a rule's final date.
   *
   * Empty for a rule that runs forever. For a count the expansion window's
   * far edge never binds — the walk returns the moment the count is reached.
   */
  private beyondTheEnd(id: string, rrule: string, anchor: Date): Command[] {
    const end = this.endOf(rrule);
    if (!end) return [];
    const dates = expandRecurrence(parseRecurrenceRule(rrule), anchor, {
      from: anchor,
      to: 'until' in end ? end.until : new Date(9999, 0, 1),
    });
    // A count the window could not reach means the true final date lies
    // beyond anything this expansion saw — FREQ=YEARLY;INTERVAL=10000;COUNT=2
    // ends in the year 12026 — and a boundary guessed from a truncated walk
    // is a boundary that prunes legitimate rows. Not knowing where the end
    // is means not pruning. (Today the misprune happens to be masked by
    // dateKey ordering five-digit years before four-digit ones, but two
    // defects cancelling is not a state to depend on.)
    if ('count' in end && dates.length < end.count) return [];
    const last = dates.at(-1);
    const lastKey = last ? dateKey(last) : dateKey(anchor);
    const steps: Command[] = [];
    for (const row of this.events.events()) {
      if (row.seriesId !== id || !row.occurrenceDate) continue;
      if (dateKey(row.occurrenceDate) > lastKey) {
        steps.push(new DeleteEventCommand(this.events, row.id));
      }
    }
    return steps;
  }

  /**
   * Changes when a series stops: on a date, after a count, or never.
   *
   * Shortening takes the series rows beyond the new final date with it —
   * overrides and cancelled dates alike, in the same undoable step. The user
   * has said the series ends on X; a chip past X still claiming to belong to
   * it would contradict the statement. This is the rule series deletion
   * already follows, met at a boundary instead of everywhere.
   *
   * An `until` before the series' own anchor is refused: it describes a
   * series with zero occurrences, which the calendar never draws — an
   * invisible row nothing can select or delete. The inspector refuses it
   * visibly; this guard is the belt under those braces.
   */
  setRepeatEnd(id: string, end: RepeatEnd | null): void {
    const event = this.events.get(id);
    if (!event || event.seriesId || !event.rrule) return;
    if (end && 'until' in end && dateKey(end.until) < dateKey(event.date)) return;
    if (end && 'count' in end && (!Number.isInteger(end.count) || end.count < 1)) return;

    let rrule: string;
    try {
      rrule = withRuleEnd(event.rrule, end);
    } catch {
      return;
    }
    if (rrule === event.rrule) return;

    // The history label carries the cost: "End repeat" over a step that also
    // removed two edited dates says less than it knows, and the moment that
    // matters is discovery an hour later, when undo has become expensive.
    const doomed = this.beyondTheEnd(id, rrule, event.date);
    const label = withPruneCount(end ? 'End repeat' : 'Repeat forever', doomed.length);
    const steps: Command[] = [
      new UpdateEventCommand(this.events, id, { rrule }, label),
      ...doomed,
    ];
    this.history.execute(steps.length === 1 ? steps[0] : new CompositeCommand(steps, label));
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
   * Three shapes, one meaning — that date is cancelled. A plain event is its
   * own occurrence and is deleted outright. A computed one has no row to
   * delete, so it is suppressed by materialising a tombstone for that date —
   * RFC 5545's EXDATE, and undoable because it is just another added row. A
   * materialised override already *is* the row for its date, so its own row is
   * marked deleted, which suppresses the date and keeps the words the user put
   * on it for undo to hand back.
   *
   * Cancelling one date is the only scope this handles: editing an occurrence
   * still needs the "this / this and following / all" choice.
   *
   * The occurrence handed in is re-resolved first, because the caller's is a
   * snapshot taken when the selection was made and the event may have changed
   * shape since. Giving a freshly created event a rule through the inspector
   * does exactly that: every occurrence of a recurring event is computed, so
   * the live one is `virtual`, while the held one still describes the one-off
   * it was created as. Trusting it deleted the whole series where clicking any
   * chip of that same series suppressed a single date — the same key meaning
   * two different things depending on how the event came to be selected.
   */
  removeOccurrence(stale: Occurrence): void {
    // Nothing stands on that date any more — already cancelled, or undone away
    // beneath the selection. That is not permission to delete the series it
    // used to belong to, which is what falling back to the snapshot bought:
    // the second press read `virtual: false` off a description of an event
    // that had since become a rule, and took the whole thing.
    const occurrence = this.liveOccurrence(stale);
    if (!occurrence) return;

    // A materialised occurrence already *is* the row for its date, so
    // cancelling it means marking that row suppressed rather than deleting it.
    // Removing it outright left the rule free to compute the date straight
    // back, so cancelling an occurrence the user had edited cancelled nothing.
    const { event } = occurrence;
    if (event.seriesId && event.occurrenceDate) {
      this.history.execute(
        new UpdateEventCommand(this.events, event.id, { deleted: true }, 'Cancel occurrence'),
      );
      // Like the other two routes out of here: the chip is gone, so leaving it
      // selected leaves the inspector editing a row that now exists only to
      // say the date is empty.
      if (this.selection.selection()?.kind === 'event') this.selection.clear();
      return;
    }

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

/** Suffixes a history label with the changed dates a shortening removed. */
function withPruneCount(label: string, removed: number): string {
  if (removed === 0) return label;
  return `${label} — removed ${removed} changed date${removed === 1 ? '' : 's'}`;
}
