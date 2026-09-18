/**
 * Reactive pan/zoom state of the spatial workspace.
 *
 * Since milestone 2 the workspace is one continuous world: the detail tier
 * *derives* from the zoom level (`tierForZoom`), and the toolbar's tier
 * control applies zoom/position presets instead of switching scenes. All
 * arithmetic delegates to `@infinite-desk/canvas`.
 */

import { Injectable, computed, effect, signal } from '@angular/core';

import {
  CELL_H,
  MAX_ZOOM,
  MIN_ZOOM,
  MONTH_H,
  MONTH_W,
  cellRectForDate,
  dateForWorldPoint,
  fitZoom,
  monthForVisibleRect,
  monthFromOrdinal,
  monthOrdinal,
  monthOrigin,
  monthRect,
  panBy,
  screenToWorld,
  tierForZoom,
  yearRect,
  zoomAroundPoint,
  type Point,
  type ViewportState,
  type WorldRect,
} from '@infinite-desk/canvas';
import { daysInMonth } from '@infinite-desk/domain';

/** User-facing zoom tiers, closest first. */
export type Tier = 'Day' | 'Week' | 'Month' | 'Year';

const TIER_LABEL = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' } as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
/** Extra world-space margin east of a month kept visible by the month fit,
 * so desk objects parked beside the calendar stay on screen. */
const MONTH_FIT_MARGIN = 560;
/** Ratio one press of the zoom widget applies; about six presses per tier. */
const ZOOM_STEP = 1.25;
/**
 * Share of the view one month must cover for the navigator to name it.
 *
 * Below this the screen is holding a spread of months rather than one, so the
 * navigator reports the year instead. A year block gives each month about a
 * twelfth; a month that dominates the view is far above a fifth.
 */
const MONTH_NAMED_COVERAGE = 0.2;
/** Coverage at which the view sits wholly inside one month — no header in sight. */
const MONTH_FILLS_VIEW = 0.99;
/** Length of a glide between two framings. */
const GLIDE_MS = 420;
/** Screen distance below which a glide is not worth the frames. */
const SHORT_HOP = 24;

