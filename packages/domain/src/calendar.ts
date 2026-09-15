/**
 * Calendar math shared by rendering, navigation, and search.
 *
 * All grids are Monday-first, matching the Deskbound design system's
 * week headers. Dates are handled as local-time `Date` instances; only
 * the year/month/day components are ever read back out.
 */

/** One slot in a month grid: a concrete date plus its display flags. */
export interface MonthGridCell {
  /** The concrete date this cell represents. */
  readonly date: Date;
  /** Day-of-month (1–31) of {@link date}. */
  readonly day: number;
  /** `true` when the date belongs to the grid's own month (not an adjacent-month filler). */
  readonly inMonth: boolean;
  /** `true` for Saturday and Sunday. */
  readonly weekend: boolean;
}

/** Weekday index with Monday = 0 … Sunday = 6. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Number of days in the given month (`monthIndex` is 0-based). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Builds the complete Monday-first grid for one month.
 *
 * The grid always contains whole weeks: leading and trailing cells are
 * filled with the adjacent months' dates and flagged `inMonth: false`,
 * exactly as the calendar sheet renders them.
 *
 * @param year - Full calendar year, e.g. `2026`.
 * @param monthIndex - Zero-based month, e.g. `8` for September.
 * @returns Cells in row-major order; length is always a multiple of 7.
 */
export function buildMonthGrid(year: number, monthIndex: number): MonthGridCell[] {
  const first = new Date(year, monthIndex, 1);
  const lead = mondayIndex(first);
  const total = lead + daysInMonth(year, monthIndex);
  const weeks = Math.ceil(total / 7);
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(year, monthIndex, 1 - lead + i);
    cells.push({
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
      weekend: mondayIndex(date) > 4,
    });
  }
  return cells;
}

/** `true` when both dates fall on the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** ISO-8601 week number (1–53) of the given date. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604_800_000);
}

/** Day-of-year ordinal (1–366) of the given date. */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}
