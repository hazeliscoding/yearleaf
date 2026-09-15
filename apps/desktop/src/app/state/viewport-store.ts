/**
 * Reactive pan/zoom/tier state of the spatial workspace.
 *
 * All arithmetic delegates to `@infinite-desk/canvas` so the same math is
 * shared with tests and, later, the PixiJS scene.
 */

import { Injectable, computed, signal } from '@angular/core';

import {
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  zoomAroundPoint,
  type Point,
  type ViewportState,
} from '@infinite-desk/canvas';

/** User-facing zoom tiers, ordered closest to farthest. */
export type Tier = 'Day' | 'Week' | 'Month' | 'Year';

/** Zoom applied when a sheet is fit to the window. */
const FIT_ZOOM = 0.92;

@Injectable({ providedIn: 'root' })
export class ViewportStore {
  private readonly state = signal<ViewportState>({ panX: 0, panY: 0, zoom: FIT_ZOOM });

  /** Active detail tier shown on the canvas. */
  readonly tier = signal<Tier>('Month');
  /** Whether the next transform change animates (fits/jumps do, gestures don't). */
  readonly animate = signal(true);
  /** Current pan/zoom snapshot. */
  readonly viewport = this.state.asReadonly();
  /** Zoom as a rounded percentage for the zoom widget. */
  readonly zoomPercent = computed(() => Math.round(this.state().zoom * 100));
  /** CSS transform string for the world container. */
  readonly worldTransform = computed(() => {
    const { panX, panY, zoom } = this.state();
    return `translate(${panX}px,${panY}px) scale(${zoom})`;
  });

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

  /**
   * Zooms by a multiplicative factor around a screen-space focal point,
   * keeping the content under the cursor stationary.
   */
  zoomAt(focus: Point, factor: number): void {
    this.animate.set(false);
    this.state.update((s) => zoomAroundPoint(s, focus, factor, MIN_ZOOM, MAX_ZOOM));
  }

  /** Steps zoom from the zoom widget (animated, centered on current pan). */
  zoomStep(delta: number): void {
    this.animate.set(true);
    this.state.update((s) => ({
      ...s,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom + delta)),
    }));
  }

  /** Switches tier and refits the sheet to its home position. */
  fitTier(tier: Tier): void {
    this.tier.set(tier);
    this.animate.set(true);
    this.state.set({ panX: 0, panY: 0, zoom: FIT_ZOOM });
  }
}
