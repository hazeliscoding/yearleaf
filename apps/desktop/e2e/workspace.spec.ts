/**
 * Canvas interaction end-to-end tests. The app is started with `?e2e`,
 * which exposes a read-only bridge (`__e2e`) for locating canvas content;
 * every interaction is a real click or keypress against the PixiJS canvas.
 */

import { expect, test, type Page } from '@playwright/test';

import {
  CHECKLIST_BOX,
  CHECKLIST_BOX_OFFSET_Y,
  CHECKLIST_ROW_H,
  STICKY_PAD,
} from '../../../packages/canvas/src/sticky-layout';

/** Minimal float shape mirrored from the domain package. */
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
      dayContent(iso: string): {
        events?: readonly unknown[];
        tasks?: readonly unknown[];
        range?: unknown;
        hand?: string;
        img?: string;
      } | null;
      toScreen(x: number, y: number): { x: number; y: number };
    };
  }
}

async function openWorkspace(page: Page): Promise<void> {
  await page.goto('/?e2e');
  await page.locator('[data-scene-ready="true"]').waitFor();
}

async function floats(page: Page): Promise<readonly FloatData[]> {
  return page.evaluate(() => window.__e2e.floats());
}

/** Pans so the world point sits at the workspace center. */
async function centerOn(page: Page, worldX: number, worldY: number): Promise<void> {
  const host = await page.locator('[data-screen-label="Canvas"]').boundingBox();
  if (!host) throw new Error('workspace not laid out');
  await page.evaluate(
    ([wx, wy, cx, cy]) => {
      const zoom = window.__e2e.viewport().zoom;
      window.__e2e.panTo(cx - wx * zoom, cy - wy * zoom);
    },
    [worldX, worldY, host.width / 2, host.height / 2],
  );
}

/** Viewport-absolute screen position of a world point. */
async function screenPoint(
  page: Page,
  worldX: number,
  worldY: number,
): Promise<{ x: number; y: number }> {
  const host = await page.locator('[data-screen-label="Canvas"]').boundingBox();
  if (!host) throw new Error('workspace not laid out');
  const local = await page.evaluate(
    ([wx, wy]) => window.__e2e.toScreen(wx, wy),
    [worldX, worldY],
  );
  return { x: host.x + local.x, y: host.y + local.y };
}

