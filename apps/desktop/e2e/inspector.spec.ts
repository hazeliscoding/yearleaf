/**
 * The inspector as a two-way panel.
 *
 * Every control here used to be a `model()` signal with nothing behind it: the
 * field moved, the user believed the edit had landed, and the object never
 * changed. Only a browser test can see that, because the acknowledgement and
 * the discard both happen inside the control.
 */

import { expect, test, type Page } from '@playwright/test';

interface FloatData {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly payload: {
    readonly kind: string;
    readonly frame?: string;
    readonly pinned?: boolean;
    readonly hand?: boolean;
  };
}

interface EventData {
  readonly id: string;
  readonly title: string;
  readonly timeLabel?: string;
  readonly variant?: string;
}

declare global {
  interface Window {
    __e2e: {
      floats(): readonly FloatData[];
      events(): readonly EventData[];
      selectEvent(id: string): boolean;
      select(id: string): boolean;
    };
  }
}

/** A 4x2 truecolour PNG, the same fixture the import tests drop. */
const WIDE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGM4EaABRwzIHACHGgoBR/08xAAAAABJRU5ErkJggg==';

async function openWorkspace(page: Page): Promise<void> {
  await page.goto('/?e2e');
  await page.locator('[data-scene-ready="true"]').waitFor();
}

const floats = (page: Page) => page.evaluate(() => window.__e2e.floats());
const events = (page: Page) => page.evaluate(() => window.__e2e.events());

async function canvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.locator('[data-screen-label="Canvas"]').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Places a sticky and leaves it selected, so the inspector is showing it. */
async function selectedSticky(page: Page): Promise<FloatData> {
  await page.keyboard.press('n');
  const target = await canvasCentre(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByLabel('Edit text')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('X position', { exact: true })).toBeVisible();
  return (await floats(page)).at(-1)!;
}

/** Drops a picture on the desk and leaves it selected. */
async function selectedPicture(page: Page): Promise<FloatData> {
  const before = (await floats(page)).length;
  const box = (await page.locator('[data-screen-label="Canvas"]').boundingBox())!;
  await page.evaluate(
    ({ data, x, y }) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], 'moodboard.png', { type: 'image/png' }));
      const canvas = document.querySelector('[data-screen-label="Canvas"]')!;
      for (const kind of ['dragover', 'drop']) {
        canvas.dispatchEvent(
          new DragEvent(kind, {
            dataTransfer: transfer,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }),
        );
      }
    },
    { data: WIDE_PNG_BASE64, x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  await expect.poll(() => page.evaluate(() => window.__e2e.floats().length)).toBe(before + 1);
  return (await floats(page)).at(-1)!;
}

test('typing a position moves the note it is describing', async ({ page }) => {
  await openWorkspace(page);
  const note = await selectedSticky(page);

  const x = page.getByLabel('X position', { exact: true });
  await x.fill('400');
  await x.blur();

  // The field used to accept this and keep it entirely to itself.
  expect((await floats(page)).find((f) => f.id === note.id)!.x).toBe(400);

  const y = page.getByLabel('Y position', { exact: true });
  await y.fill('250');
  await y.blur();

  const moved = (await floats(page)).find((f) => f.id === note.id)!;
  expect(moved).toMatchObject({ x: 400, y: 250 });
});

test('a typed position is one undoable step', async ({ page }) => {
  await openWorkspace(page);
  const note = await selectedSticky(page);

  const x = page.getByLabel('X position', { exact: true });
  await x.fill('400');
  await x.blur();
  await expect.poll(async () => (await floats(page)).find((f) => f.id === note.id)!.x).toBe(400);

  await page.keyboard.press('Control+z');
  expect((await floats(page)).find((f) => f.id === note.id)!.x).toBe(note.x);
});

test('typing a rotation turns the note', async ({ page }) => {
  await openWorkspace(page);
  const note = await selectedSticky(page);

  const rotation = page.getByLabel('Rotation', { exact: true });
  await rotation.fill('45');
  await rotation.blur();

  expect((await floats(page)).find((f) => f.id === note.id)!.rotation).toBe(45);
});

