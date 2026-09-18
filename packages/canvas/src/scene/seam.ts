/**
 * The seam: what a gutter between two sheets says about the two sheets.
 *
 * Months sit three across, so the sheet below one is three months on, not
 * one. A reader who does this for a living dragged down from September,
 * arrived in December, and concluded the weekday columns were misprinted —
 * three sessions running. The layout does not merely withhold the answer, it
 * supplies the wrong one: September's grid ends with October the 5th to the
 * 11th in its trailing cells, then a strip of bare desk, then a sheet starting
 * "30 1 2 3". Read downward that is "…October 8, 9, 10, 11 … 30, 1, 2, 3".
 *
 * So the gutter states the *relationship* rather than naming the sheet below.
 * Naming it would be a smaller copy of the seventy-two-unit title that has
 * already been ignored three times; the distance is the one fact neither sheet
 * can state about itself.
 *
 * It is said twice over, for two different eyes. **Bars** carry it to an eye
 * that is moving: three rules sweeping up across a sheet's width against blank
 * desk is a texture event, readable at a glance, and the count *is* the
 * distance — three bars between rows, one down the side gutter where the
 * neighbour really is next. They carry no direction, so they cannot contradict
 * each other the way a row of arrows would, and they stay true read upward.
 * **Type** carries it to an eye that has stopped: `3 MONTHS` once along the
 * seam and `1 MONTH` set along the side gutter, and at a row's end a catchword
 * naming the month the sequence continues on, marked with a stroke that drops
 * a row and runs back to the start of it.
 *
 * The same reader who was caught three times confirmed the distance label
 * works — "someone finally put a sign on the trapdoor" — and measured the
 * failure in the first version of the catchword's mark, whose only arrowhead
 * pointed down, at December, while the word beside it said October.
 */

import { Container, Graphics, Text } from 'pixi.js';

import { MONTH_H, MONTH_HEADER_H, MONTH_W, monthFromOrdinal, monthOrdinal } from '../month-layout';
import type { ZoomTier } from '../viewport';
import { MONTH_NAMES } from './month-names';
import type { ThemeTokens } from './theme';

/** Ink a seam element asks for; resolved against the theme when drawn. */
export type SeamTone = 'muted' | 'accent' | 'secondary';

/** One typeset line on a seam, positioned in sheet-local coordinates. */
export interface SeamText {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly size: number;
  readonly weight: '500' | '600';
  readonly tone: SeamTone;
}

/** A bar, split into the runs that survive after the type is cut out of it. */
export interface SeamBar {
  readonly y: number;
  readonly runs: readonly (readonly [number, number])[];
}

/** Everything a seam draws, as plain numbers, so it can be checked without a renderer. */
export interface SeamPlan {
  /** A year seam sits under the last row and carries the heavier mark. */
  readonly kind: 'month' | 'year';
  readonly gap: number;
  readonly bars: readonly SeamBar[];
  readonly barWidth: number;
  readonly barAlpha: number;
  readonly texts: readonly SeamText[];
  /** Set only at a row's end, where the next month is not the sheet to the right. */
  readonly catchword: { readonly name: string; readonly year: number | null } | null;
  /** The side gutter's single bar: one month across, where the count is one. */
  readonly verticalBar: { readonly x: number; readonly y0: number; readonly y1: number } | null;
}

/** Columns of sheets in a year block. */
const COLS = 3;
/** Inset at each end of a month seam, leaving the crossroads open. */
const SEAM_INSET = 24;
/** Gutter below a sheet within a year block, and below the last row. */
const MONTH_GUTTER = 100;
const YEAR_GUTTER = 240;
/** Where the one legend sits along a seam. */
const LEGEND_X = MONTH_W / 2 + 24;
/** Shorter than this a surviving run is a speck, not a rule. */
const MIN_RUN = 48;
/** Air kept around type when a bar is cut to make room for it. */
const TEXT_CLEARANCE = 14;

/**
 * Removes the stretches a bar cannot occupy, returning what is left of it.
 *
 * The bar breaks for its own label rather than a plate being painted behind
 * the text: a rule that breaks for its lettering is ordinary drafting, and it
 * leaves the desk's paper grid running continuously underneath. A knockout
 * rectangle would erase the grid and read as a panel laid on the desk.
 */
export function splitRun(
  x0: number,
  x1: number,
  breaks: readonly (readonly [number, number])[],
): (readonly [number, number])[] {
  let runs: (readonly [number, number])[] = [[x0, x1]];
  for (const [bx0, bx1] of breaks) {
    const next: (readonly [number, number])[] = [];
    for (const [rx0, rx1] of runs) {
      if (bx1 <= rx0 || bx0 >= rx1) {
        next.push([rx0, rx1]);
        continue;
      }
      if (bx0 > rx0) next.push([rx0, bx0]);
      if (bx1 < rx1) next.push([bx1, rx1]);
    }
    runs = next;
  }
  return runs.filter(([a, b]) => b - a > MIN_RUN);
}

