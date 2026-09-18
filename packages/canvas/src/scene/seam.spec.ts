import { describe, expect, it } from 'vitest';

import {
  MONTH_H,
  MONTH_W,
  YEAR_W,
  monthFromOrdinal,
  monthOrdinal,
  monthOrigin,
} from '../month-layout';
import { planSeam, splitRun } from './seam';

const YEARS = [2024, 2025, 2026, 2027, 2028];
const TIERS = ['day', 'week', 'month', 'year'] as const;

describe('planSeam', () => {
  it('marks the September gutter with three bars and names October', () => {
    // The exact failure: dragging down from September arrives at December, and
    // the reader concluded the weekday columns were misprinted rather than that
    // she had moved a quarter.
    const plan = planSeam(2026, 8, 'month')!;
    expect(plan.kind).toBe('month');
    expect(plan.gap).toBe(100);
    expect(plan.bars.map((b) => b.y)).toEqual([1596, 1630, 1664]);
    expect(plan.catchword).toEqual({ name: 'October', year: null });
  });

  it('puts every bar in the gutter and none of them on paper', () => {
    const september = monthOrigin(2026, 8);
    const plan = planSeam(2026, 8, 'month')!;
    for (const bar of plan.bars) {
      const world = september.y + bar.y;
      expect(world).toBeGreaterThan(september.y + MONTH_H);
      expect(world).toBeLessThan(monthOrigin(2026, 11).y);
    }
  });

  it('keeps every mark inside the gutter, for every month and tier', () => {
    // The mark is drawn by the sheet above it in that sheet's own coordinates,
    // so an arithmetic slip lands ink on the calendar rather than beside it.
    for (const year of YEARS) {
      for (let m = 0; m < 12; m++) {
        for (const tier of TIERS) {
          const plan = planSeam(year, m, tier);
          if (!plan) continue;
          const floor = MONTH_H + plan.gap;
          for (const bar of plan.bars) {
            expect(bar.y, `bars ${year}-${m} ${tier}`).toBeGreaterThan(MONTH_H);
            expect(bar.y).toBeLessThan(floor);
          }
          for (const text of plan.texts) {
            expect(text.y - text.size, `text ${year}-${m} ${tier}`).toBeGreaterThan(MONTH_H);
            expect(text.y + text.size).toBeLessThan(floor);
          }
          // The catchword's hook reaches 28 below the seam's midline.
          if (plan.catchword) expect(MONTH_H + plan.gap / 2 + 28).toBeLessThan(floor);
        }
      }
    }
  });

  it('says the same three words at every horizontal seam', () => {
    // A constant string is recognised rather than read, which is what an eye
    // in motion can manage.
    for (const year of YEARS) {
      for (let m = 0; m < 12; m++) {
        const plan = planSeam(year, m, 'month')!;
        expect(plan.texts[0].text, `${year}-${m}`).toBe('3 MONTHS');
      }
    }
  });

  it('is telling the truth: the sheet below really is three months on', () => {
    // If the grid is ever reshaped this fails loudly, which is exactly when
    // the constant string would quietly become a lie.
    for (const year of YEARS) {
      for (let m = 0; m < 12; m++) {
        const here = monthOrigin(year, m);
        const below = monthFromOrdinal(monthOrdinal(year, m) + 3);
        const there = monthOrigin(below.year, below.monthIndex);
        expect(there.x, `${year}-${m} column`).toBe(here.x);
        expect(there.y, `${year}-${m} below`).toBeGreaterThan(here.y);
      }
    }
    // Including across the block boundary, where below December is March.
    expect(monthFromOrdinal(monthOrdinal(2026, 11) + 3)).toEqual({ year: 2027, monthIndex: 2 });
  });

  it('names the year that begins, in every column of the boundary', () => {
    // It used to take the successor *month's* year, which is only the block's
    // successor under December: October's strip read "2026 BEGINS" above a
    // sheet headed January 2027, so one boundary carried two different years.
    for (const m of [9, 10, 11]) {
      const begins = planSeam(2026, m, 'month')!.texts.find((t) => t.tone === 'accent');
      expect(begins?.text, `month ${m}`).toBe('2027 BEGINS');
    }
  });

  it('carries the heavier mark and the year at the block boundary', () => {
    const plan = planSeam(2026, 11, 'month')!;
    expect(plan.kind).toBe('year');
    expect(plan.gap).toBe(240);
    expect(plan.bars.map((b) => b.y)).toEqual([1640, 1700, 1760]);
    expect(plan.texts.map((t) => t.text)).toContain('2027 BEGINS');
    // The only colour on any seam, spent on the only fact "3 MONTHS" omits.
    expect(plan.texts.find((t) => t.text === '2027 BEGINS')!.tone).toBe('accent');
    expect(plan.catchword).toEqual({ name: 'January', year: 2027 });
  });

  it('names the successor, never the next index', () => {
    // December + 1 is January of the next year. Hand-rolled arithmetic on the
    // month index gets this wrong and nothing else in the plan would notice.
    expect(planSeam(2026, 2, 'month')!.catchword).toEqual({ name: 'April', year: null });
    expect(planSeam(2026, 5, 'month')!.catchword).toEqual({ name: 'July', year: null });
    expect(planSeam(2026, 11, 'month')!.catchword).toEqual({ name: 'January', year: 2027 });
  });

  it('only speaks up at a row end, where the next month is not simply right', () => {
    for (const m of [0, 1, 3, 4, 6, 7, 9, 10]) {
      expect(planSeam(2026, m, 'month')!.catchword, `month ${m}`).toBeNull();
    }
    for (const m of [2, 5, 8, 11]) {
      expect(planSeam(2026, m, 'month')!.catchword, `month ${m}`).not.toBeNull();
    }
  });

  it('marks the side gutter with one bar, because sideways really is one month', () => {
    // Drawing only the three-bar mark would state half of a binary and leave
    // the other half ambiguous.
    for (const m of [0, 1, 3, 4]) {
      const bar = planSeam(2026, m, 'month')!.verticalBar!;
      expect(bar, `month ${m}`).not.toBeNull();
      expect(bar.x).toBe(MONTH_W + 50);
    }
    // The last column has no gutter to its right.
    for (const m of [2, 5, 8, 11]) {
      expect(planSeam(2026, m, 'month')!.verticalBar, `month ${m}`).toBeNull();
    }
  });

  it('leaves the block boundary unbroken across all three columns', () => {
    // The year rule tiles the block exactly while month seams stop short of
    // every sheet edge. That contrast is the hierarchy, drawn.
    const spans = [9, 10, 11].map((m) => {
      const plan = planSeam(2026, m, 'month')!;
      const origin = monthOrigin(2026, m);
      const [from, to] = plan.bars[0].runs[0];
      return [origin.x + from, origin.x + to] as const;
    });
    expect(spans[0][0]).toBe(0);
    expect(spans[0][1]).toBe(spans[1][0]);
    expect(spans[1][1]).toBe(spans[2][0]);
    expect(spans[2][1]).toBe(YEAR_W);
  });

  it('leaves the crossroads open at a month seam', () => {
    const plan = planSeam(2026, 4, 'month')!;
    const [from, to] = plan.bars[0].runs[0];
    expect(from).toBeGreaterThan(0);
    expect(to).toBeLessThan(MONTH_W);
  });

  it('keeps only the block boundary when the whole year is in view', () => {
    // The county line outlasts the street names. Nothing at that size could be
    // read anyway, and every sheet is printing its own title.
    for (let m = 0; m < 9; m++) {
      expect(planSeam(2026, m, 'year'), `month ${m}`).toBeNull();
    }
    for (const m of [9, 10, 11]) {
      const plan = planSeam(2026, m, 'year')!;
      expect(plan.texts).toEqual([]);
      expect(plan.catchword).toBeNull();
      expect(plan.verticalBar).toBeNull();
      expect(plan.barWidth).toBe(12);
    }
  });

  it('has exactly two states, so it can only pop where the sheet already does', () => {
    for (let m = 0; m < 12; m++) {
      const month = planSeam(2026, m, 'month');
      expect(planSeam(2026, m, 'week'), `week ${m}`).toEqual(month);
      expect(planSeam(2026, m, 'day'), `day ${m}`).toEqual(month);
    }
  });
});

describe('splitRun', () => {
  it('cuts a bar around what sits on its line', () => {
    expect(splitRun(0, 400, [[160, 240]])).toEqual([
      [0, 160],
      [240, 400],
    ]);
  });

  it('drops a stub rather than hanging a tick off a label', () => {
    // A short fragment left beside a word reads as an unfinished one: the
    // catchword shipped as "January 2027 –" until this had a floor.
    expect(splitRun(0, 400, [[40, 380]])).toEqual([]);
    expect(splitRun(0, 400, [[0, 360]])).toEqual([]);
  });

  it('handles several breaks and keeps them in order', () => {
    expect(splitRun(0, 600, [[80, 160], [360, 460]])).toEqual([
      [0, 80],
      [160, 360],
      [460, 600],
    ]);
  });

  it('leaves a bar alone when nothing is on its line', () => {
    expect(splitRun(10, 900, [])).toEqual([[10, 900]]);
    expect(splitRun(10, 900, [[2000, 3000]])).toEqual([[10, 900]]);
  });
});
