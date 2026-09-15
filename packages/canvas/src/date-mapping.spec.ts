import { describe, expect, it } from 'vitest';

import { DAY_WORLD_WIDTH, dateForWorldX, dayOrdinal, worldXForDate } from './date-mapping';

describe('date-to-world mapping', () => {
  it('anchors the epoch day at x = 0', () => {
    expect(worldXForDate(new Date(2020, 0, 1))).toBe(0);
  });

  it('maps consecutive days to consecutive columns', () => {
    const a = worldXForDate(new Date(2026, 8, 15));
    const b = worldXForDate(new Date(2026, 8, 16));
    expect(b - a).toBe(DAY_WORLD_WIDTH);
  });

  it('is stable across DST transitions', () => {
    // March 2026 contains DST changes in many locales; ordinals must stay contiguous.
    const days = Array.from({ length: 31 }, (_, i) => dayOrdinal(new Date(2026, 2, i + 1)));
    for (let i = 1; i < days.length; i++) expect(days[i] - days[i - 1]).toBe(1);
  });

  it('round-trips every offset inside a day column', () => {
    const date = new Date(2026, 8, 15);
    const left = worldXForDate(date);
    for (const offset of [0, 1, DAY_WORLD_WIDTH / 2, DAY_WORLD_WIDTH - 1]) {
      expect(dateForWorldX(left + offset).getTime()).toBe(date.getTime());
    }
  });

  it('handles dates before the epoch with negative ordinals', () => {
    expect(dayOrdinal(new Date(2019, 11, 31))).toBe(-1);
    expect(dateForWorldX(-1).getTime()).toBe(new Date(2019, 11, 31).getTime());
  });
});