test('scene fonts are fetched before first paint', async ({ page }) => {
  await openWorkspace(page);
  // The hand font is used by no DOM element on a fresh desk, so only the
  // scene's explicit fonts.load keeps this from rasterizing as a fallback.
  expect(await page.evaluate(() => document.fonts.check('16px "Gochi Hand"'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('16px "Hanken Grotesk"'))).toBe(true);
});

test('double-click edits an existing sticky in place', async ({ page }) => {
  await openWorkspace(page);
  const before = (await floats(page)).length;

  // `n` arms the sticky tool (matching the rail's key hint); the click places
  // the note. Placement itself is covered in creation.spec.ts.
  await page.keyboard.press('n');
  const host = await page.locator('[data-screen-label="Canvas"]').boundingBox();
  await page.mouse.click(host!.x + host!.width / 2, host!.y + host!.height / 2);
  await page.keyboard.press('Escape');

  const created = (await floats(page)).at(-1);
  expect((await floats(page)).length).toBe(before + 1);
  expect(created?.payload.kind).toBe('sticky');
  expect(created?.payload.text).toBe('');

  const center = await screenPoint(
    page,
    created!.x + created!.width / 2,
    created!.y + created!.height / 2,
  );
  await page.mouse.dblclick(center.x, center.y);
  const editor = page.getByLabel('Edit text');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('');

  await editor.fill('water the plants');
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  const edited = (await floats(page)).find((f) => f.id === created!.id);
  expect(edited?.payload.text).toBe('water the plants');
});

test('clicking a checkbox toggles the item and undo restores it', async ({ page }) => {
  await openWorkspace(page);
  const sticky = (await floats(page)).find((f) => f.payload.items?.length);
  expect(sticky, 'sample desk provides a checklist sticky').toBeTruthy();
  const index = 1;
  const wasDone = !!sticky!.payload.items![index].done;

  await centerOn(page, sticky!.x + sticky!.width / 2, sticky!.y + sticky!.height / 2);
  const box = await screenPoint(
    page,
    sticky!.x + STICKY_PAD + CHECKLIST_BOX / 2,
    sticky!.y + STICKY_PAD + index * CHECKLIST_ROW_H + CHECKLIST_BOX_OFFSET_Y + CHECKLIST_BOX / 2,
  );
  await page.mouse.click(box.x, box.y);

  const itemsAfter = async () =>
    (await floats(page)).find((f) => f.id === sticky!.id)!.payload.items!;
  expect((await itemsAfter())[index].done ?? false).toBe(!wasDone);

  await page.keyboard.press('Control+z');
  expect((await itemsAfter())[index].done ?? false).toBe(wasDone);
});

test('checklist stickies edit line-per-line and ticks stay on their items', async ({ page }) => {
  // This test used to be named "…keep done state by position", which was the
  // corrupting rule stated as a promise. It only ever passed because it
  // appends — the one edit where position and identity agree.
  await openWorkspace(page);
  const sticky = (await floats(page)).find((f) => f.payload.items?.length);
  const labels = sticky!.payload.items!.map((i) => i.label);
  const doneBefore = sticky!.payload.items!.map((i) => !!i.done);

  await centerOn(page, sticky!.x + sticky!.width / 2, sticky!.y + sticky!.height / 2);
  const center = await screenPoint(
    page,
    sticky!.x + sticky!.width / 2,
    sticky!.y + sticky!.height / 2,
  );
  await page.mouse.dblclick(center.x, center.y);
  const editor = page.getByLabel('Edit text');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(labels.join('\n'));

  await editor.fill([...labels, 'buy stamps'].join('\n'));
  await page.keyboard.press('Escape');
  const items = (await floats(page)).find((f) => f.id === sticky!.id)!.payload.items!;
  expect(items.map((i) => i.label)).toEqual([...labels, 'buy stamps']);
  expect(items.map((i) => !!i.done)).toEqual([...doneBefore, false]);
});

test('retyping a checklist in a new order does not move the ticks', async ({ page }) => {
  // Marcus, 2026-09-18: six items, ticks on rows 1 and 3, retyped in a new
  // order — and the ticks stayed on rows 1 and 3, so the list came back
  // claiming he had defended his prospectus. Through the real editor, since
  // that is where he did it: the blob split, the trim, and the reconciliation
  // all sit between the textarea and the store.
  await openWorkspace(page);
  const sticky = (await floats(page)).find((f) => f.payload.items?.length);
  const labels = sticky!.payload.items!.map((i) => i.label);
  const doneBefore = sticky!.payload.items!.map((i) => !!i.done);
  expect(doneBefore.some(Boolean), 'the seeded checklist must carry a tick').toBe(true);

  await centerOn(page, sticky!.x + sticky!.width / 2, sticky!.y + sticky!.height / 2);
  const center = await screenPoint(
    page,
    sticky!.x + sticky!.width / 2,
    sticky!.y + sticky!.height / 2,
  );
  await page.mouse.dblclick(center.x, center.y);
  const editor = page.getByLabel('Edit text');
  await expect(editor).toHaveValue(labels.join('\n'));

  const reversed = [...labels].reverse();
  await editor.fill(reversed.join('\n'));
  await page.keyboard.press('Escape');

  const items = (await floats(page)).find((f) => f.id === sticky!.id)!.payload.items!;
  expect(items.map((i) => i.label)).toEqual(reversed);
  expect(items.map((i) => !!i.done)).toEqual([...doneBefore].reverse());
});

test('a checklist made with the Task tool re-edits by double-click', async ({ page }) => {
  // The test the 2026-09-19 triage recorded as owed: the claim rested on an
  // uncommitted probe, while the committed suite edited only the seeded
  // checklist. This is the created one, end to end.
  await openWorkspace(page);
  const box = (await page.locator('[data-screen-label="Canvas"]').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.keyboard.press('k');
  await page.mouse.click(cx, cy);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Edit text')).toBeHidden();
  const created = (await floats(page)).at(-1)!;
  expect(created.payload.items?.length).toBeGreaterThan(0);

  await page.mouse.dblclick(cx, cy);
  const editor = page.getByLabel('Edit text');
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();
  await editor.fill('first errand\nsecond errand');
  await page.keyboard.press('Escape');

  const items = (await floats(page)).find((f) => f.id === created.id)!.payload.items!;
  expect(items.map((i) => i.label)).toEqual(['first errand', 'second errand']);
});

test('Enter opens a new line where lines are the content', async ({ page }) => {
  await openWorkspace(page);
  const sticky = (await floats(page)).find((f) => f.payload.items?.length);
  const labels = sticky!.payload.items!.map((i) => i.label);

  await centerOn(page, sticky!.x + sticky!.width / 2, sticky!.y + sticky!.height / 2);
  const center = await screenPoint(
    page,
    sticky!.x + sticky!.width / 2,
    sticky!.y + sticky!.height / 2,
  );
  await page.mouse.dblclick(center.x, center.y);
  const editor = page.getByLabel('Edit text');
  await expect(editor).toBeVisible();

  // A checklist is one item per line, so Enter has to keep meaning "newline"
  // here even though it commits an event title. Typing it is the gesture that
  // adds an item, and the editor must stay open to receive the item.
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('buy stamps');
  await expect(editor).toBeFocused();
  await page.keyboard.press('Escape');

  const items = (await floats(page)).find((f) => f.id === sticky!.id)!.payload.items!;
  expect(items.map((i) => i.label)).toEqual([...labels, 'buy stamps']);
});

test('a day cell draws nothing the desk does not actually hold', async ({ page }) => {
  await openWorkspace(page);
  const dayContent = (iso: string) => page.evaluate((d) => window.__e2e.dayContent(d), iso);

  // The 15th has a real, stored event, and it is read first on purpose: the
  // seeded month lands asynchronously, and every "draws nothing" assertion
  // below would pass for the wrong reason against a desk that has not
  // hydrated yet. Waiting for content to appear is what makes its absence
  // elsewhere mean something.
  await expect.poll(() => dayContent('2026-09-15T00:00:00')).not.toBeNull();
  const fifteenth = (await dayContent('2026-09-15T00:00:00'))!;
  expect(fifteenth.events?.length).toBeGreaterThan(0);
  expect(fifteenth.tasks).toBeUndefined();
  expect(fifteenth.hand).toBeUndefined();
  expect(fifteenth.img).toBeUndefined();
  expect(fifteenth.range).toBeUndefined();

  // The 3rd carried a handwritten "call Mom" and the 5th a taped photo, both
  // invented by the sample month. Nothing creates them, nothing edits them and
  // nothing can delete them, so on a real desk they were somebody else's
  // handwriting appearing in September and staying there.
  expect(await dayContent('2026-09-03T00:00:00')).toBeNull();
  expect(await dayContent('2026-09-05T00:00:00')).toBeNull();
});
