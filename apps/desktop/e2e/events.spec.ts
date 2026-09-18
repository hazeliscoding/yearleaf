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
      selectEvent(id: string): boolean;
      editSelectedOccurrence(title: string): boolean;
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

/** The month the navigator names — proof that navigation keys still land. */
const navLabel = (page: Page) => page.locator('db-date-navigator span').first().textContent();

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

test('Enter commits an event title and gives the keyboard back', async ({ page }) => {
  await openWorkspace(page);
  const before = (await events(page)).length;
  await expect.poll(() => navLabel(page)).toContain('September 2026');

  await page.keyboard.press('e');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.type('Advisor meeting');
  await page.keyboard.press('Enter');

  // Enter is an exit, like Tab, Escape and clicking away. It used to be the
  // one that was not: it put a newline in a one-line box and held focus.
  await expect(page.getByLabel('Edit text')).toBeHidden();
  const after = await events(page);
  expect(after.length).toBe(before + 1);
  expect(after.at(-1)!.title).toBe('Advisor meeting');

  // And the keyboard belongs to the app again. This is the symptom Marcus
  // reported: every navigation key died in the draft, so the app read as
  // frozen while the title scrolled out of sight.
  await page.keyboard.press('PageDown');
  await expect.poll(() => navLabel(page)).toContain('October 2026');
});

test('Shift+Enter commits too, rather than smuggling in a newline', async ({ page }) => {
  await openWorkspace(page);
  const before = (await events(page)).length;

  await page.keyboard.press('e');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.type('Advisor meeting');
  await page.keyboard.press('Shift+Enter');

  // This is the whole reason the handler compares `event.key` instead of
  // binding Angular's `keydown.enter`, which matches only the unmodified key
  // and would let Shift+Enter put a newline in the one-line box.
  await expect(page.getByLabel('Edit text')).toBeHidden();
  const after = await events(page);
  expect(after.length).toBe(before + 1);
  expect(after.at(-1)!.title).toBe('Advisor meeting');
});

test('the Enter that confirms an IME candidate does not commit the title', async ({ page }) => {
  await openWorkspace(page);
  const before = (await events(page)).length;

  await page.keyboard.press('e');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  const editor = page.getByLabel('Edit text');
  await expect(editor).toBeFocused();

  // A real composition in the box, driven through the same CDP input path the
  // browser uses for a CJK IME. Chromium then reports `isComposing` on a real
  // keypress, so the Enter below is genuine rather than synthesised.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {
    text: 'かいぎ',
    selectionStart: 3,
    selectionEnd: 3,
  });
  await expect(editor).toHaveValue('かいぎ');

  // Enter here means "take this candidate", not "I am done". Committing on it
  // stores the reading — かいぎ — and takes the box away mid-word, which makes
  // an event title untypable in Japanese or Chinese.
  await page.keyboard.press('Enter');
  await expect(editor).toBeFocused();
  expect((await events(page)).length).toBe(before);

  // Once the candidate is settled and the composition is over, Enter is an
  // exit again — the guard must not cost the language its way out. The box's
  // own value is not asserted between here and the commit: no input method is
  // really attached, so the Enter above fell through to the default and left a
  // newline a real IME would have consumed. The committed title is the same
  // either way, which is why that is what this checks.
  await cdp.send('Input.insertText', { text: '会議' });
  await page.keyboard.press('Enter');

  await expect(editor).toBeHidden();
  const after = await events(page);
  expect(after.length).toBe(before + 1);
  expect(after.at(-1)!.title).toBe('会議');
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

test('the inspector turns an event into a weekly series', async ({ page }) => {
  await openWorkspace(page);

  // Create an event on a Tuesday, the way a user would.
  await page.keyboard.press('e');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.type('Seminar');
  await page.keyboard.press('Escape');

  const created = (await events(page)).at(-1)!;
  await page.evaluate((id) => window.__e2e.selectEvent(id), created.id);

  // The Repeats control is the only way to make a series without code.
  const repeats = page.getByLabel('Repeats');
  await expect(repeats).toBeVisible();
  await repeats.selectOption('Weekly');

  const stored = (await events(page)).find((e) => e.id === created.id)!;
  expect(stored.rrule).toMatch(/^FREQ=WEEKLY;BYDAY=/);

  // Repeating is one undoable step, like every other edit.
  await page.keyboard.press('Control+z');
  expect((await events(page)).find((e) => e.id === created.id)!.rrule).toBeUndefined();
});

test('renaming an event in the inspector is kept', async ({ page }) => {
  await openWorkspace(page);
  const dentist = (await events(page)).find((e) => e.title === 'Dentist')!;
  await page.evaluate((id) => window.__e2e.selectEvent(id), dentist.id);

  // Previously the inspector wrote to a signal nothing persisted, so a rename
  // silently vanished.
  const title = page.getByLabel('Event title');
  await title.fill('Dentist — Dr. Okada');
  await title.blur();

  const renamed = (await events(page)).find((e) => e.id === dentist.id)!;
  expect(renamed.title).toBe('Dentist — Dr. Okada');
});

test('clearing the title field cannot destroy a series', async ({ page }) => {
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
  const before = (await events(page)).length;
  await page.evaluate(() => window.__e2e.selectEvent('seminar'));

  // Emptying a text field is something people do before retyping. It must
  // never take the series and every occurrence they had edited with it.
  const title = page.getByLabel('Event title');
  await title.fill('');
  await title.blur();

  expect((await events(page)).length).toBe(before);
  expect((await events(page)).find((e) => e.id === 'seminar')!.title).toBe('Seminar');
});

test('editing one occurrence of a series leaves the others alone', async ({ page }) => {
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

  // Double-clicking a computed occurrence materialises it, so the edit lands
  // on that date only.
  await page.evaluate(() => window.__e2e.selectOccurrenceOn('2026-09-15T00:00:00', 0));
  await page.evaluate(() => window.__e2e.editSelectedOccurrence('Seminar — guest speaker'));

  expect(await onDate('2026-09-15T00:00:00')).toContain('Seminar — guest speaker');
  expect(await onDate('2026-09-22T00:00:00')).toContain('Seminar');
  expect(await onDate('2026-09-22T00:00:00')).not.toContain('Seminar — guest speaker');
  // The series head keeps its own name.
  expect((await events(page)).find((e) => e.id === 'seminar')!.title).toBe('Seminar');
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
