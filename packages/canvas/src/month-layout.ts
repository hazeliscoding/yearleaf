/**
 * The single documented mapping between calendar dates and world
 * coordinates (see docs/design-canvas-renderer.md).
 *
 * ## Scheme
 *
 * Time is laid out as year blocks on an infinite plane. Within a year,
 * months form a 3-column × 4-row grid in reading order (January top-left,
 * December bottom-right); years stack vertically. Every month renders a
 * fixed 7 × 6 day grid under a header band, so all positions are O(1) and
 * deterministic. The origin `(0, 0)` is the top-left of January 2020's
 * header — before any data the product will hold; earlier dates simply map
 * to negative Y.
 *
 * One world unit renders as one pixel at zoom 1.0. A century of calendar
 * spans ~7 × 10⁵ units — far inside float64 integer precision.
 */

import { daysInMonth, mondayIndex } from '@infinite-desk/domain';

/** An axis-aligned rectangle in world coordinates. */
export interface WorldRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Width of one day cell in world units. */
export const CELL_W = 320;
/** Height of one day cell in world units. */
export const CELL_H = 240;
/** Days per grid row. */
export const MONTH_COLS = 7;
/** Grid rows per month — always 6, so every month has uniform height. */
export const MONTH_ROWS = 6;
/** Height of the month title band above the grid. */
export const MONTH_HEADER_H = 140;
/** Total width of one month (header + grid share it). */
export const MONTH_W = MONTH_COLS * CELL_W;
/** Total height of one month (header band + grid). */
export const MONTH_H = MONTH_HEADER_H + MONTH_ROWS * CELL_H;
/** Gutter between adjacent months. */
export const MONTH_GAP = 100;
/** Horizontal distance between month origins. */
export const MONTH_STRIDE_X = MONTH_W + MONTH_GAP;
/** Vertical distance between month origins inside a year block. */
export const MONTH_STRIDE_Y = MONTH_H + MONTH_GAP;
/** Months per year-block row. */
export const YEAR_MONTH_COLS = 3;
/** Month rows per year block. */
export const YEAR_MONTH_ROWS = 4;
/** Width of a year block (three month columns, no trailing gutter). */
export const YEAR_W = YEAR_MONTH_COLS * MONTH_STRIDE_X - MONTH_GAP;
/** Height of a year block (four month rows, no trailing gutter). */
export const YEAR_H = YEAR_MONTH_ROWS * MONTH_STRIDE_Y - MONTH_GAP;
/** Gutter between consecutive year blocks. */
export const YEAR_GAP = 240;
/** Vertical distance between year-block origins. */
export const YEAR_STRIDE_Y = YEAR_H + YEAR_GAP;
/** The year whose block sits at the world origin. */
export const EPOCH_YEAR = 2020;

/** World position of a month's top-left corner (its header band). */
export function monthOrigin(year: number, monthIndex: number): { x: number; y: number } {
  const yearRow = year - EPOCH_YEAR;
  return {
    x: (monthIndex % YEAR_MONTH_COLS) * MONTH_STRIDE_X,
    y: yearRow * YEAR_STRIDE_Y + Math.floor(monthIndex / YEAR_MONTH_COLS) * MONTH_STRIDE_Y,
  };
}

/** World rectangle covering a whole month (header + grid). */
export function monthRect(year: number, monthIndex: number): WorldRect {
  const origin = monthOrigin(year, monthIndex);
  return { x: origin.x, y: origin.y, width: MONTH_W, height: MONTH_H };
}

/** World rectangle covering a whole year block. */
export function yearRect(year: number): WorldRect {
  return { x: 0, y: (year - EPOCH_YEAR) * YEAR_STRIDE_Y, width: YEAR_W, height: YEAR_H };
}

/** World rectangle of a grid slot (0–41) inside a month, including outside slots. */
export function cellRectForSlot(year: number, monthIndex: number, slot: number): WorldRect {
  const origin = monthOrigin(year, monthIndex);
  return {
    x: origin.x + (slot % MONTH_COLS) * CELL_W,
    y: origin.y + MONTH_HEADER_H + Math.floor(slot / MONTH_COLS) * CELL_H,
    width: CELL_W,
    height: CELL_H,
  };
}

/**
 * Canonical world rectangle of a date's day cell — its position inside its
 * **own** month's grid (a date shown dimmed in an adjacent month's lead or
 * trail slots is not canonical there).
 */
export function cellRectForDate(date: Date): WorldRect {
  const lead = mondayIndex(new Date(date.getFullYear(), date.getMonth(), 1));
  return cellRectForSlot(date.getFullYear(), date.getMonth(), lead + date.getDate() - 1);
}

/** A day-cell hit: the date a slot displays, and whether it is canonical there. */
export interface CellHit {
  /** The date shown in the hit slot (local midnight). */
  readonly date: Date;
  /** `false` when the slot is an adjacent month's dimmed lead/trail cell. */
  readonly inMonth: boolean;
}

