import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { WorldRect } from '@infinite-desk/canvas';

import { ViewportStore } from './viewport-store';

const VIEW = { width: 1400, height: 900 };
/** What the inspector takes when it opens, in CSS pixels. */
const PANEL = 264;

describe('ViewportStore.revealRect', () => {
  let store: ViewportStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ViewportStore);
    store.setViewSize(VIEW.width, VIEW.height);
  });

  /** A world rect covering the given screen box in the current framing. */
  function atScreen(left: number, top: number, width: number, height: number): WorldRect {
    const v = store.viewport();
    return {
      x: (left - v.panX) / v.zoom,
      y: (top - v.panY) / v.zoom,
      width: width / v.zoom,
      height: height / v.zoom,
    };
  }

  /** Where a world rect paints now. */
  function onScreen(rect: WorldRect) {
    const v = store.viewport();
    return {
      left: v.panX + rect.x * v.zoom,
      top: v.panY + rect.y * v.zoom,
      right: v.panX + (rect.x + rect.width) * v.zoom,
      bottom: v.panY + (rect.y + rect.height) * v.zoom,
    };
  }

  it('leaves the desk exactly where it is when the rect is already in view', () => {
    const rect = atScreen(200, 300, 260, 180);
    const before = store.viewport();

    store.revealRect(rect, 16);

    // The property the centre-preserving rule could not offer: selecting
    // something already on screen must not move the world at all.
    expect(store.viewport()).toEqual(before);
  });

  it('pans the least distance that brings a rect back inside the right edge', () => {
    // Sitting where the inspector is about to open, and 40px beyond it.
    const rect = atScreen(VIEW.width - PANEL + 40, 300, 260, 180);
    const before = store.viewport();
    const overhang = onScreen(rect).right - (VIEW.width - 16);
    expect(overhang).toBeGreaterThan(0);

    store.revealRect(rect, 16);

    expect(onScreen(rect).right).toBeCloseTo(VIEW.width - 16, 6);
    // Least distance: the pan moved by the overhang and not a pixel more,
    // and the axis that was never at fault did not move at all.
    expect(before.panX - store.viewport().panX).toBeCloseTo(overhang, 6);
    expect(store.viewport().panY).toBe(before.panY);
    expect(store.viewport().zoom).toBe(before.zoom);
  });

  it('brings a rect back inside the bottom edge the same way', () => {
    const rect = atScreen(200, VIEW.height + 30, 260, 180);
    const before = store.viewport();

    store.revealRect(rect, 16);

    expect(onScreen(rect).bottom).toBeCloseTo(VIEW.height - 16, 6);
    expect(store.viewport().panX).toBe(before.panX);
  });

  it('shows the near edge of a rect too big to fit rather than its far one', () => {
    // Wider and taller than the viewport: honouring the far edge would push
    // the near one off, which is the worse half of it to lose.
    const rect = atScreen(-200, -150, VIEW.width + 600, VIEW.height + 400);

    store.revealRect(rect, 16);

    const painted = onScreen(rect);
    expect(painted.left).toBeCloseTo(16, 6);
    expect(painted.top).toBeCloseTo(16, 6);
  });

  it('does not scale anything: revealing is a pan', () => {
    const zoom = store.viewport().zoom;
    store.revealRect(atScreen(VIEW.width + 400, 300, 260, 180), 16);
    expect(store.viewport().zoom).toBe(zoom);
  });
});
