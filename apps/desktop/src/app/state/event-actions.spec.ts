import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { EventRecord } from '@infinite-desk/domain';
import { InMemoryDeskPersistence } from '@infinite-desk/persistence';

import { DESK_PERSISTENCE } from '../persistence/desk-persistence.token';
import { EventActions, normaliseTimeLabel } from './event-actions';
import { EventStore } from './event-store';
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
