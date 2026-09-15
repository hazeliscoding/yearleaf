/**
 * Viewport math for the spatial workspace: screen/world conversion,
 * focal-point-preserving zoom, and the progressive-detail tier rules.
 *
 * All functions are pure — the renderer owns the state, this module owns
 * the arithmetic — so the same math serves DOM and PixiJS rendering,
 * hit testing, and tests.
 */

/** Immutable pan/zoom state of the workspace viewport. */
export interface ViewportState {
  /** Screen-space X translation applied before scaling, in pixels. */
  readonly panX: number;
  /** Screen-space Y translation applied before scaling, in pixels. */
  readonly panY: number;
  /** Uniform scale factor; 1.0 renders one world unit as one pixel. */
  readonly zoom: number;
}

/** A 2D point (world or screen space depending on context). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Zoom bounds used by the first milestone's workspace. */
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 1.8;

/**
 * Progressive-detail tiers and the zoom fractions where they switch,
 * mirroring `--zoom-year/month/week/day` in the Deskbound tokens.
 * A tier is active from its threshold up to the next tier's threshold.
 */
export const ZOOM_TIERS = {
  year: 0.12,
  month: 0.35,
  week: 0.75,
  day: 1.5,
} as const;

/** Names of the progressive-detail tiers, ordered from farthest to closest. */
export type ZoomTier = keyof typeof ZOOM_TIERS;

/** Converts a screen-space point to world space under the given viewport. */
export function screenToWorld(state: ViewportState, screen: Point): Point {
  return {
    x: (screen.x - state.panX) / state.zoom,
    y: (screen.y - state.panY) / state.zoom,
  };
}

/** Converts a world-space point to screen space under the given viewport. */
export function worldToScreen(state: ViewportState, world: Point): Point {
  return {
    x: world.x * state.zoom + state.panX,
    y: world.y * state.zoom + state.panY,
  };
}

/** Translates the viewport by a screen-space delta. */
export function panBy(state: ViewportState, dx: number, dy: number): ViewportState {
  return { panX: state.panX + dx, panY: state.panY + dy, zoom: state.zoom };
}

/**
 * Scales the viewport by `factor` while keeping the world point under
 * `focus` (a screen-space point) stationary on screen — the "zoom preserves
 * the focal point" behavior required by the testing strategy.
 *
 * @param state - Current viewport.
 * @param focus - Screen-space point to keep fixed, e.g. the cursor.
 * @param factor - Multiplicative zoom change (>1 zooms in).
 * @param min - Lower zoom clamp; defaults to {@link MIN_ZOOM}.
 * @param max - Upper zoom clamp; defaults to {@link MAX_ZOOM}.
 */
export function zoomAroundPoint(
  state: ViewportState,
  focus: Point,
  factor: number,
  min: number = MIN_ZOOM,
  max: number = MAX_ZOOM,
): ViewportState {
  const zoom = Math.min(max, Math.max(min, state.zoom * factor));
  const scale = zoom / state.zoom;
  return {
    zoom,
    panX: focus.x - (focus.x - state.panX) * scale,
    panY: focus.y - (focus.y - state.panY) * scale,
  };
}

/**
 * Resolves which progressive-detail tier is active at the given zoom.
 * Zooms below the year threshold still resolve to `year` (there is no
 * farther tier).
 */
export function tierForZoom(zoom: number): ZoomTier {
  if (zoom >= ZOOM_TIERS.day) return 'day';
  if (zoom >= ZOOM_TIERS.week) return 'week';
  if (zoom >= ZOOM_TIERS.month) return 'month';
  return 'year';
}
