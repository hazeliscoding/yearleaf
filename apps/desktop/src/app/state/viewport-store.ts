/**
 * Reactive pan/zoom state of the spatial workspace.
 *
 * Since milestone 2 the workspace is one continuous world: the detail tier
 * *derives* from the zoom level (`tierForZoom`), and the toolbar's tier
 * control applies zoom/position presets instead of switching scenes. All
 * arithmetic delegates to `@infinite-desk/canvas`.
 */

import { Injectable, computed, signal } from '@angular/core';

import {
  CELL_H,
  MAX_ZOOM,
  MIN_ZOOM,
  MONTH_W,
  cellRectForDate,
  fitZoom,
  monthForWorldPoint,
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

@Injectable({ providedIn: 'root' })
export class ViewportStore {
  private readonly state = signal<ViewportState>({ panX: 0, panY: 0, zoom: 0.5 });
  private sized = false;

  /** Viewport pixel size, kept current by the workspace's resize observer. */
  readonly viewSize = signal({ width: 1440, height: 900 });
  /** Whether the next transform change animates (fits/jumps do, gestures don't). */
  readonly animate = signal(true);
  /** Tier preset applied on first layout (settable via `?tier=` for e2e). */
  initialTier: Tier = 'Month';

  /** Current pan/zoom snapshot. */
  readonly viewport = this.state.asReadonly();
  /** Zoom as a rounded percentage for the zoom widget. */
  readonly zoomPercent = computed(() => Math.round(this.state().zoom * 100));
  /** Detail tier derived from the zoom level. */
  readonly tier = computed<Tier>(() => TIER_LABEL[tierForZoom(this.state().zoom)]);

  /** The month under the viewport center — the navigation focus. */
  readonly focusedMonth = computed(() => {
    const { width, height } = this.viewSize();
    return monthForWorldPoint(screenToWorld(this.state(), { x: width / 2, y: height / 2 }));
  });

  /** Date-navigator label for the current tier and focus. */
  readonly navLabel = computed(() => {
    const focus = this.focusedMonth();
    return this.tier() === 'Year'
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
      // First layout opens on today's month, not the world origin.
      this.fitTier(this.initialTier, new Date());
    }
  }

  /** Translates the viewport by a screen-space delta (gesture; no animation). */
  panByScreen(dx: number, dy: number): void {
    this.animate.set(false);
    this.state.update((s) => panBy(s, dx, dy));
  }

  /** Sets the pan to an absolute screen offset (used while drag-panning). */
  panTo(x: number, y: number): void {
    this.animate.set(false);
    this.state.update((s) => ({ ...s, panX: x, panY: y }));
  }

  /** Zooms by a factor around a screen-space focal point. */
  zoomAt(focus: Point, factor: number): void {
    this.animate.set(false);
    this.state.update((s) => zoomAroundPoint(s, focus, factor, MIN_ZOOM, MAX_ZOOM));
  }

  /** Steps zoom from the zoom widget, keeping the center fixed. */
  zoomStep(delta: number): void {
    this.animate.set(true);
    const { width, height } = this.viewSize();
    this.state.update((s) => {
      const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom + delta));
      return zoomAroundPoint(s, { x: width / 2, y: height / 2 }, target / s.zoom, MIN_ZOOM, MAX_ZOOM);
    });
  }

  /**
   * Applies a tier preset. Without an explicit anchor date, the preset
   * stays where the user is: it targets the focused month (and today's
   * cell when today lies within it).
   */
  fitTier(tier: Tier, anchorDate?: Date): void {
    const focus = anchorDate
      ? { year: anchorDate.getFullYear(), monthIndex: anchorDate.getMonth() }
      : this.focusedMonth();
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

  /** Fits a specific month (plus its desk margin) into the viewport. */
  fitMonthOf(year: number, monthIndex: number): void {
    const rect = monthRect(year, monthIndex);
    this.fitRect({ ...rect, width: rect.width + MONTH_FIT_MARGIN });
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

  /** Centers a world point at an explicit zoom (animated). */
  private centerOn(point: Point, zoom: number): void {
    this.animate.set(true);
    const { width, height } = this.viewSize();
    this.state.set({
      zoom,
      panX: width / 2 - point.x * zoom,
      panY: height / 2 - point.y * zoom,
    });
  }
}