/**
 * Plans the seam below one sheet, or `null` when it draws nothing.
 *
 * Sheet-local: the month's container is already positioned at its origin, so
 * `MONTH_H` is the top of the gutter beneath it.
 */
export function planSeam(year: number, monthIndex: number, tier: ZoomTier): SeamPlan | null {
  const col = monthIndex % COLS;
  const row = Math.floor(monthIndex / COLS);
  const kind = row === 3 ? 'year' : 'month';
  const gap = kind === 'year' ? YEAR_GUTTER : MONTH_GUTTER;
  const mid = MONTH_H + gap / 2;

  // Pulled back, the block boundary is the one that survives — the way a county
  // line outlasts street names as a map zooms out. Month seams go, and with
  // them all the lettering, since none of it can be read at that size.
  if (tier === 'year') {
    if (kind !== 'year') return null;
    return {
      kind,
      gap,
      bars: [mid - 60, mid, mid + 60].map((y) => ({ y, runs: [[0, yearSliceWidth(col)] as const] })),
      barWidth: 12,
      barAlpha: 0.7,
      texts: [],
      catchword: null,
      verticalBar: null,
    };
  }

  const texts: SeamText[] = [];
  const barYs =
    kind === 'year' ? [mid - 60, mid, mid + 60] : [mid - 34, mid, mid + 34];
  const [x0, x1] =
    kind === 'year' ? [0, yearSliceWidth(col)] : [SEAM_INSET, MONTH_W - SEAM_INSET];

  // `3 MONTHS` at every horizontal seam, the year boundary included — below
  // December 2026 really is March 2027. A constant string is recognised rather
  // than read, which is the point for an eye that is moving.
  // Once per seam, not twice. The same words repeated along one strip read as
  // texture rather than as a message, and the message is the point.
  const legendY = kind === 'year' ? mid - 18 : mid;
  texts.push({ x: LEGEND_X, y: legendY, text: '3 MONTHS', size: 34, weight: '500', tone: 'muted' });
  if (kind === 'year') {
    // The year beyond this boundary, which is the block's year plus one in
    // every column. Taking the successor *month's* year instead was right only
    // under December: under October it read "2026 BEGINS" above a sheet headed
    // January 2027, and one strip carried two different years at once.
    texts.push({
      x: LEGEND_X,
      y: mid + 19,
      // The only colour on any seam, spent on the only fact `3 MONTHS` omits.
      text: `${year + 1} BEGINS`,
      size: 28,
      weight: '600',
      tone: 'accent',
    });
  }

  const catchword =
    col === COLS - 1
      ? (() => {
          const next = monthFromOrdinal(monthOrdinal(year, monthIndex) + 1);
          return {
            name: MONTH_NAMES[next.monthIndex],
            year: next.year === year ? null : next.year,
          };
        })()
      : null;

  return {
    kind,
    gap,
    // Runs are cut once the type is measured, which only the drawer can do.
    bars: barYs.map((y) => ({ y, runs: [[x0, x1] as const] })),
    barWidth: 5,
    barAlpha: kind === 'year' ? 0.7 : 0.55,
    texts,
    catchword,
    // Sideways really is one month, so the side gutter carries one bar. Drawing
    // only the three-bar mark would state half of a binary and leave the other
    // half ambiguous.
    // Sideways really is one month, so the side gutter carries one bar — and
    // says so. It is the one direction where the step is a single month and
    // the desk had declined to mention it.
    verticalBar:
      col < COLS - 1
        ? { x: MONTH_W + MONTH_GUTTER / 2, y0: MONTH_HEADER_H, y1: MONTH_H }
        : null,
  };
}

/**
 * How far a year seam runs from a sheet's own left edge.
 *
 * The three slices abut exactly, so the block boundary is one unbroken rule
 * across all three columns while the month seams stop short of every sheet
 * edge. That contrast is the hierarchy, drawn rather than described.
 */
function yearSliceWidth(col: number): number {
  return col < COLS - 1 ? MONTH_W + MONTH_GUTTER : MONTH_W;
}

/** Right inset of the catchword, mirroring the sheet's own title margin. */
const CATCHWORD_INSET = 28;

/** Resolves a tone to the theme's ink. */
function inkFor(tone: SeamTone, theme: ThemeTokens): number {
  if (tone === 'accent') return theme.accent;
  if (tone === 'secondary') return theme.inkSecondary;
  return theme.inkMuted;
}

