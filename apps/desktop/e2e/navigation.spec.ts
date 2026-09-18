/**
 * Getting to next month.
 *
 * Months run three across and four down inside a year block, so the obvious
 * gesture — scrolling down — moves three months at a time. A reader who does
 * this for a living scrolled from September, landed in December, and spent
 * minutes convinced the weekday columns were misaligned. These cover the
 * routes that were missing and the labels that were lying.
 */

import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __e2e: {
      viewport(): { panX: number; panY: number; zoom: number };
      panTo(x: number, y: number): void;
      toScreen(x: number, y: number): { x: number; y: number };
      dateAtCenter(): { day: number; month: number; year: number } | null;
      flying(): boolean;
    };
  }
}

async function openWorkspace(page: Page): Promise<void> {
  await page.goto('/?e2e');
  await page.locator('[data-scene-ready="true"]').waitFor();
}

const navLabel = (page: Page) =>
  page.locator('db-date-navigator span').first().textContent();
const zoom = (page: Page) => page.evaluate(() => window.__e2e.viewport().zoom);

/** Waits for a glide to land, so assertions read the destination. */
const landed = async (page: Page) => {
  await expect.poll(() => page.evaluate(() => window.__e2e.flying())).toBe(false);
};

test('the forward arrow reaches next month', async ({ page }) => {
  await openWorkspace(page);
  await expect.poll(() => navLabel(page)).toContain('September 2026');

  await page.getByLabel('Next month').click();

  await expect.poll(() => navLabel(page)).toContain('October 2026');
});

test('stepping crosses the row wrap that scrolling cannot', async ({ page }) => {
  await openWorkspace(page);
  const next = page.getByLabel('Next month');

  // March is the last column of its row, so April is a row down and two
  // columns back — the move the layout hides.
  for (let i = 0; i < 6; i++) await next.click();
  await expect.poll(() => navLabel(page)).toContain('March 2027');

  await next.click();
  await expect.poll(() => navLabel(page)).toContain('April 2027');
});

test('stepping crosses the year boundary', async ({ page }) => {
  await openWorkspace(page);
  const next = page.getByLabel('Next month');
  for (let i = 0; i < 3; i++) await next.click();
  await expect.poll(() => navLabel(page)).toContain('December 2026');

  await next.click();
  await expect.poll(() => navLabel(page)).toContain('January 2027');

  await page.getByLabel('Previous month').click();
  await expect.poll(() => navLabel(page)).toContain('December 2026');
});

test('stepping keeps the zoom it found', async ({ page }) => {
  await openWorkspace(page);
  const before = await zoom(page);

  await page.getByLabel('Next month').click();
  await landed(page);

  // Re-framing on every step would fight a reader who had zoomed in to work.
  expect(await zoom(page)).toBeCloseTo(before, 5);
});

test('PageDown and PageUp move a month without a pointer', async ({ page }) => {
  await openWorkspace(page);
  await expect.poll(() => navLabel(page)).toContain('September 2026');

  await page.keyboard.press('PageDown');
  await expect.poll(() => navLabel(page)).toContain('October 2026');

  await page.keyboard.press('PageUp');
  await expect.poll(() => navLabel(page)).toContain('September 2026');
});

test('a look at the whole year does not lose the month you were reading', async ({ page }) => {
  await openWorkspace(page);
  await page.getByLabel('Next month').click();
  await page.getByLabel('Next month').click();
  await expect.poll(() => navLabel(page)).toContain('November 2026');

  await page.getByRole('radio', { name: 'Year' }).click();
  await landed(page);
  await expect.poll(() => zoom(page)).toBeLessThan(0.2);

  await page.getByRole('radio', { name: 'Month' }).click();
  await landed(page);

  // This used to land on May every time, whatever had been on screen, because
  // the centre of a year block always falls on the same boundary.
  await expect.poll(() => navLabel(page)).toContain('November 2026');
});

test('at the year tier the arrows move what the label names', async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole('radio', { name: 'Year' }).click();
  await expect.poll(() => navLabel(page)).toBe('2026');

  // The label reads a year up here, so a step has to be a year — stepping a
  // month would move the view and change nothing the user can read.
  await page.getByLabel('Next year').click();
  await expect.poll(() => navLabel(page)).toBe('2027');
});

// Every month of the year, because the first version of this only worked from
// September. Holding a month in the first row put the stepped view across the
// seam between two year blocks, the focus rule read the earlier year back, and
// the arrow went dead — for a quarter of all starting positions.
for (const [monthIndex, name] of [
  [0, 'January'],
  [2, 'March'],
  [6, 'July'],
  [11, 'December'],
] as const) {
  test(`stepping a year works from ${name}`, async ({ page }) => {
    await openWorkspace(page);
    const next = page.getByLabel('Next month');
    // Walk to the month under test, then zoom out to the year.
    const steps = monthIndex - 8;
    for (let i = 0; i < Math.abs(steps); i++) {
      await (steps > 0 ? next : page.getByLabel('Previous month')).click();
    }
    await expect.poll(() => navLabel(page)).toContain(name);

    await page.getByRole('radio', { name: 'Year' }).click();
    await expect.poll(() => navLabel(page)).toBe('2026');

    await page.getByLabel('Next year').click();
    await expect.poll(() => navLabel(page)).toBe('2027');

    // And again, because the failure showed as a fixed point: the first click
    // appeared to work and every one after it did nothing.
    await page.getByLabel('Next year').click();
    await expect.poll(() => navLabel(page)).toBe('2028');

    // Back the other way one year at a time, not two.
    await page.getByLabel('Previous year').click();
    await expect.poll(() => navLabel(page)).toBe('2027');
  });
}