test('clearing a position field does not send the note to the origin', async ({ page }) => {
  await openWorkspace(page);
  const note = await selectedSticky(page);

  const x = page.getByLabel('X position', { exact: true });
  await x.fill('');
  await x.blur();

  // `Number('')` is 0, and 0 is finite. Accepting it would move a note several
  // thousand world units west, off the screen, with nothing panning to follow
  // it — and emptying a field before retyping is ordinary behaviour.
  expect((await floats(page)).find((f) => f.id === note.id)!.x).toBe(note.x);
  await expect(x).toHaveValue(String(note.x));
});

test('a position field never keeps showing a number the note does not have', async ({ page }) => {
  await openWorkspace(page);
  const note = await selectedSticky(page);

  const x = page.getByLabel('X position', { exact: true });
  await x.fill('abc');
  await x.blur();

  // Refusing the entry is only half the job: leaving it on screen recreates
  // the very defect this panel was fixed for, one level down.
  expect((await floats(page)).find((f) => f.id === note.id)!.x).toBe(note.x);
  await expect(x).toHaveValue(String(note.x));
});

test('selecting a file reports what the file is', async ({ page }) => {
  await openWorkspace(page);
  const pdf = (await floats(page)).find((f) => f.payload.kind === 'file')!;
  await page.evaluate((id) => window.__e2e.select(id), pdf.id);

  // A panel showing only an angle tells you nothing about the thing selected.
  const inspector = page.locator('app-inspector');
  await expect(inspector.getByText('Fair-floorplan.pdf')).toBeVisible();
});

test('the inspector offers no control it cannot honour', async ({ page }) => {
  await openWorkspace(page);
  await selectedSticky(page);

  // Nothing on the desk has an opacity or a lock. A control that moves and
  // changes nothing is worse than no control at all. (Pinned is absent from
  // this list on purpose — a sticky really does carry a pin, so that toggle
  // came back wired rather than staying deleted.)
  const inspector = page.locator('app-inspector');
  await expect(inspector.getByLabel('Opacity')).toHaveCount(0);
  await expect(inspector.getByText('Locked', { exact: true })).toHaveCount(0);
});

test('a sticky can be pinned and unhandwritten, because it really can be', async ({ page }) => {
  await openWorkspace(page);
  const note = await selectedSticky(page);
  // A fresh note is written by hand and not pinned, so both switches start
  // from a state the desk actually holds rather than a hardcoded one.
  expect(note.payload.hand).toBe(true);
  expect(note.payload.pinned).toBeFalsy();
  const payload = async () => (await floats(page)).find((f) => f.id === note.id)!.payload;

  await page.getByLabel('Pinned', { exact: true }).check();
  await expect.poll(async () => (await payload()).pinned).toBe(true);

  await page.getByLabel('Handwritten', { exact: true }).uncheck();
  await expect.poll(async () => (await payload()).hand).toBe(false);

  // Straight after clicking the switch, with it still focused. A switch holds
  // no text, so the guard that keeps Ctrl+Z out of a field being typed in must
  // not apply — it left undo unreachable until the user clicked elsewhere,
  // which reads as undo being broken.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await payload()).hand).toBe(true);
});

test('the frame control fits inside the panel it lives in', async ({ page }) => {
  await openWorkspace(page);
  await selectedPicture(page);

  // Three segments measured 164px in a 143px cell, so "Taped" — the frame every
  // dropped picture lands on — was cut off the edge of the window.
  const control = (await page.getByLabel('Frame').boundingBox())!;
  const panel = (await page.locator('app-inspector').boundingBox())!;
  expect(control.x + control.width).toBeLessThanOrEqual(panel.x + panel.width);
});

test('picking a frame changes how the picture is mounted', async ({ page }) => {
  await openWorkspace(page);
  const picture = await selectedPicture(page);
  expect(picture.payload.frame).toBe('taped');

  await page.getByLabel('Frame').selectOption('Plain');

  // "Plain" is stored as `borderless`; lower-casing the label would write
  // `plain`, which the renderer matches against nothing.
  await expect
    .poll(async () => (await floats(page)).find((f) => f.id === picture.id)!.payload.frame)
    .toBe('borderless');

  await page.keyboard.press('Control+z');
  expect((await floats(page)).find((f) => f.id === picture.id)!.payload.frame).toBe('taped');
});

