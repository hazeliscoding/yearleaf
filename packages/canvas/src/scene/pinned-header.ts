/**
 * The band that keeps the current month's name on screen once its own header
 * has scrolled off the top.
 *
 * Months sit three across and four down on the plane, so dragging downward
 * moves three months, not one. A reader who does this for a living dragged
 * down from September, arrived in December, and spent minutes certain the
 * weekday columns were misaligned — they were not, she was simply a quarter
 * further on than she believed, and nothing on the desk said so. Once you are
 * panned into a month's grid the sheet's own title is above the viewport and
 * every month looks alike.
 *
 * So this pins the title, and the weekday letters with it, aligned to the
 * columns they name. It is a report of where you already are rather than a new
 * control: it appears only when the real header is out of sight and never
 * claims a month that is not on screen.
 */

import { Container, Graphics, Text } from 'pixi.js';

import {
  CELL_W,
  EPOCH_YEAR,
  MONTH_COLS,
  MONTH_H,
  MONTH_HEADER_H,
  MONTH_W,
  YEAR_STRIDE_Y,
  monthOrigin,
  type WorldRect,
} from '../month-layout';
import type { ThemeTokens } from './theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Height of the band in screen pixels; fixed, so it reads at any zoom. */
export const PINNED_HEADER_H = 34;
/** Below this the day columns are too narrow to letter legibly. */
const MIN_COLUMN_PX = 34;
/** Share of the view a sheet must show before its name is worth pinning. */
const MIN_SHARE_TO_NAME = 0.15;

/** What the band needs to know; all screen-space except the world rect. */
export interface PinnedHeaderState {
  readonly visible: WorldRect;
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
  readonly viewWidth: number;
}

/**
 * The month being read into whose own title has scrolled off the top.
 *
 * Not simply the month filling most of the screen: drifting down from
 * September puts September's last rows along the top and December's sheet,
 * header and all, below them — and December is what fills the screen. The
 * unnamed one is the one that needs naming, and it is also the one that makes
 * the layout deceptive, because the sheet above December is September rather
 * than November. Where more than one qualifies, the one showing most of
 * itself wins.
 */
export function monthNeedingItsName(
  state: PinnedHeaderState,
): { year: number; monthIndex: number } | null {
  const { visible } = state;
  const firstYearRow = Math.floor(visible.y / YEAR_STRIDE_Y);
  const lastYearRow = Math.min(
    Math.floor((visible.y + visible.height) / YEAR_STRIDE_Y),
    firstYearRow + 1,
  );

  let best: { year: number; monthIndex: number } | null = null;
  let bestArea = 0;
  for (let row = firstYearRow; row <= lastYearRow; row++) {
    const year = EPOCH_YEAR + row;
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const origin = monthOrigin(year, monthIndex);
      // Its title is on screen, so it is already saying its own name.
      if (state.panY + (origin.y + MONTH_HEADER_H) * state.zoom > 0) continue;

      const overlapW =
        Math.min(visible.x + visible.width, origin.x + MONTH_W) - Math.max(visible.x, origin.x);
      const overlapH =
        Math.min(visible.y + visible.height, origin.y + MONTH_H) - Math.max(visible.y, origin.y);
      if (overlapW <= 0 || overlapH <= 0) continue;
      const area = overlapW * overlapH;
      // A sliver is not a sheet you are reading. The default framing leaves a
      // few pixels of the month above peeking over the gutter, and naming that
      // would put a header on screen for a month nobody is looking at.
      if (area < visible.width * visible.height * MIN_SHARE_TO_NAME) continue;
      if (area > bestArea) {
        bestArea = area;
        best = { year, monthIndex };
      }
    }
  }
  return best;
}

/**
 * Rebuilds the band into `into`, or empties it when it does not apply.
 *
 * @returns The month being reported, or `null` when the band is hidden.
 */
export function drawPinnedHeader(
  into: Container,
  state: PinnedHeaderState,
  theme: ThemeTokens,
): { year: number; monthIndex: number } | null {
  into.removeChildren().forEach((child) => child.destroy({ children: true }));

  const focus = monthNeedingItsName(state);
  if (!focus) return null;

  const origin = monthOrigin(focus.year, focus.monthIndex);
  // Only as wide as the sheet it belongs to, so it reads as that sheet's own
  // title held in place rather than as another strip of toolbar — and so it
  // does not cover the desk beside the calendar.
  const left = Math.max(0, state.panX + origin.x * state.zoom);
  const right = Math.min(state.viewWidth, state.panX + (origin.x + MONTH_W) * state.zoom);
  if (right - left < 120) return null;

  const background = new Graphics();
  background
    .rect(left, 0, right - left, PINNED_HEADER_H)
    .fill({ color: theme.surfacePaper, alpha: 0.97 });
  background
    .moveTo(left, PINNED_HEADER_H)
    .lineTo(right, PINNED_HEADER_H)
    .stroke({ width: 1, color: theme.border });
  into.addChild(background);

  const title = new Text({
    text: `${MONTH_NAMES[focus.monthIndex]} ${focus.year}`,
    style: {
      fontFamily: theme.fontCalendar,
      fontSize: 15,
      fontWeight: '600',
      fill: theme.inkPrimary,
    },
  });
  title.position.set(left + 14, (PINNED_HEADER_H - title.height) / 2);
  into.addChild(title);

  // The letters sit over the columns they name, which is the half of this that
  // answers "are these columns in the wrong place".
  const columnWidth = CELL_W * state.zoom;
  if (columnWidth >= MIN_COLUMN_PX) {
    const titleEnds = title.x + title.width + 16;
    for (let col = 0; col < MONTH_COLS; col++) {
      const columnLeft = state.panX + (origin.x + col * CELL_W) * state.zoom;
      if (columnLeft + columnWidth < 0 || columnLeft > state.viewWidth) continue;
      const label = new Text({
        text: WEEKDAYS[col],
        style: {
          fontFamily: theme.fontUI,
          fontSize: 10.5,
          fontWeight: '500',
          letterSpacing: 1.1,
          fill: col > 4 ? theme.inkDisabled : theme.inkMuted,
        },
      });
      // Measured, not guessed from the column edge: at a close zoom a column
      // is wide enough that its letter clears the title even though the column
      // itself starts behind it, and Monday is exactly the letter a reader
      // doubting the columns wants to see.
      const letterX = Math.round(columnLeft + (columnWidth - label.width) / 2);
      if (letterX < titleEnds) {
        label.destroy();
        continue;
      }
      label.position.set(letterX, Math.round((PINNED_HEADER_H - label.height) / 2));
      into.addChild(label);
    }
  }

  return { year: focus.year, monthIndex: focus.monthIndex };
}
