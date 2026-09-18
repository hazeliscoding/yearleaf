import { describe, expect, it } from 'vitest';

import { MONTH_H, MONTH_HEADER_H, MONTH_W, monthOrigin } from '../month-layout';
import { monthNeedingItsName, type PinnedHeaderState } from './pinned-header';

const VIEW = { width: 1400, height: 900 };

/**
 * Builds the state for a viewport whose top-left corner sits at a world point.
 *
 * Pan is the screen offset of the world origin, so framing a world point at
 * the top-left is the negation of it, scaled.
 */
function viewingFrom(x: number, y: number, zoom = 0.455): PinnedHeaderState {
  return {
    visible: { x, y, width: VIEW.width / zoom, height: VIEW.height / zoom },
    panX: -x * zoom,
    panY: -y * zoom,
    zoom,
    viewWidth: VIEW.width,
  };
}

describe('monthNeedingItsName', () => {
  it('says nothing while the sheet is showing its own title', () => {
    // Framed on September the way a Month fit frames it: the header is right
    // there, and a second copy of it would be noise.
    const september = monthOrigin(2026, 8);
    expect(monthNeedingItsName(viewingFrom(september.x - 40, september.y - 40))).toBeNull();
  });

  it('names the month once its title has gone off the top', () => {
    // Drifted down into the grid, which is where every month looks alike.
    const september = monthOrigin(2026, 8);
    expect(monthNeedingItsName(viewingFrom(september.x, september.y + MONTH_HEADER_H + 200))).toEqual(
      { year: 2026, monthIndex: 8 },
    );
  });

  it('names the month when the title is off the left, band still showing', () => {
    // A sheet prints its title at the far left of its header band, so panning
    // right across the sheet leaves the band on screen and empty. Testing the
    // band rather than the title suppressed the rail here — a screen and a
    // half of scrolling with no month named anywhere on it.
    const september = monthOrigin(2026, 8);
    const state = viewingFrom(september.x + 900, september.y - 40);

    // The band really is on screen in this frame; only the title is not.
    expect(state.panY + (september.y + MONTH_HEADER_H) * state.zoom).toBeGreaterThan(0);

    expect(monthNeedingItsName(state)).toEqual({ year: 2026, monthIndex: 8 });
  });

  it('names the unlabelled sheet, not the one filling the screen', () => {
    // This is the exact frame that misled a professional calendar reader:
    // September's last rows along the top, December's sheet — header and all —
    // filling the rest. December says its own name; September does not, and
    // September is the surprise, because the sheet above December is not
    // November.
    const september = monthOrigin(2026, 8);
    const state = viewingFrom(september.x, september.y + MONTH_H - 700);

    const december = monthOrigin(2026, 11);
    // Check the frame really is what the test claims before trusting the result.
    expect(state.panY + (december.y + MONTH_HEADER_H) * state.zoom).toBeGreaterThan(0);

    expect(monthNeedingItsName(state)).toEqual({ year: 2026, monthIndex: 8 });
  });

  it('follows the reader across the boundary into the next sheet', () => {
    // Carry on down and December's own header leaves the top too. The band
    // changing from September to December is the whole point: it is the moment
    // that used to pass unannounced.
    const december = monthOrigin(2026, 11);
    expect(monthNeedingItsName(viewingFrom(december.x, december.y + MONTH_HEADER_H + 400))).toEqual({
      year: 2026,
      monthIndex: 11,
    });
  });

  it('says nothing on bare desk east of the columns', () => {
    // Claiming a month with no calendar on screen would be the same class of
    // lie the band exists to prevent.
    const september = monthOrigin(2026, 8);
    expect(
      monthNeedingItsName(viewingFrom(september.x + MONTH_W + 4000, september.y + 900)),
    ).toBeNull();
  });

  it('ignores the neighbour peeking over the gutter, at any window shape', () => {
    // The default framing leaves a few pixels of the month above showing. It
    // qualified once on a tall narrow window, where the threshold was a share
    // of the viewport and the same sliver counted for more.
    const september = monthOrigin(2026, 8);
    for (const [width, height] of [
      [1400, 900],
      [520, 700],
      [760, 1400],
    ] as const) {
      const zoom = 0.455;
      const top = september.y - 150;
      expect(
        monthNeedingItsName({
          visible: { x: september.x - 60, y: top, width: width / zoom, height: height / zoom },
          panX: -(september.x - 60) * zoom,
          panY: -top * zoom,
          zoom,
          viewWidth: width,
        }),
        `a sliver should not claim the band at ${width}x${height}`,
      ).toBeNull();
    }
  });

  it('says nothing when a sheet is too small on screen to be read into', () => {
    // Panned a little at a whole-year framing the top edge sits inside some
    // sheet, but at that size nobody is reading it — they are looking at the
    // year, and every sheet is captioned anyway.
    const april = monthOrigin(2026, 3);
    const zoom = 0.12;
    const top = april.y + 400;
    expect(
      monthNeedingItsName({
        visible: { x: april.x, y: top, width: 1400 / zoom, height: 900 / zoom },
        panX: -april.x * zoom,
        panY: -top * zoom,
        zoom,
        viewWidth: 1400,
      }),
    ).toBeNull();
  });

  it('says nothing at a whole-year framing, where every sheet is titled', () => {
    const january = monthOrigin(2027, 0);
    expect(monthNeedingItsName(viewingFrom(january.x - 200, january.y - 200, 0.12))).toBeNull();
  });

  it('names the month when zoomed in past any header at all', () => {
    // The state where the reader has three day cells and nothing else, and
    // decided the columns must be wrong.
    const march = monthOrigin(2027, 2);
    expect(
      monthNeedingItsName(viewingFrom(march.x + 300, march.y + MONTH_HEADER_H + 600, 1.6)),
    ).toEqual({ year: 2027, monthIndex: 2 });
  });
});
