/**
 * Events on the desk: real stored rows rather than sample constants, and a
 * repeating event drawn on every date its rule produces.
 */

import { expect, test, type Page } from '@playwright/test';

interface EventData {
  readonly id: string;
  readonly title: string;
  readonly rrule?: string;
}

declare global {
  interface Window {
    __e2e: {
      events(): readonly EventData[];
      addEvent(event: Record<string, unknown>): void;
      occurrencesOn(iso: string): string[];
      selectOccurrenceOn(iso: string, index: number): boolean;
      viewport(): { panX: number; panY: number; zoom: number };
      panTo(x: number, y: number): void;
      toScreen(x: number, y: number): { x: number; y: number };
    };
  }
}

async function openWorkspace(page: Page): Promise<void> {
  await page.goto('/?e2e');
  await page.locator('[data-scene-ready="true"]').waitFor();
  // The seeded sample month lands asynchronously on first run.
  await expect.poll(() => page.evaluate(() => window.__e2e.events().length)).toBeGreaterThan(0);
}

const events = (page: Page) => page.evaluate(() => window.__e2e.events());

async function canvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.locator('[data-screen-label="Canvas"]').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('the sample month is seeded as real, editable events', async ({ page }) => {
  await openWorkspace(page);
  const seeded = await events(page);

  // Previously these were a constant, so nothing on the desk could be renamed.
  expect(seeded.length).toBeGreaterThan(5);
  expect(seeded.some((e) => e.title === 'Dentist')).toBe(true);
  expect(seeded.every((e) => e.id.startsWith('seed-'))).toBe(true);
});

test('the event tool creates an event on the day that was clicked', async ({ page }) => {
  await openWorkspace(page);
  const before = (await events(page)).length;

  await page.keyboard.press('e');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);

  // Creation opens the title editor in place, over the day's chip row.
  const editor = page.getByLabel('Edit text');
  await expect(editor).toBeFocused();
  await page.keyboard.type('Advisor meeting');
  await page.keyboard.press('Escape');

  const after = await events(page);
  expect(after.length).toBe(before + 1);
  expect(after.at(-1)!.title).toBe('Advisor meeting');
});

test('an untitled event is discarded rather than left blank', async ({ page }) => {
  await openWorkspace(page);
  const before = (await events(page)).length;

  await page.keyboard.press('e');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.press('Escape');

  expect((await events(page)).length).toBe(before);
});

test('a weekly series is stored once and drawn on every matching date', async ({ page }) => {
  await openWorkspace(page);
  const before = (await events(page)).length;

  // Marcus's Tuesday seminar: the thing that could not be represented at all.
  await page.evaluate(() =>
    window.__e2e.addEvent({
      id: 'seminar',
      title: 'Seminar',
      color: 'blue',
      date: '2026-09-01T00:00:00',
      rrule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=16',
    }),
  );

  // One row, however many weeks it covers.
  const stored = await events(page);
  expect(stored.length).toBe(before + 1);
  expect(stored.find((e) => e.id === 'seminar')!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU;COUNT=16');

  // …and it resolves onto every September Tuesday, which is the list each day
  // cell draws from.
  for (const day of [1, 8, 15, 22, 29]) {
    const titles = await page.evaluate(
      (iso) => window.__e2e.occurrencesOn(iso),
      `2026-09-${String(day).padStart(2, '0')}T00:00:00`,
    );
    expect(titles, `Tuesday ${day} September`).toContain('Seminar');
  }

  // A Wednesday must stay clear.
  const wednesday = await page.evaluate(() =>
    window.__e2e.occurrencesOn('2026-09-02T00:00:00'),
  );
  expect(wednesday).not.toContain('Seminar');
});

test('creating an event is undoable', async ({ page }) => {
  await openWorkspace(page);
  const before = (await events(page)).length;

  await page.keyboard.press('e');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.type('Advisor meeting');
  await page.keyboard.press('Escape');
  expect((await events(page)).length).toBe(before + 1);

  // Naming it is its own step, so the title is undone before the event.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect((await events(page)).length).toBe(before);

  await page.keyboard.press('Control+Shift+z');
  await page.keyboard.press('Control+Shift+z');
  const restored = await events(page);
  expect(restored.length).toBe(before + 1);
  expect(restored.at(-1)!.title).toBe('Advisor meeting');
});

test('cancelling one date suppresses it without touching the series', async ({ page }) => {
  await openWorkspace(page);
  await page.evaluate(() =>
    window.__e2e.addEvent({
      id: 'seminar',
      title: 'Seminar',
      color: 'violet',
      date: '2026-09-01T00:00:00',
      rrule: 'FREQ=WEEKLY;BYDAY=TU',
    }),
  );
  const onDate = (iso: string) => page.evaluate((d) => window.__e2e.occurrencesOn(d), iso);
  // The 1st carries no seeded events, so the seminar is the only chip there.
  expect(await onDate('2026-09-01T00:00:00')).toEqual(['Seminar']);

  await page.evaluate(() => window.__e2e.selectOccurrenceOn('2026-09-01T00:00:00', 0));
  await page.keyboard.press('Delete');

  expect(await onDate('2026-09-01T00:00:00')).not.toContain('Seminar');
  // The rest of the series is untouched, including dates sharing a day with
  // other events.
  expect(await onDate('2026-09-08T00:00:00')).toContain('Seminar');
  expect(await onDate('2026-09-15T00:00:00')).toContain('Seminar');

  // And the cancellation is itself undoable.
  await page.keyboard.press('Control+z');
  expect(await onDate('2026-09-01T00:00:00')).toContain('Seminar');
});

test('deleting one occurrence leaves the rest of the series standing', async ({ page }) => {
  await openWorkspace(page);
  await page.evaluate(() =>
    window.__e2e.addEvent({
      id: 'seminar',
      title: 'Seminar',
      color: 'blue',
      date: '2026-09-01T00:00:00',
      rrule: 'FREQ=WEEKLY;BYDAY=TU',
    }),
  );

  // A tombstone override suppresses one date without touching the rule.
  await page.evaluate(() =>
    window.__e2e.addEvent({
      id: 'cancelled',
      title: 'Seminar',
      color: 'blue',
      date: '2026-09-15T00:00:00',
      seriesId: 'seminar',
      occurrenceDate: '2026-09-15T00:00:00',
      deleted: true,
    }),
  );

  const suppressed = await page.evaluate(() =>
    window.__e2e.occurrencesOn('2026-09-15T00:00:00'),
  );
  const intact = await page.evaluate(() => window.__e2e.occurrencesOn('2026-09-22T00:00:00'));
  expect(suppressed).not.toContain('Seminar');
  expect(intact).toContain('Seminar');
});
