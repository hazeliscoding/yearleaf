/**
 * Dropping pictures onto the desk.
 *
 * Runs against the browser build, where imports are held in memory; the
 * desktop path copies the same bytes into the desk directory and is covered by
 * the Rust import tests.
 */

import { expect, test, type Page } from '@playwright/test';

interface FloatData {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly payload: { readonly kind: string; readonly attachmentId?: string };
}

declare global {
  interface Window {
    __e2e: {
      floats(): readonly FloatData[];
      toScreen(x: number, y: number): { x: number; y: number };
    };
  }
}

/**
 * A 4x2 truecolour PNG, so the aspect ratio is unmistakably landscape.
 *
 * Generated rather than hand-picked: browsers decode malformed PNGs in an
 * `<img>` but the renderer's stricter `createImageBitmap` path does not, so a
 * sloppy fixture would let a broken image silently pass as a working one.
 */
const WIDE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGM4EaABRwzIHACHGgoBR/08xAAAAABJRU5ErkJggg==';

async function openWorkspace(page: Page): Promise<void> {
  await page.goto('/?e2e');
  await page.locator('[data-scene-ready="true"]').waitFor();
}

const floats = (page: Page) => page.evaluate(() => window.__e2e.floats());

/**
 * Drops a file on the canvas.
 *
 * Playwright cannot synthesise an OS drag, so the event is built and
 * dispatched entirely inside the page: a `File` handed across the automation
 * boundary arrives without readable bytes, which looks exactly like a broken
 * import even though nothing is wrong with the app.
 */
async function dropFile(
  page: Page,
  name: string,
  mediaType: string,
  base64: string,
): Promise<void> {
  const box = (await page.locator('[data-screen-label="Canvas"]').boundingBox())!;
  await page.evaluate(
    ({ fileName, type, data, x, y }) => {
      const bytes = data ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) : new Uint8Array();
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], fileName, { type }));
      const canvas = document.querySelector('[data-screen-label="Canvas"]')!;
      for (const kind of ['dragover', 'drop']) {
        canvas.dispatchEvent(
          new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true, clientX: x, clientY: y }),
        );
      }
    },
    {
      fileName: name,
      type: mediaType,
      data: base64,
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    },
  );
}

/** Drops an image, the common case. */
const dropImage = (page: Page, name: string) => dropFile(page, name, 'image/png', WIDE_PNG_BASE64);

test('dropping a picture places it on the desk and draws it', async ({ page }) => {
  // The renderer picks a loader by file extension, and an imported URL may not
  // have one — a mis-parsed asset leaves the frame silently empty, which the
  // object model alone would not reveal.
  const rendererComplaints: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (
      text.includes('[Assets]') ||
      text.includes('could not be loaded') ||
      text.includes('could not load attachment')
    ) {
      rendererComplaints.push(text);
    }
  });

  await openWorkspace(page);
  const before = (await floats(page)).length;

  await dropImage(page, 'moodboard.png');
  await expect.poll(() => page.evaluate(() => window.__e2e.floats().length)).toBe(before + 1);

  const created = (await floats(page)).at(-1)!;
  expect(created.payload.kind).toBe('image');
  // The object names its attachment; the bytes never live in the payload.
  expect(created.payload.attachmentId).toBeTruthy();

  await page.waitForTimeout(600);
  expect(rendererComplaints, 'the bitmap must actually load').toEqual([]);
});

test('a dropped picture keeps its shape', async ({ page }) => {
  await openWorkspace(page);
  await dropImage(page, 'wide.png');
  await expect.poll(() => page.evaluate(() => window.__e2e.floats().length)).toBeGreaterThan(0);

  const created = (await floats(page)).at(-1)!;
  // The source is 4x2, so the frame must be twice as wide as it is tall
  // rather than defaulting to a square and snapping when the bitmap loads.
  expect(created.width / created.height).toBeCloseTo(2, 1);
});

test('dropping a picture is undoable', async ({ page }) => {
  await openWorkspace(page);
  const before = (await floats(page)).length;

  await dropImage(page, 'moodboard.png');
  await expect.poll(() => page.evaluate(() => window.__e2e.floats().length)).toBe(before + 1);

  await page.keyboard.press('Control+z');
  expect((await floats(page)).length).toBe(before);
});

test('a non-image drop is ignored, and cancelled', async ({ page }) => {
  await openWorkspace(page);
  const before = (await floats(page)).length;

  // Both halves matter. An uncancelled file drop is opened in place by the
  // browser, and the desktop window has no address bar to come back from —
  // dropping a PDF would replace the desk with the PDF.
  const cancelled = await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['notes'], 'notes.txt', { type: 'text/plain' }));
    const canvas = document.querySelector('[data-screen-label="Canvas"]')!;
    const drop = new DragEvent('drop', {
      dataTransfer: transfer,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(drop);
    return drop.defaultPrevented;
  });

  await page.waitForTimeout(300);
  expect(cancelled, 'the browser must not be left to open the file').toBe(true);
  expect((await floats(page)).length).toBe(before);
});
