import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { EventRecord } from '@infinite-desk/domain';
import { InMemoryDeskPersistence } from '@infinite-desk/persistence';

import { DESK_PERSISTENCE } from '../persistence/desk-persistence.token';
import { EventActions, normaliseTimeLabel } from './event-actions';
import { EventStore } from './event-store';
import { SelectionStore } from './selection-store';
import { HistoryStore } from './history-store';

function seminar(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'seminar',
    title: 'Seminar',
    color: 'violet',
    date: new Date(2026, 8, 1),
    ...overrides,
  };
}

describe('normaliseTimeLabel', () => {
  it('accepts the ways people write a clock time and pads them alike', () => {
    expect(normaliseTimeLabel('9:30')).toBe('09:30');
    expect(normaliseTimeLabel('09.30')).toBe('09:30');
    expect(normaliseTimeLabel('9 30')).toBe('09:30');
    expect(normaliseTimeLabel(' 14:00 ')).toBe('14:00');
    expect(normaliseTimeLabel('0930')).toBe('09:30');
  });

  it('reads an empty field as all-day rather than refusing it', () => {
    expect(normaliseTimeLabel('')).toBe('');
    expect(normaliseTimeLabel('   ')).toBe('');
  });

  it('refuses a partial entry rather than guessing at it', () => {
    // Half-typed input must not commit: "14" could be 14:00 or 1:40, and
    // picking one silently writes a time the user never chose.
    expect(normaliseTimeLabel('14')).toBeNull();
    expect(normaliseTimeLabel('9')).toBeNull();
  });

  it('refuses anything the chip would have to draw as a time', () => {
    // The chip reserves room for the time before the title, so a sentence here
    // takes the whole chip and the event loses its name on the calendar.
    expect(normaliseTimeLabel('sometime after lunch on the 3rd')).toBeNull();
    expect(normaliseTimeLabel('tea time')).toBeNull();
    expect(normaliseTimeLabel('25:00')).toBeNull();
    expect(normaliseTimeLabel('12:60')).toBeNull();
  });
});

describe('EventActions time editing', () => {
  let store: EventStore;
  let actions: EventActions;
  let history: HistoryStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: new InMemoryDeskPersistence() }],
    });
    store = TestBed.inject(EventStore);
    actions = TestBed.inject(EventActions);
    history = TestBed.inject(HistoryStore);
  });

  it('gives an all-day event a time, and the chip treatment that goes with it', () => {
    store.insert(seminar());

    actions.setTime('seminar', '14:00');

    const timed = store.get('seminar')!;
    expect(timed.timeLabel).toBe('14:00');
    // The chip picks its fill from the variant alone, so a time without this
    // would draw as the solid all-day block it no longer is.
    expect(timed.variant).toBe('timed');
  });

  it('trims what was typed rather than storing the spaces around it', () => {
    store.insert(seminar());

    actions.setTime('seminar', '  09:30 ');

    expect(store.get('seminar')!.timeLabel).toBe('09:30');
  });

  it('treats an emptied field as "make it all-day"', () => {
    store.insert(seminar({ timeLabel: '14:00', variant: 'timed' }));

    actions.setTime('seminar', '   ');

    const cleared = store.get('seminar')!;
    // Absent is what all-day means, and only `undefined` reaches the database
    // as a null time_label — an empty string would be stored as a time.
    expect(cleared.timeLabel).toBeUndefined();
    expect(cleared.variant).toBe('allday');
  });

  it('keeps a tentative or completed event as it was found', () => {
    // `variant` carries two unrelated things under one name. Correcting the
    // hour of a completed event must not quietly un-complete it — the chip
    // draws its strike-through and faded alpha from the variant alone.
    store.insert(seminar({ id: 'maybe', timeLabel: '14:00', variant: 'tentative' }));
    store.insert(seminar({ id: 'done', timeLabel: '08:00', variant: 'completed' }));

    actions.setTime('maybe', '15:00');
    actions.setTime('done', '08:30');

    expect(store.get('maybe')!.variant).toBe('tentative');
    expect(store.get('maybe')!.timeLabel).toBe('15:00');
    expect(store.get('done')!.variant).toBe('completed');
    expect(store.get('done')!.timeLabel).toBe('08:30');
  });

  it('does not record an edit that changes nothing', () => {
    store.insert(seminar({ timeLabel: '14:00', variant: 'timed' }));
    actions.setTitle('seminar', 'Renamed');

    // A blur with the same text still fires `change`; pushing a no-op would
    // make the next undo look broken by appearing to do nothing.
    actions.setTime('seminar', ' 14:00 ');
    history.undo();

    expect(store.get('seminar')!.title).toBe('Seminar');
  });

  it('restores the previous time and variant in one undo', () => {
    store.insert(seminar({ timeLabel: '09:00', variant: 'timed' }));

    actions.setTime('seminar', '');
    actions.setTime('seminar', '11:15');
    history.undo();

    const back = store.get('seminar')!;
    expect(back.timeLabel).toBeUndefined();
    expect(back.variant).toBe('allday');

    history.undo();
    const original = store.get('seminar')!;
    expect(original.timeLabel).toBe('09:00');
    expect(original.variant).toBe('timed');
  });
});

