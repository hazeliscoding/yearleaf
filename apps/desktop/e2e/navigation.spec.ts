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
  await expect.poll(() => zoom(page)).toBeLessThan(0.2);

  await page.getByRole('radio', { name: 'Month' }).click();

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
