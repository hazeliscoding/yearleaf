import { describe, expect, it } from 'vitest';

import {
  UnsupportedRecurrenceError,
  expandRecurrence,
  formatRecurrenceRule,
  parseRecurrenceRule,
  presetForRule,
  ruleForPreset,
} from './recurrence';

/** Local-midnight date, so tests read as calendar dates. */
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

/** Expanded dates as `YYYY-MM-DD`, for readable assertions. */
function iso(dates: readonly Date[]): string[] {
  return dates.map(
    (x) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(
        x.getDate(),
      ).padStart(2, '0')}`,
  );
}

const YEAR_2026 = { from: d(2026, 1, 1), to: d(2026, 12, 31) };

describe('parseRecurrenceRule', () => {
  it('parses the supported subset', () => {
    const rule = parseRecurrenceRule('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=8;WKST=SU');
    expect(rule.freq).toBe('WEEKLY');
    expect(rule.interval).toBe(2);
    expect(rule.byDay).toEqual([{ weekday: 'TU' }, { weekday: 'TH' }]);
    expect(rule.count).toBe(8);
    expect(rule.weekStart).toBe('SU');
  });

  it('parses an nth weekday and a date-only UNTIL', () => {
    const rule = parseRecurrenceRule('FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261231');
    expect(rule.byDay).toEqual([{ weekday: 'FR', nth: -1 }]);
    expect(rule.until).toEqual(d(2026, 12, 31));
  });

  it('defaults interval and week start', () => {
    const rule = parseRecurrenceRule('FREQ=DAILY');
    expect(rule.interval).toBe(1);
    expect(rule.weekStart).toBe('MO');
  });

  it.each([
    ['FREQ=HOURLY', 'sub-daily frequency'],
    ['FREQ=MONTHLY;BYSETPOS=2;BYDAY=MO', 'unsupported part'],
    ['FREQ=YEARLY;BYWEEKNO=12', 'unsupported part'],
    ['FREQ=WEEKLY;COUNT=4;UNTIL=20261231', 'both COUNT and UNTIL'],
    ['FREQ=WEEKLY;INTERVAL=0', 'non-positive interval'],
    ['FREQ=WEEKLY;BYDAY=2TU', 'nth weekday on a weekly rule'],
    ['FREQ=MONTHLY;BYMONTHDAY=32', 'out-of-range month day'],
    ['', 'empty rule'],
  ])('refuses %s (%s)', (text) => {
    expect(() => parseRecurrenceRule(text)).toThrow(UnsupportedRecurrenceError);
  });
});

describe('formatRecurrenceRule', () => {
  it.each([
    'FREQ=DAILY',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=8',
    'FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261231',
    'FREQ=MONTHLY;BYMONTHDAY=15',
    'FREQ=YEARLY;WKST=SU',
  ])('round-trips %s', (text) => {
    expect(formatRecurrenceRule(parseRecurrenceRule(text))).toBe(text);
  });
});

describe('repeat presets', () => {
  it('anchors weekly and monthly on the event’s own date', () => {
    const tuesday = d(2026, 9, 15);
    expect(ruleForPreset('weekly', tuesday)).toBe('FREQ=WEEKLY;BYDAY=TU');
    expect(ruleForPreset('monthly', tuesday)).toBe('FREQ=MONTHLY;BYMONTHDAY=15');
    expect(ruleForPreset('daily', tuesday)).toBe('FREQ=DAILY');
    expect(ruleForPreset('yearly', tuesday)).toBe('FREQ=YEARLY');
  });

  it('produces rules that keep the anchor date as an occurrence', () => {
    const tuesday = d(2026, 9, 15);
    for (const preset of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      const rule = parseRecurrenceRule(ruleForPreset(preset, tuesday));
      const dates = expandRecurrence(rule, tuesday, { from: tuesday, to: tuesday });
      expect(iso(dates), preset).toEqual(['2026-09-15']);
    }
  });

  it('recognises its own rules, and declines to simplify richer ones', () => {
    const tuesday = d(2026, 9, 15);
    expect(presetForRule('FREQ=WEEKLY;BYDAY=TU', tuesday)).toBe('weekly');
    expect(presetForRule(undefined, tuesday)).toBeNull();
    // A fortnightly rule is not any of the presets and must not be mislabelled.
    expect(presetForRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', tuesday)).toBeNull();
  });
});

describe('expandRecurrence', () => {
  it('repeats daily, respecting the interval', () => {
    const rule = parseRecurrenceRule('FREQ=DAILY;INTERVAL=3;COUNT=4');
    expect(iso(expandRecurrence(rule, d(2026, 9, 1), YEAR_2026))).toEqual([
      '2026-09-01',
      '2026-09-04',
      '2026-09-07',
      '2026-09-10',
    ]);
  });

  it("repeats a weekly seminar for a term", () => {
    // Marcus's Tuesday seminar: 16 weeks from the first Tuesday of term.
    const rule = parseRecurrenceRule('FREQ=WEEKLY;BYDAY=TU;COUNT=16');
    const dates = expandRecurrence(rule, d(2026, 9, 1), YEAR_2026);
    expect(dates).toHaveLength(16);
    expect(iso(dates).slice(0, 3)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
    expect(iso(dates).at(-1)).toBe('2026-12-15');
    expect(dates.every((x) => x.getDay() === 2)).toBe(true);
  });

  it('repeats on several weekdays a week', () => {
    const rule = parseRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4');
    expect(iso(expandRecurrence(rule, d(2026, 9, 1), YEAR_2026))).toEqual([
      '2026-09-02', // the Monday precedes the series start, so the Wednesday leads
      '2026-09-07',
      '2026-09-09',
      '2026-09-14',
    ]);
  });

  it('repeats on an nth weekday of the month', () => {
    const rule = parseRecurrenceRule('FREQ=MONTHLY;BYDAY=3WE;COUNT=3');
    expect(iso(expandRecurrence(rule, d(2026, 9, 1), YEAR_2026))).toEqual([
      '2026-09-16',
      '2026-10-21',
      '2026-11-18',
    ]);
  });

  it('repeats on the last weekday of the month', () => {
    const rule = parseRecurrenceRule('FREQ=MONTHLY;BYDAY=-1FR;COUNT=3');
    expect(iso(expandRecurrence(rule, d(2026, 1, 1), YEAR_2026))).toEqual([
      '2026-01-30',
      '2026-02-27',
      '2026-03-27',
    ]);
  });

  it('skips months that have no such day rather than clamping', () => {
    const rule = parseRecurrenceRule('FREQ=MONTHLY;BYMONTHDAY=31');
    const dates = iso(expandRecurrence(rule, d(2026, 1, 31), { from: d(2026, 1, 1), to: d(2026, 6, 30) }));
    // February, April and June have no 31st — RFC 5545 drops them.
    expect(dates).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });

  it('counts back from the end of the month', () => {
    const rule = parseRecurrenceRule('FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3');
    expect(iso(expandRecurrence(rule, d(2026, 1, 1), YEAR_2026))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('repeats yearly, and survives a leap day', () => {
    const rule = parseRecurrenceRule('FREQ=YEARLY');
    const dates = iso(expandRecurrence(rule, d(2024, 2, 29), { from: d(2024, 1, 1), to: d(2028, 12, 31) }));
    // Only leap years have a 29 February; the others are skipped, not moved.
    expect(dates).toEqual(['2024-02-29', '2028-02-29']);
  });

  it('stops on UNTIL, inclusive', () => {
    const rule = parseRecurrenceRule('FREQ=WEEKLY;BYDAY=TU;UNTIL=20260915');
    expect(iso(expandRecurrence(rule, d(2026, 9, 1), YEAR_2026))).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
    ]);
  });

  it('counts occurrences from the series start, not from the window', () => {
    // COUNT=3 is exhausted long before the window opens, so nothing shows.
    const rule = parseRecurrenceRule('FREQ=WEEKLY;BYDAY=TU;COUNT=3');
    const later = { from: d(2026, 11, 1), to: d(2026, 11, 30) };
    expect(expandRecurrence(rule, d(2026, 9, 1), later)).toEqual([]);
  });

  it('returns only the window, for a series that runs through it', () => {
    const rule = parseRecurrenceRule('FREQ=WEEKLY;BYDAY=TU');
    const october = { from: d(2026, 10, 1), to: d(2026, 10, 31) };
    expect(iso(expandRecurrence(rule, d(2026, 9, 1), october))).toEqual([
      '2026-10-06',
      '2026-10-13',
      '2026-10-20',
      '2026-10-27',
    ]);
  });

  it('is bounded for an endless rule', () => {
    const rule = parseRecurrenceRule('FREQ=DAILY');
    const week = { from: d(2030, 5, 1), to: d(2030, 5, 7) };
    expect(expandRecurrence(rule, d(2026, 1, 1), week)).toHaveLength(7);
  });

  it('returns nothing for an inverted window', () => {
    const rule = parseRecurrenceRule('FREQ=DAILY');
    expect(expandRecurrence(rule, d(2026, 1, 1), { from: d(2026, 5, 1), to: d(2026, 4, 1) })).toEqual(
      [],
    );
  });

  it('honours the week start when a fortnightly rule spans the weekend', () => {
    // Starting Monday 7 Sep with BYDAY=SU,MO, the week start decides which side
    // of the boundary the Sunday falls on — and so which Sundays are in an
    // active week at all.
    const start = d(2026, 9, 7);
    const monday = parseRecurrenceRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;COUNT=4;WKST=MO');
    const sunday = parseRecurrenceRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;COUNT=4;WKST=SU');

    // Monday-first: the Sunday closes the same week, so it trails its Monday.
    expect(iso(expandRecurrence(monday, start, YEAR_2026))).toEqual([
      '2026-09-07',
      '2026-09-13',
      '2026-09-21',
      '2026-09-27',
    ]);
    // Sunday-first: the Sunday opens the next active week, so it leads instead.
    expect(iso(expandRecurrence(sunday, start, YEAR_2026))).toEqual([
      '2026-09-07',
      '2026-09-20',
      '2026-09-21',
      '2026-10-04',
    ]);
  });
});