/** Whether the reader has asked the system for less motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

@Injectable({ providedIn: 'root' })
export class ViewportStore {
  private readonly state = signal<ViewportState>({ panX: 0, panY: 0, zoom: 0.5 });
  private sized = false;
  /** Handle of the glide in flight, so a new one replaces it rather than fighting it. */
  private flight: number | null = null;
  /** Suppresses the glide for a framing the reader did not ask to travel to. */
  private instant = false;
  /** True while a glide is in the air; readers wait for it to land. */
  readonly flying = signal(false);

  /** Viewport pixel size, kept current by the workspace's resize observer. */
  readonly viewSize = signal({ width: 1440, height: 900 });
  /** Tier preset applied on first layout (settable via `?tier=` for e2e). */
  initialTier: Tier = 'Month';

  /** Current pan/zoom snapshot. */
  readonly viewport = this.state.asReadonly();
  /** Zoom as a rounded percentage for the zoom widget. */
  readonly zoomPercent = computed(() => Math.round(this.state().zoom * 100));
  /** Detail tier derived from the zoom level. */
  readonly tier = computed<Tier>(() => TIER_LABEL[tierForZoom(this.state().zoom)]);

  /** The world rectangle currently on screen. */
  private readonly visibleRect = computed<WorldRect>(() => {
    const { width, height } = this.viewSize();
    const state = this.state();
    const topLeft = screenToWorld(state, { x: 0, y: 0 });
    const bottomRight = screenToWorld(state, { x: width, y: height });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  });

  /** The month most of the screen is showing — the navigation focus. */
  readonly focusedMonth = computed(() => monthForVisibleRect(this.visibleRect()));

  /**
   * The month the user was last reading, which is where a Month fit returns.
   *
   * Zooming out to look around must not lose your place. Once no single month
   * covers much of the screen there is no honest answer to which one is
   * focused — the old centre-point rule always said May, whatever had been on
   * screen before, because the centre of a year block falls on the same
   * boundary every time. So the month is held up there and only the year
   * follows, which means panning across years and coming back lands on the
   * same month of the year you moved to.
   */
  private readonly detailMonth = signal({
    year: new Date().getFullYear(),
    monthIndex: new Date().getMonth(),
  });
  private readonly followFocus = effect(() => {
    // A glide passes through framings nobody asked to be at. Reading position
    // from those overwrote the destination a step had just set, with whatever
    // the view happened to be crossing.
    if (this.flying()) return;
    const live = this.focusedMonth();
    // Dragged off the calendar onto bare desk: there is nothing to read a
    // position from, so hold the last one rather than taking a guess from a
    // view with no calendar in it.
    if (live.coverage === 0) return;
    if (live.coverage < MONTH_NAMED_COVERAGE) {
      this.detailMonth.update((held) => ({ ...held, year: live.year }));
      return;
    }
    this.detailMonth.set({ year: live.year, monthIndex: live.monthIndex });
  });

  /**
   * What the navigator's arrows move, and what its label names.
   *
   * Decided by how much of the screen one month covers rather than by the
   * zoom tier. The tier turns over to Year while a single month still fills
   * two thirds of the view, and at that point the label would stop naming the
   * month plainly being read and the same arrow would silently start moving
   * twelve of them. A year view gives every month about a twelfth.
   */
  readonly navUnit = computed<'month' | 'year'>(() => {
    const { coverage } = this.focusedMonth();
    // No calendar on screen at all is not a year view: an arrow here should
    // carry you back to a month you can read, not a year past the one you
    // last saw.
    if (coverage === 0) return 'month';
    return coverage < MONTH_NAMED_COVERAGE ? 'year' : 'month';
  });

  /**
   * Date-navigator label.
   *
   * Reads the same value the arrows move, so "the arrows move what the label
   * names" holds by construction rather than by the two happening to agree.
   */
  readonly navLabel = computed(() => {
    const focus = this.detailMonth();
    return this.navUnit() === 'year'
      ? String(focus.year)
      : `${MONTH_NAMES[focus.monthIndex]} ${focus.year}`;
  });

  /** World point currently at the viewport center. */
  centerWorld(): Point {
    const { width, height } = this.viewSize();
    return screenToWorld(this.state(), { x: width / 2, y: height / 2 });
  }

  /**
   * Records the workspace's pixel size. The first call applies the initial
   * tier preset (the store cannot fit anything before it knows the size).
   */
  setViewSize(width: number, height: number): void {
    this.viewSize.set({ width, height });
    if (!this.sized && width > 0) {
      this.sized = true;
      // First layout opens on today's month, not the world origin — and opens
      // there, rather than flying in from a framing nobody chose.
      this.instant = true;
      this.fitTier(this.initialTier, new Date());
      this.instant = false;
    }
  }

  /** Translates the viewport by a screen-space delta (gesture; no animation). */
  panByScreen(dx: number, dy: number): void {
    this.stopFlight();
    this.state.update((s) => panBy(s, dx, dy));
  }

  /** Sets the pan to an absolute screen offset (used while drag-panning). */
  panTo(x: number, y: number): void {
    this.stopFlight();
    this.state.update((s) => ({ ...s, panX: x, panY: y }));
  }

  /** Abandons a glide in flight; a hand on the desk outranks one. */
  private stopFlight(): void {
    if (this.flight === null) return;
    cancelAnimationFrame(this.flight);
    this.flight = null;
    this.flying.set(false);
  }

  /** Zooms by a factor around a screen-space focal point. */
  zoomAt(focus: Point, factor: number): void {
    this.stopFlight();
    this.state.update((s) => zoomAroundPoint(s, focus, factor, MIN_ZOOM, MAX_ZOOM));
  }

  /**
   * Steps zoom from the zoom widget, keeping the centre fixed.
   *
   * By a ratio, not by a fixed amount. Adding a constant makes the control
   * behave differently at every scale — a tenth is a fifth of the way in at
   * the month tier and a twentieth of the way at the day tier, so six presses
   * in covered the range that three presses out then undid twice over.
   */
  zoomStep(direction: 1 | -1): void {
    const { width, height } = this.viewSize();
    const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.state.update((s) =>
      zoomAroundPoint(s, { x: width / 2, y: height / 2 }, factor, MIN_ZOOM, MAX_ZOOM),
    );
  }

  /**
   * Applies a tier preset. Without an explicit anchor date, the preset
   * stays where the user is: it targets the focused month (and today's
   * cell when today lies within it).
   */
  fitTier(tier: Tier, anchorDate?: Date): void {
    // Without an anchor the preset returns to the month last read closely,
    // not to whatever the current framing happens to centre on.
    const focus = anchorDate
      ? { year: anchorDate.getFullYear(), monthIndex: anchorDate.getMonth() }
      : this.detailMonth();
    const today = new Date();
    const anchor =
      anchorDate ??
      (today.getFullYear() === focus.year && today.getMonth() === focus.monthIndex
        ? today
        : new Date(focus.year, focus.monthIndex, 15));
    switch (tier) {
      case 'Year':
        this.fitRect(yearRect(focus.year));
        break;
      case 'Month':
        this.fitMonthOf(focus.year, focus.monthIndex);
        break;
      case 'Week': {
        const cell = cellRectForDate(anchor);
        const origin = monthOrigin(focus.year, focus.monthIndex);
        this.centerRectAt({ x: origin.x, y: cell.y, width: MONTH_W, height: CELL_H }, 0.78);
        break;
      }
      case 'Day': {
        const cell = cellRectForDate(anchor);
        this.centerOn({ x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }, 1.6);
        break;
      }
    }
  }

  /**
   * Moves one step forward or back through time, keeping the zoom.
   *
   * The step is a month, or a year at the year tier — see {@link navUnit}.
   * Scrolling is no substitute: months run three across, so dragging downward
   * from September arrives at December, and a reader who does this for a
   * living mistook that for the weekday columns being wrong.
   *
   * Where you were inside the month is carried over rather than the month
   * being re-framed, so stepping on from the last week of one month arrives at
   * the last week of the next instead of jumping back to the middle.
   */
  step(delta: number): void {
    const from = this.detailMonth();
    const zoom = this.state().zoom;

    // A year step has to land on the year block, not on a month inside it.
    // Centring a month put the view across the seam between two blocks, where
    // the focus rule then read the wrong year back and undid the step — which
    // left the arrows inert for any month in the first row of a block.
    if (this.navUnit() === 'year') {
      const to = { year: from.year + delta, monthIndex: from.monthIndex };
      this.detailMonth.set(to);
      const block = yearRect(to.year);
      this.centerOn({ x: block.x + block.width / 2, y: block.y + block.height / 2 }, zoom);
      return;
    }

    const to = monthFromOrdinal(monthOrdinal(from.year, from.monthIndex) + delta);
    this.detailMonth.set(to);

    // Zoomed in past a whole month there is no month name on screen, so the
    // only sign that anything happened is the date under the cursor. Carrying
    // the date over makes "next" advance it; carrying a geometric offset
    // instead moved it backwards, because months start on different weekdays.
    if (this.focusedMonth().coverage >= MONTH_FILLS_VIEW) {
      const centred = dateForWorldPoint(this.centerWorld());
      const day = Math.min(centred?.date.getDate() ?? 15, daysInMonth(to.year, to.monthIndex));
      const cell = cellRectForDate(new Date(to.year, to.monthIndex, day));
      this.centerOn({ x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }, zoom);
      return;
    }

    // Framed exactly as a Month fit frames it, margin included. Centring the
    // bare month instead parked the sheet half a margin further right than the
    // view it was stepped from — about 128px — so the same screen position was
    // Friday in one month and Thursday in the next, and a note dropped by eye
    // landed a day early.
    const rect = this.monthFitRect(to.year, to.monthIndex);
    this.centerOn({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, zoom);
  }

  /** The rectangle a Month fit frames: the month plus its desk margin. */
  private monthFitRect(year: number, monthIndex: number): WorldRect {
    const rect = monthRect(year, monthIndex);
    return { ...rect, width: rect.width + MONTH_FIT_MARGIN };
  }

  /** Fits a specific month (plus its desk margin) into the viewport. */
  fitMonthOf(year: number, monthIndex: number): void {
    this.fitRect(this.monthFitRect(year, monthIndex));
  }

  /** Centers a date's cell on screen, zooming in to at least week level. */
  centerOnDate(date: Date): void {
    const cell = cellRectForDate(date);
    this.centerOn(
      { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 },
      Math.max(this.state().zoom, 0.78),
    );
  }

  /** Fits a world rect into the viewport with padding. */
  private fitRect(rect: WorldRect): void {
    this.centerRectAt(rect, fitZoom(rect, this.viewSize()));
  }

  /** Centers a world rect at an explicit zoom. */
  private centerRectAt(rect: WorldRect, zoom: number): void {
    this.centerOn({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, zoom);
  }

  /** Centers a world point at an explicit zoom, gliding there. */
  private centerOn(point: Point, zoom: number): void {
    const { width, height } = this.viewSize();
    this.glideTo({
      zoom,
      panX: width / 2 - point.x * zoom,
      panY: height / 2 - point.y * zoom,
    });
  }

  /**
   * Eases the viewport to a target instead of cutting to it.
   *
   * Months run three across, so one forward step in three wraps to the next
   * row and shares no pixels at all with the frame before it. Cutting made the
   * arrows work and the layout stay invisible — you could reach October
   * without ever learning it sits below July and two columns left. The flight
   * is the only thing in the product that shows the shape of the plane.
   *
   * Zoom eases geometrically: interpolating it linearly reads as a lurch,
   * because equal steps of zoom are not equal steps of apparent motion.
   */
  private glideTo(target: ViewportState): void {
    this.stopFlight();
    const from = this.state();
    const far =
      Math.abs(target.panX - from.panX) + Math.abs(target.panY - from.panY) > SHORT_HOP ||
      Math.abs(Math.log(target.zoom / from.zoom)) > 0.05;
    if (this.instant || !far || prefersReducedMotion()) {
      this.state.set(target);
      return;
    }

    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / GLIDE_MS);
      // Ease out cubic: leaves quickly, settles gently.
      const k = 1 - Math.pow(1 - t, 3);
      this.state.set({
        zoom: from.zoom * Math.pow(target.zoom / from.zoom, k),
        panX: from.panX + (target.panX - from.panX) * k,
        panY: from.panY + (target.panY - from.panY) * k,
      });
      if (t < 1) {
        this.flight = requestAnimationFrame(tick);
        return;
      }
      // Landed: clear the flag first, so the position the view settles at is
      // the one that gets read.
      this.flight = null;
      this.flying.set(false);
      this.state.set(target);
    };
    this.flying.set(true);
    this.flight = requestAnimationFrame(tick);
  }
}