/**
 * Resolves the day cell containing a world point, or `null` when the point
 * lies in a header band, a gutter, or the open desk outside the calendar
 * columns.
 */
export function dateForWorldPoint(point: { x: number; y: number }): CellHit | null {
  const monthCol = Math.floor(point.x / MONTH_STRIDE_X);
  if (monthCol < 0 || monthCol >= YEAR_MONTH_COLS) return null;
  const xLocal = point.x - monthCol * MONTH_STRIDE_X;
  if (xLocal >= MONTH_W) return null;

  const yearRow = Math.floor(point.y / YEAR_STRIDE_Y);
  const yLocal = point.y - yearRow * YEAR_STRIDE_Y;
  if (yLocal >= YEAR_H) return null;
  const monthRow = Math.floor(yLocal / MONTH_STRIDE_Y);
  const rowLocal = yLocal - monthRow * MONTH_STRIDE_Y;
  if (rowLocal >= MONTH_H || rowLocal < MONTH_HEADER_H) return null;

  const year = EPOCH_YEAR + yearRow;
  const monthIndex = monthRow * YEAR_MONTH_COLS + monthCol;
  const slot =
    Math.floor((rowLocal - MONTH_HEADER_H) / CELL_H) * MONTH_COLS + Math.floor(xLocal / CELL_W);
  const lead = mondayIndex(new Date(year, monthIndex, 1));
  const day = slot - lead + 1;
  return {
    date: new Date(year, monthIndex, day),
    inMonth: day >= 1 && day <= daysInMonth(year, monthIndex),
  };
}

/**
 * Months elapsed since the epoch month, so stepping is plain addition.
 *
 * Moving a month on this plane is not a fixed translation: within a year it
 * is one column right, then a wrap to the next row's first column, then a
 * wrap into the next year block entirely. Counting in months and mapping back
 * keeps every one of those cases in one place.
 */
export function monthOrdinal(year: number, monthIndex: number): number {
  return (year - EPOCH_YEAR) * 12 + monthIndex;
}

/** The year and month an ordinal names; negatives reach before the epoch. */
export function monthFromOrdinal(ordinal: number): { year: number; monthIndex: number } {
  return {
    year: EPOCH_YEAR + Math.floor(ordinal / 12),
    monthIndex: ((ordinal % 12) + 12) % 12,
  };
}

/**
 * The month occupying most of a visible rectangle.
 *
 * Deliberately not the month under the centre point: the centre of a year
 * block falls on the same row-and-column boundary every time, so a
 * centre-point rule reported one month while quite another filled the screen,
 * and always chose the same month when the whole year was in view.
 *
 * Scans at most three year blocks. Past that the viewport holds more calendar
 * than any single month can meaningfully claim, and the caller is showing a
 * year rather than a month anyway.
 */
export function monthForVisibleRect(rect: WorldRect): { year: number; monthIndex: number } {
  const firstYearRow = Math.floor(rect.y / YEAR_STRIDE_Y);
  const lastYearRow = Math.min(
    Math.floor((rect.y + rect.height) / YEAR_STRIDE_Y),
    firstYearRow + 2,
  );

  let best: { year: number; monthIndex: number } | null = null;
  let bestArea = 0;
  for (let row = firstYearRow; row <= lastYearRow; row++) {
    const year = EPOCH_YEAR + row;
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const month = monthRect(year, monthIndex);
      const overlapW =
        Math.min(rect.x + rect.width, month.x + month.width) - Math.max(rect.x, month.x);
      const overlapH =
        Math.min(rect.y + rect.height, month.y + month.height) - Math.max(rect.y, month.y);
      if (overlapW <= 0 || overlapH <= 0) continue;
      const area = overlapW * overlapH;
      if (area > bestArea) {
        bestArea = area;
        best = { year, monthIndex };
      }
    }
  }

  // Nothing of the calendar is in view — the desk east of the columns, say.
  // The nearest month to the centre is still the honest answer there.
  return (
    best ?? monthForWorldPoint({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
  );
}

/**
 * The month nearest a world point — always defined, even over gutters and
 * open desk space.
 */
export function monthForWorldPoint(point: { x: number; y: number }): {
  year: number;
  monthIndex: number;
} {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const monthCol = clamp(Math.floor(point.x / MONTH_STRIDE_X), 0, YEAR_MONTH_COLS - 1);
  const yearRow = Math.floor(point.y / YEAR_STRIDE_Y);
  const yLocal = point.y - yearRow * YEAR_STRIDE_Y;
  const monthRow = clamp(Math.floor(yLocal / MONTH_STRIDE_Y), 0, YEAR_MONTH_ROWS - 1);
  return { year: EPOCH_YEAR + yearRow, monthIndex: monthRow * YEAR_MONTH_COLS + monthCol };
}
