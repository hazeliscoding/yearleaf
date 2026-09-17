/**
 * Design-system chrome regressions: layout and elevation bugs that unit tests
 * cannot see because they only exist once the CSS is applied to the real
 * component hosts in a browser.
 */

import { expect, test, type Page } from '@playwright/test';

async function openWorkspace(page: Page, theme?: 'dark'): Promise<void> {
  await page.goto(`/?e2e${theme === 'dark' ? '&theme=dark' : ''}`);
  await page.locator('[data-scene-ready="true"]').waitFor();
}

test('the command palette renders as a panel, not an inline box', async ({ page }) => {
  await openWorkspace(page);
  await page.keyboard.press('Control+k');
  const palette = page.locator('db-command-palette');
  await expect(palette).toBeVisible();

  const box = await palette.evaluate((el) => ({
    display: getComputedStyle(el).display,
    width: el.getBoundingClientRect().width,
    overflow: getComputedStyle(el).overflowX,
  }));
  // An inline host silently drops width/overflow and paints the background as
  // fragmented line boxes, letting the canvas show through the panel.
  // `inline-block`/`inline-flex` would pass a `not.toBe('inline')` check
  // without giving a panel, so pin the real contract.
  expect(box.display).toBe('block');
  expect(box.width).toBeGreaterThan(550);
  expect(box.overflow).toBe('hidden');
});

test('the light scrim dims the desk behind the palette', async ({ page }) => {
  await openWorkspace(page);
  await page.keyboard.press('Control+k');
  await expect(page.locator('db-command-palette')).toBeVisible();

  const scrim = await page.evaluate(() => {
    const el = document.querySelector('[data-screen-label="Command palette"]')!;
    return getComputedStyle(el).backgroundColor;
  });
  // A missing --scrim token computes to `initial` (transparent) with no error.
  expect(scrim).toBe('rgba(43, 40, 34, 0.18)');
});

test('the search overlay wears the same chrome as the command palette', async ({ page }) => {
  await openWorkspace(page);

  await page.keyboard.press('Control+k');
  const paletteWidth = await page
    .locator('db-command-palette')
    .evaluate((el) => el.getBoundingClientRect().width);
  await page.keyboard.press('Escape');

  await page.locator('db-search-field').click({ force: true });
  const overlay = page.locator('app-search-overlay .db-palette');
  await expect(overlay).toBeVisible();

  const search = await overlay.evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    // Enter jumps to the first result, so it must look selected.
    firstRowMarked: el.querySelector('.db-palette-item')?.getAttribute('data-sel'),
    hasGlyph: !!el.querySelector('.db-palette-input db-icon'),
  }));

  // Two sibling overlays in the same state must not drift apart visually.
  expect(search.width).toBe(paletteWidth);
  expect(search.firstRowMarked).toBe('true');
  expect(search.hasGlyph).toBe(true);
});

test('a disabled primary button stays disabled-looking under the cursor', async ({ page }) => {
  await openWorkspace(page);

  // Mounted rather than borrowed from the chrome: this guards the stylesheet
  // rule, which must hold for every disabled button the app ever grows, not
  // just whichever one happens to be disabled today.
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.className = 'db-btn db-btn--primary';
    button.disabled = true;
    button.textContent = 'Disabled primary';
    button.style.cssText = 'position:fixed;left:20px;top:200px;z-index:9999';
    button.id = 'disabled-probe';
    document.body.append(button);
  });

  const probe = page.locator('#disabled-probe');
  const resting = await probe.evaluate((el) => getComputedStyle(el).backgroundColor);
  await probe.hover({ force: true });
  const hovered = await probe.evaluate((el) => getComputedStyle(el).backgroundColor);

  // `:disabled` and `.db-btn--primary:hover` share specificity, so whichever
  // rule comes last wins: a disabled button used to fill with accent under the
  // cursor while still doing nothing.
  expect(hovered).toBe(resting);
  expect(hovered).not.toBe('rgb(156, 83, 16)');
});

test('the composition overlay floats above the canvas panels', async ({ page }) => {
  await openWorkspace(page);
  const host = (await page.locator('[data-screen-label="Canvas"]').boundingBox())!;

  // The layer panel sits in the bottom-right corner; typing must not go into a
  // field hidden behind it.
  const target = { x: host.x + host.width - 120, y: host.y + host.height - 120 };
  await page.mouse.dblclick(target.x, target.y);
  const editor = page.getByLabel('Edit text');
  await expect(editor).toBeFocused();

  const onTop = await editor.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return top === el;
  });
  expect(onTop).toBe(true);
});

test('the search glyph sits inside the field and is vertically centred', async ({ page }) => {
  await openWorkspace(page);
  const geom = await page.evaluate(() => {
    const field = document.querySelector('db-search-field')!;
    const icon = field.querySelector('db-icon')!;
    const input = field.querySelector('input')!;
    const rect = (el: Element) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, centreY: b.top + b.height / 2 };
    };
    return {
      icon: rect(icon),
      input: rect(input),
      padLeft: parseFloat(getComputedStyle(input).paddingLeft),
    };
  });

  // The glyph overlays the input's leading padding instead of displacing the
  // input sideways and stranding itself outside the field's border.
  expect(geom.icon.left).toBeGreaterThan(geom.input.left);
  expect(geom.icon.right).toBeLessThanOrEqual(geom.input.left + geom.padLeft);
  expect(Math.abs(geom.icon.centreY - geom.input.centreY)).toBeLessThan(1);
});

test('dark theme lifts overlays off the desk with a dark shadow and scrim', async ({ page }) => {
  await openWorkspace(page, 'dark');
  await page.keyboard.press('Control+k');
  await expect(page.locator('db-command-palette')).toBeVisible();

  const chrome = await page.evaluate(() => {
    const palette = document.querySelector('db-command-palette')!;
    const scrim = palette.closest('[data-screen-label="Command palette"]')!;
    return {
      shadow: getComputedStyle(palette).boxShadow,
      scrim: getComputedStyle(scrim).backgroundColor,
      // Canvas objects mix their own alpha from this one, off the shadow ramp.
      shadowInk: getComputedStyle(document.documentElement)
        .getPropertyValue('--shadow-ink')
        .trim(),
    };
  });

  // The light shadows are tinted with paper ink, which is lighter than the
  // dark canvas — they read as a halo and the panel loses its edge.
  expect(chrome.shadow).toContain('rgba(0, 0, 0');
  expect(chrome.scrim).toContain('rgba(0, 0, 0');
  expect(chrome.shadowInk.toLowerCase()).toBe('#000000');
});
