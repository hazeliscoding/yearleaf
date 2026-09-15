import { describe, expect, it } from 'vitest';

import { buildMonthGrid, dayOfYear, daysInMonth, isoWeek, mondayIndex } from './calendar';

describe('buildMonthGrid', () => {
  it('builds September 2026 as five Monday-first weeks starting on Aug 31', () => {
    const cells = buildMonthGrid(2026, 8);
    expect(cells).toHaveLength(35);
    expect(cells[0].day).toBe(31);
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].day).toBe(1);
    expect(cells[1].inMonth).toBe(true);
    expect(cells[34].day).toBe(4);
    expect(cells[34].inMonth).toBe(false);
  });

  it('flags Saturdays and Sundays as weekend', () => {
    const cells = buildMonthGrid(2026, 8);
    // Sep 5, 2026 is a Saturday; index 5 in the first row.
    expect(cells[5].day).toBe(5);
    expect(cells[5].weekend).toBe(true);
    expect(cells[4].weekend).toBe(false);
  });

  it('produces six weeks when a long month starts late in the week', () => {
    // August 2026 starts on a Saturday and has 31 days -> 6 rows.
    expect(buildMonthGrid(2026, 7)).toHaveLength(42);
  });
});

describe('date helpers', () => {
  it('computes Monday-first weekday indices', () => {
    expect(mondayIndex(new Date(2026, 8, 14))).toBe(0); // Monday
    expect(mondayIndex(new Date(2026, 8, 20))).toBe(6); // Sunday
  });

  it('computes month lengths including leap February', () => {
    expect(daysInMonth(2026, 8)).toBe(30);
    expect(daysInMonth(2028, 1)).toBe(29);
  });

  it('computes ISO week numbers across year boundaries', () => {
    expect(isoWeek(new Date(2026, 8, 15))).toBe(38);
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53); // Jan 1 2027 is a Friday of ISO week 53/2026.
  });

  it('computes day-of-year ordinals', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2026, 8, 15))).toBe(258);
  });
});