test('Space presses the arrows, the way a button is meant to work', async ({ page }) => {
  await openWorkspace(page);
  await expect.poll(() => navLabel(page)).toContain('September 2026');

  await page.getByLabel('Next month').focus();
  await page.keyboard.press('Space');

  // The canvas pan gesture used to swallow Space before the focused button
  // could act on it, which left the toolbar unusable from the keyboard.
  await expect.poll(() => navLabel(page)).toContain('October 2026');
});

test('stepping while zoomed in keeps the date rather than the position', async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole('radio', { name: 'Day' }).click();
  await landed(page);
  await expect.poll(() => zoom(page)).toBeGreaterThan(1);

  const dayUnder = () => page.evaluate(() => window.__e2e.dateAtCenter());
  const before = await dayUnder();
  await page.getByLabel('Next month').click();
  await landed(page);
  const after = await dayUnder();

  // At this zoom no month name is on screen, so the date is the only sign
  // anything happened. Carrying a geometric offset instead moved it backwards
  // — September the 17th became October the 15th under a control called Next.
  expect(after?.day).toBe(before?.day);
  expect(after?.month).toBe((before!.month + 1) % 12);
});

test('a wheel notch out undoes a wheel notch in', async ({ page }) => {
  await openWorkspace(page);
  const canvas = page.locator('[data-screen-label="Canvas"]');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const start = await zoom(page);

  await page.keyboard.down('Control');
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -120);
  const zoomedIn = await zoom(page);
  expect(zoomedIn).toBeGreaterThan(start);

  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 120);
  await page.keyboard.up('Control');

  // The factor used to be linear in the wheel delta, so a notch of 120 asked
  // for `1 - 1.2`: a negative scale, clamped to the minimum. Three notches out
  // from any zoom landed on a view of several blank years.
  expect(await zoom(page)).toBeCloseTo(start, 4);
});

test('a zoom press moves by the same proportion wherever it starts', async ({ page }) => {
  await openWorkspace(page);
  const inBtn = page.getByLabel('Zoom in');

  const low = await zoom(page);
  await inBtn.click();
  const afterLow = await zoom(page);

  for (let i = 0; i < 4; i++) await inBtn.click();
  const high = await zoom(page);
  await inBtn.click();
  const afterHigh = await zoom(page);

  // A fixed increment is a fifth of the way in down here and a twentieth of
  // the way up there, so the control behaved like a different control at
  // every scale.
  expect(afterHigh / high).toBeCloseTo(afterLow / low, 4);
});

test('a month parks where a fit would park it, not half a margin over', async ({ page }) => {
  await openWorkspace(page);
  // September 2026 is the third column of its block; October is the first of
  // the next row, so each sheet's own origin is the like-for-like comparison.
  const SEPTEMBER_X = 4680;
  const sepLeft = await page.evaluate(() => window.__e2e.toScreen(4680, 0).x);

  await page.getByLabel('Next month').click();
  await landed(page);
  const octLeft = await page.evaluate(() => window.__e2e.toScreen(0, 0).x);

  // A step used to centre the bare month while the fit centred it with its
  // desk margin, parking the sheet about 128px further right. The same screen
  // position was then Friday in one month and Thursday in the next, and a note
  // dropped by eye landed a day early.
  expect(Math.abs(octLeft - sepLeft)).toBeLessThan(4);
  expect(SEPTEMBER_X).toBe(4680);
});

test('stepping off the bare desk brings you back to a month', async ({ page }) => {
  await openWorkspace(page);
  const box = (await page.locator('[data-screen-label="Canvas"]').boundingBox())!;

  // Drag east past the last column, onto desk with no calendar on it at all.
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.keyboard.down('Space');
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Space');
  }

  // An empty view is not a year view. It used to read as one, so the arrows
  // became year arrows and a single click left for a month nobody had seen.
  await expect(page.getByLabel('Next month')).toBeVisible();
  await expect.poll(() => navLabel(page)).toContain('September 2026');

  await page.getByLabel('Next month').click();
  await landed(page);
  await expect.poll(() => navLabel(page)).toContain('October 2026');
  expect(await page.evaluate(() => window.__e2e.dateAtCenter())).not.toBeNull();
});

test('a step glides rather than cutting', async ({ page }) => {
  await openWorkspace(page);
  const at = () => page.evaluate(() => window.__e2e.viewport().panX);
  const before = await at();

  await page.getByLabel('Next month').click();
  expect(await page.evaluate(() => window.__e2e.flying())).toBe(true);

  // Sampled a third of the way through, where the view has left and not
  // arrived. One forward step in three wraps a row and shares no pixels with
  // the frame before it, so a cut taught the reader nothing about where the
  // months actually are.
  await page.waitForTimeout(140);
  const during = await at();
  await landed(page);
  const after = await at();

  expect(during).not.toBe(before);
  expect(during).not.toBe(after);
  expect(Math.abs(during - before)).toBeLessThan(Math.abs(after - before));
});

