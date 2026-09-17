/**
 * Recurrence rules for repeating events.
 *
 * Rules are stored as RFC 5545 `RRULE` strings, but only the subset the
 * application can honour is accepted — an unsupported part is rejected rather
 * than silently dropped, so a stored rule never promises more than the desk
 * delivers (see docs/design-recurrence.md).
 *
 * Everything here operates on **floating calendar dates**: a desk is laid out
 * by day, so an event's time is a label inside its chip, never an instant on a
 * timeline. That removes time zones and daylight-saving arithmetic — the part
 * of RFC 5545 implementations most often get wrong.
 */

import { daysInMonth, mondayIndex } from './calendar';

/** Frequencies the desk supports. */
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Weekday codes, listed Monday-first to match the calendar grids. */
export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

/** One weekday code, e.g. `'TU'`. */
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

/** A `BYDAY` entry: a weekday, optionally an nth-of-month ordinal. */
export interface ByDayEntry {
  /** The weekday itself. */
  readonly weekday: WeekdayCode;
  /**
   * Ordinal within the month for monthly and yearly rules: `3` is the third
   * such weekday, `-1` the last. Omitted for weekly rules, which repeat every
   * matching weekday of every active week.
   */
  readonly nth?: number;
}

/** A validated recurrence rule. */
export interface RecurrenceRule {
  readonly freq: RecurrenceFrequency;
  /** Periods between occurrences; always at least 1. */
  readonly interval: number;
  /** Weekdays the rule applies to. */
  readonly byDay?: readonly ByDayEntry[];
  /** Days of the month (1–31, or negative from the month's end). */
  readonly byMonthDay?: readonly number[];
  /** Total number of occurrences, counted from the series start. */
  readonly count?: number;
  /** Last date the series may produce, inclusive. */
  readonly until?: Date;
  /** First day of the week, which decides where weekly intervals fall. */
  readonly weekStart: WeekdayCode;
}

/** A half-open-free date window; both ends are inclusive. */
export interface DateWindow {
  readonly from: Date;
  readonly to: Date;
}

/**
 * Upper bound on candidate dates examined for one expansion.
 *
 * Expansion walks forward from the series start, so a window far in the future
 * costs proportionally. The cap keeps a malformed or absurd request from
 * hanging the renderer; legitimate desks never approach it.
 */
const MAX_STEPS = 20_000;

/** Parts of `RRULE` this implementation accepts. */
const SUPPORTED_PARTS = new Set([
  'FREQ',
  'INTERVAL',
  'BYDAY',
  'BYMONTHDAY',
  'COUNT',
  'UNTIL',
  'WKST',
]);

/** Thrown when a rule uses syntax or parts the desk cannot honour. */
export class UnsupportedRecurrenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedRecurrenceError';
  }
}

/** Midnight of the given date, discarding any time component. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The date `days` after `date`, normalised to midnight. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Weekday code of a date. */
function weekdayOf(date: Date): WeekdayCode {
  return WEEKDAY_CODES[mondayIndex(date)];
}

/** Index of a weekday code relative to a week that starts on `weekStart`. */
function offsetInWeek(weekday: WeekdayCode, weekStart: WeekdayCode): number {
  return (WEEKDAY_CODES.indexOf(weekday) - WEEKDAY_CODES.indexOf(weekStart) + 7) % 7;
}

/**
 * Resolves an nth weekday within a month, e.g. the third Wednesday.
 *
 * @returns The date, or `null` when the month has no such occurrence (a fifth
 *   Monday in a short month, say) — RFC 5545 skips those rather than clamping.
 */
function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: WeekdayCode,
  nth: number,
): Date | null {
  const length = daysInMonth(year, monthIndex);
  const target = WEEKDAY_CODES.indexOf(weekday);
  if (nth > 0) {
    const first = new Date(year, monthIndex, 1);
    const day = 1 + ((target - mondayIndex(first) + 7) % 7) + (nth - 1) * 7;
    return day <= length ? new Date(year, monthIndex, day) : null;
  }
  const last = new Date(year, monthIndex, length);
  const day = length - ((mondayIndex(last) - target + 7) % 7) + (nth + 1) * 7;
  return day >= 1 ? new Date(year, monthIndex, day) : null;
}