describe('EventActions.create', () => {
  let actions: EventActions;
  let selection: SelectionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: new InMemoryDeskPersistence() }],
    });
    actions = TestBed.inject(EventActions);
    selection = TestBed.inject(SelectionStore);
  });

  it('leaves the new event selected with the occurrence that describes it', () => {
    const id = actions.create(new Date(2026, 8, 18), 'Advisor meeting');

    // The inspector edits an event exclusively through the occurrence, so
    // selecting without one is a panel that renders every control against its
    // fallbacks and writes through none of them.
    expect(selection.selection()).toEqual({ kind: 'event', id });
    expect(selection.occurrence()?.event.id).toBe(id);
    expect(selection.occurrence()?.event.title).toBe('Advisor meeting');
  });

  it('describes it on the day it was created for', () => {
    const date = new Date(2026, 8, 18);
    actions.create(date, 'Advisor meeting');

    const occurrence = selection.occurrence()!;
    expect(occurrence.date.getFullYear()).toBe(2026);
    expect(occurrence.date.getMonth()).toBe(8);
    expect(occurrence.date.getDate()).toBe(18);
    // A plain event is its own occurrence: there is no rule to expand and no
    // row it stands in for, so it is real rather than computed.
    expect(occurrence.virtual).toBe(false);
  });
});

describe('EventActions.removeOccurrence with a stale selection', () => {
  let store: EventStore;
  let actions: EventActions;
  let selection: SelectionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: new InMemoryDeskPersistence() }],
    });
    store = TestBed.inject(EventStore);
    actions = TestBed.inject(EventActions);
    selection = TestBed.inject(SelectionStore);
  });

  it('cancels one date of a series the inspector has just created', () => {
    const date = new Date(2026, 8, 18);
    const id = actions.create(date, 'Seminar');
    // The occurrence the selection is holding was resolved before the rule
    // existed, so it still describes a plain one-off event.
    const held = selection.occurrence()!;
    expect(held.virtual).toBe(false);

    actions.setRepeat(id, 'weekly');
    actions.removeOccurrence(held);

    // Deleting must mean the same thing however the event came to be
    // selected. Trusting the stale snapshot read `virtual: false` and took
    // the whole series with it, where clicking any chip of that same series
    // suppresses the one date.
    expect(store.get(id), 'the series must survive cancelling one of its dates').toBeTruthy();
    expect(store.get(id)!.rrule).toBeTruthy();
    const tombstone = store
      .events()
      .find((event) => event.seriesId === id && event.deleted);
    expect(tombstone, 'the cancelled date is suppressed by a tombstone').toBeTruthy();
    expect(tombstone!.occurrenceDate?.getDate()).toBe(18);
  });

  it('still deletes a plain event outright, which has no series to spare', () => {
    const id = actions.create(new Date(2026, 8, 18), 'Dentist');

    actions.removeOccurrence(selection.occurrence()!);

    expect(store.get(id)).toBeUndefined();
  });
});

