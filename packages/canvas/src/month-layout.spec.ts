import { describe, expect, it } from 'vitest';

import {
  CELL_H,
  CELL_W,
  MONTH_HEADER_H,
  MONTH_STRIDE_X,
  MONTH_STRIDE_Y,
  YEAR_STRIDE_Y,
  cellRectForDate,
  dateForWorldPoint,
  monthForWorldPoint,
  monthOrigin,
  monthRect,
  yearRect,
} from './month-layout';

describe('month layout', () => {
  it('anchors January 2020 at the world origin', () => {
    expect(monthOrigin(2020, 0)).toEqual({ x: 0, y: 0 });
  });

  it('lays a year block out as 3 columns × 4 rows in reading order', () => {
    expect(monthOrigin(2020, 1)).toEqual({ x: MONTH_STRIDE_X, y: 0 });
    expect(monthOrigin(2020, 3)).toEqual({ x: 0, y: MONTH_STRIDE_Y });
    expect(monthOrigin(2020, 11)).toEqual({ x: 2 * MONTH_STRIDE_X, y: 3 * MONTH_STRIDE_Y });
  });

  it('stacks year blocks vertically and supports years before the epoch', () => {
    expect(monthOrigin(2026, 0).y).toBe(6 * YEAR_STRIDE_Y);
    expect(monthOrigin(2019, 0).y).toBe(-YEAR_STRIDE_Y);
  });

  it('places a date canonically inside its own month grid', () => {
    // Sep 1, 2026 is a Tuesday → slot 1 of row 0.
    const origin = monthOrigin(2026, 8);
    expect(cellRectForDate(new Date(2026, 8, 1))).toEqual({
      x: origin.x + CELL_W,
      y: origin.y + MONTH_HEADER_H,
      width: CELL_W,
      height: CELL_H,
    });
    // Sep 15 is a Tuesday two rows down.
    expect(cellRectForDate(new Date(2026, 8, 15))).toEqual({
      x: origin.x + CELL_W,
      y: origin.y + MONTH_HEADER_H + 2 * CELL_H,
      width: CELL_W,
      height: CELL_H,
    });
  });

  it('round-trips every day of a month through dateForWorldPoint', () => {
    for (let day = 1; day <= 30; day++) {
      const rect = cellRectForDate(new Date(2026, 8, day));
      const hit = dateForWorldPoint({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      expect(hit?.inMonth).toBe(true);
      expect(hit?.date.getTime()).toBe(new Date(2026, 8, day).getTime());
    }
  });

  it('resolves lead/trail slots to the adjacent month, flagged not-in-month', () => {
    // Sep 2026 starts Tuesday, so slot 0 shows Monday Aug 31.
    const origin = monthOrigin(2026, 8);
    const hit = dateForWorldPoint({
      x: origin.x + CELL_W / 2,
      y: origin.y + MONTH_HEADER_H + CELL_H / 2,
    });
    expect(hit?.inMonth).toBe(false);
    expect(hit?.date.getTime()).toBe(new Date(2026, 7, 31).getTime());
  });

  it('returns null in headers, gutters, and open desk space', () => {
    const origin = monthOrigin(2026, 8);
    expect(dateForWorldPoint({ x: origin.x + 10, y: origin.y + 10 })).toBeNull(); // header
    const rect = monthRect(2026, 8);
    expect(dateForWorldPoint({ x: rect.x + rect.width + 10, y: rect.y + 500 })).toBeNull(); // gutter/open desk
    expect(dateForWorldPoint({ x: -50, y: 500 })).toBeNull(); // west of the grid
  });

  it('always resolves a nearest month for navigation focus', () => {
    const sep = monthRect(2026, 8);
    const focus = monthForWorldPoint({ x: sep.x + sep.width + 400, y: sep.y + 100 });
    expect(focus).toEqual({ year: 2026, monthIndex: 8 });
    expect(monthForWorldPoint({ x: -999, y: -999 })).toEqual({ year: 2019, monthIndex: 9 });
  });

  it('keeps year rects aligned with their months', () => {
    const y = yearRect(2026);
    const jan = monthRect(2026, 0);
    const dec = monthRect(2026, 11);
    expect(jan.x).toBe(y.x);
    expect(jan.y).toBe(y.y);
    expect(dec.x + dec.width).toBe(y.x + y.width);
    expect(dec.y + dec.height).toBe(y.y + y.height);
  });
});