/** Resolves a `BYMONTHDAY` value, which may count back from the month's end. */
function monthDay(year: number, monthIndex: number, value: number): Date | null {
  const length = daysInMonth(year, monthIndex);
  const day = value > 0 ? value : length + value + 1;
  return day >= 1 && day <= length ? new Date(year, monthIndex, day) : null;
}

/** Parses `YYYYMMDD` (and the `YYYYMMDDTHHMMSSZ` form, whose time is ignored). */
function parseUntil(value: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(value);
  if (!match) {
    throw new UnsupportedRecurrenceError(`UNTIL must be a YYYYMMDD date, got "${value}"`);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Parses one `BYDAY` entry, e.g. `TU` or `-1FR`. */
function parseByDay(token: string): ByDayEntry {
  const match = /^([+-]?\d)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(token);
  if (!match) {
    throw new UnsupportedRecurrenceError(`BYDAY entry "${token}" is not supported`);
  }
  const weekday = match[2] as WeekdayCode;
  return match[1] ? { weekday, nth: Number(match[1]) } : { weekday };
}

/**
 * Parses an RFC 5545 `RRULE` into a validated rule.
 *
 * @param text - The rule body, with or without the leading `RRULE:`.
 * @throws UnsupportedRecurrenceError when any part cannot be honoured.
 */
export function parseRecurrenceRule(text: string): RecurrenceRule {
  const body = text.trim().replace(/^RRULE:/i, '');
  if (!body) throw new UnsupportedRecurrenceError('Recurrence rule is empty');

  const parts = new Map<string, string>();
  for (const chunk of body.split(';')) {
    if (!chunk) continue;
    const eq = chunk.indexOf('=');
    if (eq < 0) throw new UnsupportedRecurrenceError(`Malformed rule part "${chunk}"`);
    const key = chunk.slice(0, eq).toUpperCase();
    if (!SUPPORTED_PARTS.has(key)) {
      throw new UnsupportedRecurrenceError(
        `${key} is not supported — a stored rule must not promise more than the desk honours`,
      );
    }
    parts.set(key, chunk.slice(eq + 1).toUpperCase());
  }

  const freq = parts.get('FREQ');
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') {
    throw new UnsupportedRecurrenceError(`FREQ must be DAILY, WEEKLY, MONTHLY or YEARLY`);
  }

  const interval = parts.has('INTERVAL') ? Number(parts.get('INTERVAL')) : 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new UnsupportedRecurrenceError('INTERVAL must be a positive whole number');
  }

  if (parts.has('COUNT') && parts.has('UNTIL')) {
    throw new UnsupportedRecurrenceError('COUNT and UNTIL cannot both be set');
  }

  const count = parts.has('COUNT') ? Number(parts.get('COUNT')) : undefined;
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
    throw new UnsupportedRecurrenceError('COUNT must be a positive whole number');
  }

  const byDay = parts.has('BYDAY')
    ? parts.get('BYDAY')!.split(',').filter(Boolean).map(parseByDay)
    : undefined;
  if (byDay?.some((entry) => entry.nth !== undefined) && freq === 'WEEKLY') {
    throw new UnsupportedRecurrenceError('An nth weekday is meaningless for a weekly rule');
  }

  const byMonthDay = parts.has('BYMONTHDAY')
    ? parts
        .get('BYMONTHDAY')!
        .split(',')
        .filter(Boolean)
        .map((value) => {
          const day = Number(value);
          if (!Number.isInteger(day) || day === 0 || day < -31 || day > 31) {
            throw new UnsupportedRecurrenceError(`BYMONTHDAY value "${value}" is out of range`);
          }
          return day;
        })
    : undefined;

  const weekStartRaw = parts.get('WKST') ?? 'MO';
  if (!WEEKDAY_CODES.includes(weekStartRaw as WeekdayCode)) {
    throw new UnsupportedRecurrenceError(`WKST "${weekStartRaw}" is not a weekday`);
  }

  return {
    freq,
    interval,
    byDay,
    byMonthDay,
    count,
    until: parts.has('UNTIL') ? parseUntil(parts.get('UNTIL')!) : undefined,
    weekStart: weekStartRaw as WeekdayCode,
  };
}

