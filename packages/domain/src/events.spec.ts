import { describe, expect, it } from 'vitest';

import { dateKey, occurrencesInWindow, type EventRecord } from './events';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const SEPTEMBER = { from: d(2026, 9, 1), to: d(2026, 9, 30) };

/** A weekly Tuesday seminar anchored on 1 September 2026. */
const seminar: EventRecord = {
  id: 'seminar',
  title: 'Seminar',
  color: 'blue',
  date: d(2026, 9, 1),
  rrule: 'FREQ=WEEKLY;BYDAY=TU',
};

const keys = (events: readonly EventRecord[], window = SEPTEMBER) =>
  occurrencesInWindow(events, window).map((o) => dateKey(o.date));

describe('occurrencesInWindow', () => {
  it('returns a plain event only when it falls in the window', () => {
    const dentist: EventRecord = {
      id: 'dentist',
      title: 'Dentist',
      color: 'teal',
      date: d(2026, 9, 15),
    };
    expect(keys([dentist])).toEqual(['2026-09-15']);
    expect(keys([dentist], { from: d(2026, 10, 1), to: d(2026, 10, 31) })).toEqual([]);
  });

  it('computes a series without storing its occurrences', () => {
    const occurrences = occurrencesInWindow([seminar], SEPTEMBER);
    expect(occurrences.map((o) => dateKey(o.date))).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ]);
    expect(occurrences.every((o) => o.virtual)).toBe(true);
    // Derived identity, so selection survives without a row existing.
    expect(occurrences[0].id).toBe('seminar:2026-09-01');
  });

  it('replaces one date with its stored override', () => {
    const moved: EventRecord = {
      id: 'moved',
      title: 'Seminar (room change)',
      color: 'blue',
      date: d(2026, 9, 15),
      seriesId: 'seminar',
      occurrenceDate: d(2026, 9, 15),
    };
    const occurrences = occurrencesInWindow([seminar, moved], SEPTEMBER);

    expect(occurrences.map((o) => dateKey(o.date))).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ]);
    const fifteenth = occurrences.find((o) => dateKey(o.date) === '2026-09-15')!;
    expect(fifteenth.virtual).toBe(false);
    expect(fifteenth.id).toBe('moved');
    expect(fifteenth.event.title).toBe('Seminar (room change)');
  });

  it('suppresses a date whose override is a tombstone', () => {
    const cancelled: EventRecord = {
      id: 'cancelled',
      title: 'Seminar',
      color: 'blue',
      date: d(2026, 9, 8),
      seriesId: 'seminar',
      occurrenceDate: d(2026, 9, 8),
      deleted: true,
    };
    expect(keys([seminar, cancelled])).toEqual([
      '2026-09-01',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ]);
  });

  it('keeps an override the rule no longer produces', () => {
    // The user moved and annotated a Wednesday occurrence; the rule is then
    // edited so that Wednesday is not a seminar date at all. That work is real
    // and must not vanish — it simply stops belonging to the series.
    const orphan: EventRecord = {
      id: 'orphan',
      title: 'Seminar (rescheduled)',
      color: 'blue',
      date: d(2026, 9, 9),
      seriesId: 'seminar',
      occurrenceDate: d(2026, 9, 9),
    };
    const occurrences = occurrencesInWindow([seminar, orphan], SEPTEMBER);
    const ninth = occurrences.find((o) => o.id === 'orphan');
    expect(ninth).toBeDefined();
    expect(ninth!.virtual).toBe(false);
    expect(keys([seminar, orphan])).toContain('2026-09-09');
  });

  it('does not double-count the series anchor', () => {
    expect(keys([seminar]).filter((k) => k === '2026-09-01')).toHaveLength(1);
  });

  it('returns occurrences in date order across several events', () => {
    const dentist: EventRecord = {
      id: 'dentist',
      title: 'Dentist',
      color: 'teal',
      date: d(2026, 9, 3),
    };
    expect(keys([seminar, dentist])).toEqual([
      '2026-09-01',
      '2026-09-03',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ]);
  });

  it('draws only the window asked for, months into a series', () => {
    expect(keys([seminar], { from: d(2026, 11, 1), to: d(2026, 11, 30) })).toEqual([
      '2026-11-03',
      '2026-11-10',
      '2026-11-17',
      '2026-11-24',
    ]);
  });
});