/**
 * Draws the seam below a sheet into its container.
 *
 * The type is laid out first because only a measured label knows how wide a
 * hole it needs; the bars are then cut around whatever landed on their line.
 */
export function drawSeam(
  into: Container,
  year: number,
  monthIndex: number,
  tier: ZoomTier,
  theme: ThemeTokens,
): void {
  const plan = planSeam(year, monthIndex, tier);
  if (!plan) return;

  /** Stretches of each bar's line already spoken for, keyed by bar y. */
  const breaks = new Map<number, (readonly [number, number])[]>();
  const claim = (label: Text) => {
    const top = label.y;
    const bottom = label.y + label.height;
    for (const bar of plan.bars) {
      if (bar.y < top || bar.y > bottom) continue;
      const taken = breaks.get(bar.y) ?? [];
      taken.push([label.x - TEXT_CLEARANCE, label.x + label.width + TEXT_CLEARANCE]);
      breaks.set(bar.y, taken);
    }
  };

  for (const spec of plan.texts) {
    const label = new Text({
      text: spec.text,
      style: {
        fontFamily: theme.fontUI,
        fontSize: spec.size,
        fontWeight: spec.weight,
        letterSpacing: 2.4,
        fill: inkFor(spec.tone, theme),
      },
    });
    label.position.set(spec.x, spec.y - label.height / 2);
    claim(label);
    into.addChild(label);
  }

  if (plan.catchword) {
    const mid = MONTH_H + plan.gap / 2;
    const text =
      plan.catchword.year === null
        ? plan.catchword.name
        : `${plan.catchword.name} ${plan.catchword.year}`;
    const label = new Text({
      text,
      style: {
        fontFamily: theme.fontUI,
        fontSize: 40,
        fontWeight: '600',
        fill: theme.inkSecondary,
      },
    });
    label.position.set(MONTH_W - CATCHWORD_INSET - label.width, mid - label.height / 2);
    into.addChild(label);

    // Drop a row, then run back to the start of it — and the head points the
    // way it ends, which is left. It ended pointing *down* at first, and a
    // reader measured the consequence: the head said "down", the word said
    // October, and the sheet forty pixels below said December, so the mark
    // confirmed the very mistake it exists to prevent. Down alone is December,
    // left alone is August, and the diagonal points through paper at November;
    // only the drop-then-return is the move. Drawn rather than typeset, for the
    // reason recorded on drawRepeatMarker.
    const hx1 = label.x - 18;
    const hx0 = hx1 - 46;
    const hook = new Graphics();
    hook
      .moveTo(hx1, mid - 10)
      .lineTo(hx1, mid + 12)
      .lineTo(hx0 + 12, mid + 12)
      .stroke({ width: 4, color: theme.inkSecondary, cap: 'round', join: 'round' });
    hook
      .moveTo(hx0, mid + 12)
      .lineTo(hx0 + 14, mid + 3)
      .lineTo(hx0 + 14, mid + 21)
      .fill(theme.inkSecondary);
    into.addChild(hook);
    claim(label);
    breaks.set(mid, [...(breaks.get(mid) ?? []), [hx0 - 8, hx1]]);
  }

  const bars = new Graphics();
  for (const bar of plan.bars) {
    for (const [from, to] of splitRun(
      bar.runs[0][0],
      bar.runs[0][1],
      breaks.get(bar.y) ?? [],
    )) {
      bars.moveTo(from, bar.y).lineTo(to, bar.y);
    }
  }
  if (plan.verticalBar) {
    bars
      .moveTo(plan.verticalBar.x, plan.verticalBar.y0)
      .lineTo(plan.verticalBar.x, plan.verticalBar.y1);

    // Set along the gutter, because the gutter is a hundred units wide and
    // "1 MONTH" laid flat is not. Sideways is the one direction where a step
    // really is a single month, and it was the one direction the desk had
    // nothing to say about.
    const sideways = new Text({
      text: '1 MONTH',
      style: {
        fontFamily: theme.fontUI,
        fontSize: 30,
        fontWeight: '500',
        letterSpacing: 2.4,
        fill: theme.inkMuted,
      },
    });
    sideways.rotation = -Math.PI / 2;
    sideways.position.set(
      plan.verticalBar.x + sideways.height / 2,
      (plan.verticalBar.y0 + plan.verticalBar.y1) / 2 + sideways.width / 2,
    );
    into.addChild(sideways);
  }
  bars.stroke({ width: plan.barWidth, color: theme.inkMuted, alpha: plan.barAlpha });
  into.addChildAt(bars, 0);
}
