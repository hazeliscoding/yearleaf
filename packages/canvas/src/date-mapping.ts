/**
 * The single documented mapping between calendar dates and world
 * coordinates, shared by rendering, hit testing, navigation, search jumps,
 * printing, and export (architecture guardrail: exactly one such mapping).
 *
 * ## Scheme
 *
 * - The world X axis is time. Day `N` (counted from {@link WORLD_EPOCH})
 *   occupies the half-open interval `[N * DAY_WORLD_WIDTH, (N + 1) * DAY_WORLD_WIDTH)`.
 * - The epoch is 2020-01-01 (UTC), safely before any data the product will
 *   hold, so ordinals stay positive for real desks while negative ordinals
 *   remain well-defined for dates before the epoch.
 * - `DAY_WORLD_WIDTH` is 320 world units: at zoom 1.0 a day is 320 px wide,
 *   wide enough for the day-page tier without fractional-unit precision
 *   issues across many decades (±100 years ≈ ±1.2e7 units, comfortably
 *   inside float64 integer range).
 *
 * The Y axis is free space owned by layout (sheets, notes); it carries no
 * date meaning.
 */

/** Origin of the time axis: 2020-01-01T00:00:00Z. */
export const WORLD_EPOCH_MS = Date.UTC(2020, 0, 1);

/** Width of one day in world units. */
export const DAY_WORLD_WIDTH = 320;

/** Milliseconds in one day. */
const DAY_MS = 86_400_000;

/**
 * Whole days elapsed from {@link WORLD_EPOCH_MS} to the given date's
 * calendar day (local calendar reading, epoch-relative counting).
 * Negative for dates before the epoch.
 */
export function dayOrdinal(date: Date): number {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utcMidnight - WORLD_EPOCH_MS) / DAY_MS);
}

/** World X coordinate of the left edge of the given date's day column. */
export function worldXForDate(date: Date): number {
  return dayOrdinal(date) * DAY_WORLD_WIDTH;
}

/**
 * The calendar date whose day column contains the given world X.
 *
 * Inverse of {@link worldXForDate} for every X inside a day column:
 * `dateForWorldX(worldXForDate(d) + f)` is `d` for any `0 <= f < DAY_WORLD_WIDTH`.
 *
 * @returns A `Date` at local midnight of the resolved day.
 */
export function dateForWorldX(x: number): Date {
  const ordinal = Math.floor(x / DAY_WORLD_WIDTH);
  const utc = new Date(WORLD_EPOCH_MS + ordinal * DAY_MS);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}
