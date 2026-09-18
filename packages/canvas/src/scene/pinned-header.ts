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
export const PINNED_HEADER_H = 38;
/** Below this the day columns are too narrow to letter legibly. */
const MIN_COLUMN_PX = 34;
/** How far below the top edge a sheet must reach before its name is pinned. */
const MIN_DEPTH_PX = 80;
/** Below this a sheet is too small on screen for anyone to be reading into it. */
const MIN_SHEET_PX = 320;
/** How near the top a sheet's own header must be for the band to speak for it. */
const BAND_TAKEOVER_PX = 120;

/** What the band needs to know; all screen-space except the world rect. */
export interface PinnedHeaderState {
  readonly visible: WorldRect;
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
  readonly viewWidth: number;
}

/** Where a sheet draws its own title, relative to the sheet's origin. */
const TITLE_INSET_X = 28;
const TITLE_TOP = 26;
const TITLE_BOTTOM = 110;

/** Whether a sheet's own printed title is fully on screen. */
function titleOnScreen(origin: { x: number; y: number }, state: PinnedHeaderState): boolean {
  const { visible } = state;
  return (
    origin.x + TITLE_INSET_X >= visible.x &&
    origin.y + TITLE_TOP >= visible.y &&
    origin.y + TITLE_BOTTOM <= visible.y + visible.height
  );
}

/**
 * The month being read into whose own title has scrolled out of sight.
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
  // A sheet too small on screen to read is not one anybody is reading into.
  if (MONTH_W * state.zoom < MIN_SHEET_PX) return null;

  const firstYearRow = Math.floor(visible.y / YEAR_STRIDE_Y);
  const lastYearRow = Math.min(
    Math.floor((visible.y + visible.height) / YEAR_STRIDE_Y),
    firstYearRow + 1,
  );

  let best: { year: number; monthIndex: number } | null = null;
  let bestOverlap = 0;
  for (let row = firstYearRow; row <= lastYearRow; row++) {
    const year = EPOCH_YEAR + row;
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const origin = monthOrigin(year, monthIndex);
      // Two ways a sheet needs its name said. Either the top edge has been
      // scrolled into its grid — the section a sticky header labels — or its
      // own header band is on screen but showing blank, which is what a reader
      // panned rightwards across a sheet is looking at. Comparing areas instead
      // went wrong in both directions: it named a month covering most of a tall
      // narrow window when the sheet in hand was labelled, and refused to name
      // anything at a close zoom, where a fraction of one sheet fills the
      // screen and the name is needed most.
      const scrolledInto =
        visible.y >= origin.y &&
        visible.y < origin.y + MONTH_H &&
        // Reaching barely below the top edge is the gutter's neighbour peeking
        // over, not a sheet being read.
        (origin.y + MONTH_H - visible.y) * state.zoom >= MIN_DEPTH_PX;
      // Near the top, specifically. The band sits at the top of the screen, so
      // it may only stand in for a header that is also at the top — a sheet
      // whose title is clipped at the *bottom* of the view is not one this can
      // speak for, and naming it put December's name over September's paper.
      const bandShowing =
        origin.y + MONTH_HEADER_H > visible.y &&
        (origin.y - visible.y) * state.zoom <= BAND_TAKEOVER_PX;
      if (!scrolledInto && !bandShowing) continue;
      // Its own title is on screen, so it is already saying its name. Testing
      // the header *band* instead was wrong in a way that mattered: the title
      // sits at the band's far left, so panning right across a sheet left the
      // band on screen, blank, with the rail suppressed behind it — a screen
      // and a half of scrolling with no month named anywhere.
      if (titleOnScreen(origin, state)) continue;

      const overlapW =
        Math.min(visible.x + visible.width, origin.x + MONTH_W) - Math.max(visible.x, origin.x);
      if (overlapW <= 0) continue;
      if (overlapW > bestOverlap) {
        bestOverlap = overlapW;
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
  background.rect(left, 0, right - left, PINNED_HEADER_H).fill(theme.surfacePaper);
  background
    .moveTo(left, PINNED_HEADER_H)
    .lineTo(right, PINNED_HEADER_H)
    .stroke({ width: 1, color: theme.border });
  into.addChild(background);

  // Two rows, the way the sheet's own header stacks them. Setting the title
  // beside the letters instead put it in Monday's seat and left six columns
  // named and one not — which is the very shape that had a reader concluding
  // the columns were printed wrong.
  const title = new Text({
    text: `${MONTH_NAMES[focus.monthIndex]} ${focus.year}`,
    style: {
      fontFamily: theme.fontCalendar,
      fontSize: 13,
      fontWeight: '600',
      fill: theme.inkPrimary,
    },
  });
  title.position.set(left + 14, 3);
  into.addChild(title);

  // The letters sit over the columns they name, which is the half of this that
  // answers "are these columns in the wrong place" — but not when the sheet's
  // own weekday row is still on screen just below, where a second set is only
  // the same words twice.
  const ownLettersShowing = origin.y + MONTH_HEADER_H - 32 > state.visible.y;
  const columnWidth = CELL_W * state.zoom;
  if (columnWidth >= MIN_COLUMN_PX && !ownLettersShowing) {
    for (let col = 0; col < MONTH_COLS; col++) {
      const columnLeft = state.panX + (origin.x + col * CELL_W) * state.zoom;
      if (columnLeft + columnWidth < 0 || columnLeft > state.viewWidth) continue;
      const label = new Text({
        text: WEEKDAYS[col],
        style: {
          fontFamily: theme.fontUI,
          fontSize: 10,
          // The sheet marks the weekend by dropping to the disabled ink, which
          // measures about 2:1 — fine at world scale on a printed sheet, not on
          // a fixed 10px surface. Weight carries the distinction here instead,
          // so all seven stay readable.
          fontWeight: col > 4 ? '400' : '600',
          letterSpacing: 1.1,
          fill: theme.inkSecondary,
        },
      });
      label.position.set(
        Math.round(columnLeft + (columnWidth - label.width) / 2),
        PINNED_HEADER_H - 15,
      );
      into.addChild(label);
    }
  }

  return { year: focus.year, monthIndex: focus.monthIndex };
}