test('an all-day event says so with a switch, not with ghost text', async ({ page }) => {
  await openWorkspace(page);
  await expect.poll(() => page.evaluate(() => window.__e2e.events().length)).toBeGreaterThan(0);
  const allDay = (await events(page)).find((e) => e.title === 'Zine deadline')!;
  await page.evaluate((id) => window.__e2e.selectEvent(id), allDay.id);

  // The state used to be reported by a placeholder, which at readable contrast
  // was indistinguishable from a real value — the user could not tell whether
  // the event stored the literal words "All day".
  await expect(page.getByLabel('All day', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Event time')).toHaveCount(0);
});

test('the all-day switch is a way back, not just a readout', async ({ page }) => {
  await openWorkspace(page);
  await expect.poll(() => page.evaluate(() => window.__e2e.events().length)).toBeGreaterThan(0);
  const timed = (await events(page)).find((e) => e.timeLabel)!;
  await page.evaluate((id) => window.__e2e.selectEvent(id), timed.id);

  await page.getByLabel('All day', { exact: true }).check();

  const cleared = (await events(page)).find((e) => e.id === timed.id)!;
  expect(cleared.timeLabel).toBeFalsy();
  expect(cleared.variant).toBe('allday');
  await expect(page.getByLabel('Event time')).toHaveCount(0);
});

test('giving an event a time keeps it, and clearing it makes it all-day again', async ({
  page,
}) => {
  await openWorkspace(page);
  await expect.poll(() => page.evaluate(() => window.__e2e.events().length)).toBeGreaterThan(0);
  const allDay = (await events(page)).find((e) => e.title === 'Zine deadline')!;
  await page.evaluate((id) => window.__e2e.selectEvent(id), allDay.id);

  await page.getByLabel('All day', { exact: true }).uncheck();
  const time = page.getByLabel('Event time');
  await time.fill('14:00');
  await time.blur();

  const timed = (await events(page)).find((e) => e.id === allDay.id)!;
  expect(timed.timeLabel).toBe('14:00');
  // The chip draws its fill from the variant alone, so this has to move too.
  expect(timed.variant).toBe('timed');

  await time.fill('');
  await time.blur();

  const cleared = (await events(page)).find((e) => e.id === allDay.id)!;
  expect(cleared.timeLabel).toBeFalsy();
  expect(cleared.variant).toBe('allday');
});

test('switching to all-day and back keeps the time that was there', async ({ page }) => {
  await openWorkspace(page);
  await expect.poll(() => page.evaluate(() => window.__e2e.events().length)).toBeGreaterThan(0);
  const timed = (await events(page)).find((e) => e.timeLabel)!;
  await page.evaluate((id) => window.__e2e.selectEvent(id), timed.id);

  const allDay = page.getByLabel('All day', { exact: true });
  await allDay.check();
  await allDay.uncheck();

  // Inventing a replacement hour would report a start nobody asked for as the
  // event's own, in a panel whose whole point is that it does not do that.
  expect((await events(page)).find((e) => e.id === timed.id)!.timeLabel).toBe(timed.timeLabel);
});

test('an event that never had a time gets an empty field, not an invented hour', async ({
  page,
}) => {
  await openWorkspace(page);
  await expect.poll(() => page.evaluate(() => window.__e2e.events().length)).toBeGreaterThan(0);
  const allDayEvent = (await events(page)).find((e) => !e.timeLabel)!;
  await page.evaluate((id) => window.__e2e.selectEvent(id), allDayEvent.id);

  await page.getByLabel('All day', { exact: true }).uncheck();

  await expect(page.getByLabel('Event time')).toHaveValue('');
  expect((await events(page)).find((e) => e.id === allDayEvent.id)!.timeLabel).toBeFalsy();
});

test('a time that is not a time never reaches the calendar', async ({ page }) => {
  await openWorkspace(page);
  await expect.poll(() => page.evaluate(() => window.__e2e.events().length)).toBeGreaterThan(0);
  const target = (await events(page)).find((e) => e.timeLabel)!;
  await page.evaluate((id) => window.__e2e.selectEvent(id), target.id);

  const time = page.getByLabel('Event time');
  await time.fill('sometime after lunch on the 3rd');
  await time.blur();

  // The chip reserves room for the time before the title, so storing a sentence
  // pushed the event's own name off the day cell.
  expect((await events(page)).find((e) => e.id === target.id)!.timeLabel).toBe(target.timeLabel);
  await expect(time).toHaveValue(target.timeLabel!);
  // And it says why, rather than the entry simply vanishing from the box.
  await expect(page.locator('app-inspector').getByText('Enter a time like 14:00')).toBeVisible();
});