/** Renders a rule back to its `RRULE` body, round-tripping {@link parseRecurrenceRule}. */
export function formatRecurrenceRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay?.length) {
    parts.push(
      `BYDAY=${rule.byDay.map((d) => `${d.nth ?? ''}${d.weekday}`).join(',')}`,
    );
  }
  if (rule.byMonthDay?.length) parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
  if (rule.until) {
    const y = rule.until.getFullYear();
    const m = String(rule.until.getMonth() + 1).padStart(2, '0');
    const d = String(rule.until.getDate()).padStart(2, '0');
    parts.push(`UNTIL=${y}${m}${d}`);
  }
  if (rule.weekStart !== 'MO') parts.push(`WKST=${rule.weekStart}`);
  return parts.join(';');
}

/** Candidate dates for one period, ascending; invalid ones are dropped. */
function datesForPeriod(rule: RecurrenceRule, start: Date, period: number): Date[] {
  switch (rule.freq) {
    case 'DAILY': {
      const date = addDays(start, period * rule.interval);
      // BYDAY narrows a daily rule to particular weekdays.
      if (rule.byDay?.length && !rule.byDay.some((d) => d.weekday === weekdayOf(date))) {
        return [];
      }
      return [date];
    }
    case 'WEEKLY': {
      const weekBase = addDays(
        addDays(start, -offsetInWeek(weekdayOf(start), rule.weekStart)),
        period * rule.interval * 7,
      );
      const weekdays = rule.byDay?.length
        ? rule.byDay.map((d) => d.weekday)
        : [weekdayOf(start)];
      return weekdays
        .map((weekday) => addDays(weekBase, offsetInWeek(weekday, rule.weekStart)))
        .sort((a, b) => a.getTime() - b.getTime());
    }
    case 'MONTHLY':
    case 'YEARLY': {
      const step = rule.freq === 'MONTHLY' ? period * rule.interval : 0;
      const year =
        rule.freq === 'MONTHLY'
          ? start.getFullYear()
          : start.getFullYear() + period * rule.interval;
      const monthCursor = new Date(year, start.getMonth() + step, 1);
      const y = monthCursor.getFullYear();
      const m = monthCursor.getMonth();

      let dates: (Date | null)[];
      if (rule.byMonthDay?.length) {
        dates = rule.byMonthDay.map((value) => monthDay(y, m, value));
      } else if (rule.byDay?.length) {
        dates = rule.byDay.map((entry) =>
          entry.nth === undefined
            ? nthWeekdayOfMonth(y, m, entry.weekday, 1)
            : nthWeekdayOfMonth(y, m, entry.weekday, entry.nth),
        );
      } else {
        dates = [monthDay(y, m, start.getDate())];
      }
      return dates
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());
    }
  }
}

/**
 * Expands a rule into the concrete dates falling inside a window.
 *
 * Occurrences are always counted from the series start, so `COUNT` stays
 * correct no matter which window is asked for.
 *
 * @param rule - The validated rule.
 * @param seriesStart - The series anchor (`DTSTART`); always an occurrence,
 *   unless a `BYDAY`/`BYMONTHDAY` part excludes its own weekday or day.
 * @param window - Inclusive date range to collect, typically the visible months.
 * @returns Ascending dates inside the window.
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  seriesStart: Date,
  window: DateWindow,
): Date[] {
  const start = startOfDay(seriesStart);
  const from = startOfDay(window.from);
  const to = startOfDay(window.to);
  const until = rule.until ? startOfDay(rule.until) : null;
  if (to < from) return [];

  const found: Date[] = [];
  let emitted = 0;

  for (let period = 0; period < MAX_STEPS; period++) {
    const candidates = datesForPeriod(rule, start, period);
    // A period can legitimately yield nothing (a month without a 31st), so
    // only a candidate past the window ends the walk.
    let exhausted = false;
    for (const date of candidates) {
      if (date < start) continue;
      if (rule.count !== undefined && emitted >= rule.count) return found;
      if (until && date > until) return found;
      if (date > to) {
        exhausted = true;
        break;
      }
      emitted++;
      if (date >= from) found.push(date);
    }
    if (exhausted) break;
  }
  return found;
}
