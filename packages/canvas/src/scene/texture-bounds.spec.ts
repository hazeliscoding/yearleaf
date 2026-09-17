import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_TEXTURE_SIDE, boundToTextureCeiling } from './texture-bounds';

/**
 * A stand-in for a decoded picture. Node has no `createImageBitmap`, and the
 * rule under test is arithmetic about sizes rather than anything about pixels.
 */
function fakeBitmap(width: number, height: number): ImageBitmap & { closed: boolean } {
  return {
    width,
    height,
    closed: false,
    close(this: { closed: boolean }) {
      this.closed = true;
    },
  } as unknown as ImageBitmap & { closed: boolean };
}

/** Installs a `createImageBitmap` that honours the requested resize. */
function stubDecoder(): void {
  vi.stubGlobal(
    'createImageBitmap',
    async (_source: unknown, options: { resizeWidth: number; resizeHeight: number }) =>
      fakeBitmap(options.resizeWidth, options.resizeHeight),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('boundToTextureCeiling', () => {
  it('leaves a picture within the ceiling exactly as it came', async () => {
    stubDecoder();
    const source = fakeBitmap(1600, 900);

    const bounded = await boundToTextureCeiling(source);

    expect(bounded).toBe(source);
    // Returning a copy here would double the memory of the common case, and
    // closing the original would blank a picture that was already fine.
    expect(source.closed).toBe(false);
  });

  it('scales a tall picture by its height, the side that is over', async () => {
    stubDecoder();

    const bounded = await boundToTextureCeiling(fakeBitmap(3000, 4000));

    expect(bounded.height).toBe(MAX_TEXTURE_SIDE);
    expect(bounded.width).toBe(1536);
  });

  it('scales a wide picture by its width and keeps the shape', async () => {
    stubDecoder();

    const bounded = await boundToTextureCeiling(fakeBitmap(6000, 4000));

    expect(bounded.width).toBe(MAX_TEXTURE_SIDE);
    // The frame is drawn from the source aspect, so a texture that does not
    // match it would letterbox or stretch the picture inside its own frame.
    expect(bounded.width / bounded.height).toBeCloseTo(1.5, 2);
  });

  it('releases the oversized original once the smaller one exists', async () => {
    stubDecoder();
    const source = fakeBitmap(8000, 6000);

    await boundToTextureCeiling(source);

    expect(source.closed).toBe(true);
  });

  it('never asks for a zero-pixel side, however extreme the shape', async () => {
    stubDecoder();

    // A panorama scaled by its long side rounds the short one towards nothing;
    // a zero-sided bitmap is a decode error rather than a small picture.
    const bounded = await boundToTextureCeiling(fakeBitmap(40000, 8));

    expect(bounded.width).toBe(MAX_TEXTURE_SIDE);
    expect(bounded.height).toBeGreaterThan(0);
  });
});