describe('EventActions.removeOccurrence on a materialised override', () => {
  let store: EventStore;
  let actions: EventActions;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: new InMemoryDeskPersistence() }],
    });
    store = TestBed.inject(EventStore);
    actions = TestBed.inject(EventActions);
  });

  /**
   * The seminar's own occurrences on a day. Scoped to the series on purpose:
   * the store seeds the sample month asynchronously, so an unfiltered query
   * here answers with whatever the seed happened to have landed by then.
   */
  const on = (day: number) => {
    const date = new Date(2026, 8, day);
    return [...store.occurrencesByDate({ from: date, to: date }).values()]
      .flat()
      .filter((o) => o.event.id === 'seminar' || o.event.seriesId === 'seminar');
  };

  it('suppresses the date rather than handing it back to the series', () => {
    store.insert(seminar({ rrule: 'FREQ=WEEKLY;BYDAY=TU' }));
    // Give the 8th its own row, the way double-clicking a chip does.
    const eighth = on(8)[0];
    expect(eighth.virtual).toBe(true);
    const overrideId = actions.materialise(eighth);
    // Give it words of its own, so restoring it is distinguishable from the
    // series simply computing the date again.
    actions.setTitle(overrideId, 'Guest speaker');
    const override = on(8)[0];
    expect(override.virtual).toBe(false);
    expect(override.event.title).toBe('Guest speaker');

    // Selected the way pressing Delete requires it to be, so the assertion
    // below about clearing is about something rather than about nothing.
    const selection = TestBed.inject(SelectionStore);
    selection.select('event', override.id);
    selection.occurrence.set(override);

    actions.removeOccurrence(override);

    // Deleting the row alone left the rule free to compute the date straight
    // back, so cancelling an occurrence the user had edited cancelled nothing.
    expect(on(8), 'the cancelled date must stay empty').toEqual([]);
    expect(store.get('seminar'), 'and the series must survive it').toBeTruthy();
    expect(on(15).length, 'along with its other dates').toBe(1);

    // The chip is gone, so nothing may still be selected and editable: that
    // row now exists only to say the date is empty.
    expect(selection.selection()).toBeNull();

    // Suppressing by marking the override rather than deleting it is what
    // lets undo hand back the edited occurrence and not merely the series'
    // own computed one.
    TestBed.inject(HistoryStore).undo();
    expect(on(8).length, 'undo restores the date').toBe(1);
    expect(on(8)[0].event.title, 'with the words that were on it').toBe('Guest speaker');
  });

  it('does not delete a series when the date it was holding is already gone', () => {
    const selection = TestBed.inject(SelectionStore);
    const id = actions.create(new Date(2026, 8, 1), 'Seminar');
    // The snapshot taken at creation, which still calls itself a one-off.
    const held = selection.occurrence()!;
    actions.setRepeat(id, 'weekly');

    actions.removeOccurrence(held);
    // The same stale occurrence, pressed a second time. Nothing stands on the
    // 1st now, and "nothing is here" must not authorise deleting the series
    // the snapshot happened to belong to.
    actions.removeOccurrence(held);

    expect(store.get(id), 'the series must survive a second press').toBeTruthy();
    const laterDate = new Date(2026, 8, 8);
    const later = [...store.occurrencesByDate({ from: laterDate, to: laterDate }).values()]
      .flat()
      .filter((o) => o.event.id === id || o.event.seriesId === id);
    expect(later.length, 'and keep computing its other dates').toBe(1);
  });
});
