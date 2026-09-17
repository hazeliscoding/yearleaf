/**
 * Object creation flows: an armed tool must place its object where the user
 * clicked, and an abandoned composition must leave nothing behind.
 */

import { expect, test, type Page } from '@playwright/test';

interface FloatData {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly payload: {
    readonly kind: string;
    readonly text?: string;
    readonly items?: readonly { label: string; done?: boolean }[];
  };
}

declare global {
  interface Window {
    __e2e: {
      floats(): readonly FloatData[];
      viewport(): { panX: number; panY: number; zoom: number };
      panTo(x: number, y: number): void;
      toScreen(x: number, y: number): { x: number; y: number };
    };
  }
}

async function openWorkspace(page: Page): Promise<void> {
  await page.goto('/?e2e');
  await page.locator('[data-scene-ready="true"]').waitFor();
}

const floats = (page: Page) => page.evaluate(() => window.__e2e.floats());

/** Centre of the canvas host, in viewport coordinates. */
async function canvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-screen-label="Canvas"]').boundingBox();
  if (!box) throw new Error('workspace not laid out');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Where a world point currently paints, in viewport coordinates. */
async function screenPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-screen-label="Canvas"]').boundingBox();
  if (!box) throw new Error('workspace not laid out');
  const local = await page.evaluate(([wx, wy]) => window.__e2e.toScreen(wx, wy), [x, y]);
  return { x: box.x + local.x, y: box.y + local.y };
}

test('the sticky tool places a note where the user clicks', async ({ page }) => {
  await openWorkspace(page);
  const before = (await floats(page)).length;

  await page.keyboard.press('n');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await page.keyboard.press('Escape');

  const created = (await floats(page)).at(-1)!;
  expect((await floats(page)).length).toBe(before + 1);
  expect(created.payload.kind).toBe('sticky');

  // The note must sit under the cursor, not at the viewport centre — and it
  // is centred there, the way paper lands under a thumb.
  const painted = await screenPoint(
    page,
    created.x + created.width / 2,
    created.y + created.height / 2,
  );
  expect(Math.abs(painted.x - target.x)).toBeLessThan(4);
  expect(Math.abs(painted.y - target.y)).toBeLessThan(4);
});

test('a creation tool returns to Select so the next click creates nothing', async ({ page }) => {
  await openWorkspace(page);

  await page.keyboard.press('n');
  const first = await canvasCentre(page);
  await page.mouse.click(first.x, first.y);
  await page.keyboard.press('Escape');
  const afterFirst = (await floats(page)).length;

  await page.mouse.click(first.x + 220, first.y + 160);
  expect((await floats(page)).length).toBe(afterFirst);
});

test('a new sticky starts empty so typing cannot inherit placeholder words', async ({ page }) => {
  await openWorkspace(page);

  await page.keyboard.press('n');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);

  const editor = page.getByLabel('Edit text');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('');
  await page.keyboard.type('Owl logo');
  await page.keyboard.press('Escape');

  const created = (await floats(page)).at(-1)!;
  expect(created.payload.text).toBe('Owl logo');
});

test('re-editing a note appends nothing of its own', async ({ page }) => {
  await openWorkspace(page);

  await page.keyboard.press('n');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.type('Venue: Maple Lodge');
  await page.keyboard.press('Escape');

  const created = (await floats(page)).at(-1)!;
  const centre = await screenPoint(
    page,
    created.x + created.width / 2,
    created.y + created.height / 2,
  );
  // Double-click selects a single word inside the textarea; anything the app
  // put there itself would survive and weld onto the next keystrokes.
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.press('Escape');

  const after = (await floats(page)).find((f) => f.id === created.id)!;
  expect(after.payload.text).toBe('Venue: Maple Lodge');
});

test('typing the instant a note appears cannot arm tools or pan', async ({ page }) => {
  await openWorkspace(page);
  const before = (await floats(page)).length;

  // Deliberately no focus wait. Keys pressed in the frame before the editor
  // takes focus are dropped, but they must not reach the global shortcuts:
  // each stolen letter used to arm a tool, and a stolen space started a pan,
  // so the click that ended the edit dropped a surprise object on the desk.
  await page.keyboard.press('n');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await page.keyboard.type('Nana visit');
  await page.keyboard.press('Escape');

  expect((await floats(page)).length).toBe(before + 1);
  const created = (await floats(page)).at(-1)!;
  // Whatever landed is part of the sentence — never a foreign placeholder.
  expect('Nana visit'.endsWith(created.payload.text ?? '')).toBe(true);

  // No creation tool was left armed by the stray keystrokes.
  await page.mouse.click(target.x + 260, target.y + 200);
  expect((await floats(page)).length).toBe(before + 1);
});

test('the empty-note prompt is chrome and never becomes content', async ({ page }) => {
  await openWorkspace(page);

  await page.keyboard.press('n');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.press('Escape');

  // The note shows a prompt on the paper, but the payload stays empty — this
  // is what separates a prompt from the old committed placeholder.
  const created = (await floats(page)).at(-1)!;
  expect(created.payload.text).toBe('');
});

test('the task tool creates a checklist sticky with a tickable item', async ({ page }) => {
  await openWorkspace(page);

  await page.keyboard.press('k');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await page.keyboard.press('Escape');

  const created = (await floats(page)).at(-1)!;
  expect(created.payload.kind).toBe('sticky');
  expect(created.payload.items?.length).toBeGreaterThan(0);
  expect(created.payload.items?.[0].done ?? false).toBe(false);
});

test('abandoning an empty composition leaves no scrap behind', async ({ page }) => {
  await openWorkspace(page);
  const before = (await floats(page)).length;

  // Double-clicking empty paper opens the editor over bare canvas.
  const target = await canvasCentre(page);
  await page.mouse.dblclick(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(page.getByLabel('Edit text')).toBeHidden();
  expect((await floats(page)).length).toBe(before);
});

test('writing on empty paper creates a text object holding the text', async ({ page }) => {
  await openWorkspace(page);
  const before = (await floats(page)).length;

  const target = await canvasCentre(page);
  await page.mouse.dblclick(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.type('fair setup starts the 24th');
  await page.keyboard.press('Escape');

  const created = (await floats(page)).at(-1)!;
  expect((await floats(page)).length).toBe(before + 1);
  expect(created.payload.kind).toBe('text');
  expect(created.payload.text).toBe('fair setup starts the 24th');
});

test('Shift+T jumps to today instead of arming the text tool', async ({ page }) => {
  await openWorkspace(page);
  await page.evaluate(() => window.__e2e.panTo(-90000, -90000));
  const strayed = await page.evaluate(() => window.__e2e.viewport());

  await page.keyboard.press('Shift+T');
  await page.waitForTimeout(500);
  const home = await page.evaluate(() => window.__e2e.viewport());
  expect(home.panX).not.toBe(strayed.panX);

  // And it must not have left the Text tool armed: a click would then write.
  const before = (await floats(page)).length;
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  expect((await floats(page)).length).toBe(before);
});
