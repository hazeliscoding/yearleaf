import { describe, expect, it } from 'vitest';

import {
  fitZoom,
  panBy,
  screenToWorld,
  tierForZoom,
  worldToScreen,
  zoomAroundPoint,
  type ViewportState,
} from './viewport';

const identity: ViewportState = { panX: 0, panY: 0, zoom: 1 };

describe('viewport transforms', () => {
  it('round-trips screen and world coordinates', () => {
    const state: ViewportState = { panX: 120, panY: -40, zoom: 0.92 };
    const world = { x: 512, y: 384 };
    const screen = worldToScreen(state, world);
    const back = screenToWorld(state, screen);
    expect(back.x).toBeCloseTo(world.x, 9);
    expect(back.y).toBeCloseTo(world.y, 9);
  });

  it('pans by screen deltas without touching zoom', () => {
    const state = panBy(identity, 30, -12);
    expect(state).toEqual({ panX: 30, panY: -12, zoom: 1 });
  });

  it('keeps the focal point stationary while zooming', () => {
    const state: ViewportState = { panX: 80, panY: 60, zoom: 0.9 };
    const focus = { x: 400, y: 300 };
    const worldBefore = screenToWorld(state, focus);
    const zoomed = zoomAroundPoint(state, focus, 1.25);
    const worldAfter = screenToWorld(zoomed, focus);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9);
  });

  it('clamps zoom to the configured bounds', () => {
    expect(zoomAroundPoint(identity, { x: 0, y: 0 }, 100).zoom).toBe(2);
    expect(zoomAroundPoint(identity, { x: 0, y: 0 }, 0.0001).zoom).toBe(0.08);
  });

  it('fits a rect inside a viewport with padding, clamped to zoom bounds', () => {
    // A year block (~6920×6620) in a 1440×900 viewport lands in the year band.
    const zoom = fitZoom({ width: 6920, height: 6620 }, { width: 1440, height: 900 });
    expect(zoom).toBeGreaterThan(0.08);
    expect(zoom).toBeLessThan(0.35);
    // A tiny rect clamps to MAX_ZOOM instead of zooming absurdly far in.
    expect(fitZoom({ width: 10, height: 10 }, { width: 1440, height: 900 })).toBe(2);
  });
});

describe('tierForZoom', () => {
  it('resolves each tier at and above its threshold', () => {
    expect(tierForZoom(0.05)).toBe('year');
    expect(tierForZoom(0.12)).toBe('year');
    expect(tierForZoom(0.35)).toBe('month');
    expect(tierForZoom(0.74)).toBe('month');
    expect(tierForZoom(0.75)).toBe('week');
    expect(tierForZoom(1.49)).toBe('week');
    expect(tierForZoom(1.5)).toBe('day');
    expect(tierForZoom(1.8)).toBe('day');
  });
});
