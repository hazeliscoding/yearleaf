/**
 * Per-platform coverage for the Deskbound keycaps. The components live in
 * `@infinite-desk/deskbound`, but the desktop app owns the only Angular test
 * runner in the workspace, so their specs sit here — beside the shell that
 * prints the hints and the Windows build that used to get them wrong.
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DB_MODIFIER_CAP, DbKbd, DbToolButton, MOD } from '@infinite-desk/deskbound';

@Component({
  imports: [DbKbd, DbToolButton],
  template: `
    <db-kbd [keys]="jump" />
    <db-tool-button icon="undo-2" label="Undo" shortcut="Mod+Z" />
    <db-tool-button icon="sticky-note" label="Sticky note" shortcut="N" />
  `,
})
class HintHost {
  protected readonly jump = [MOD, 'K'];
}

/** Mounts the host against one platform's cap; safe to call twice per test. */
function render(cap: string): HTMLElement {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HintHost],
    providers: [{ provide: DB_MODIFIER_CAP, useValue: cap }],
  });
  const fixture = TestBed.createComponent(HintHost);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function caps(host: HTMLElement): string[] {
  return [...host.querySelectorAll('db-kbd kbd')].map((cap) => cap.textContent?.trim() ?? '');
}

/** Text of the corner badges, in template order. */
function badges(host: HTMLElement): string[] {
  return [...host.querySelectorAll('.db-tool-key')].map((key) => key.textContent?.trim() ?? '');
}

/** Tooltip text for one button, by its accessible name. */
function tip(host: HTMLElement, label: string): string {
  const tips = [...host.querySelectorAll('.db-tip')];
  return tips.find((t) => t.textContent?.includes(label))?.textContent?.trim() ?? '';
}

describe('keyboard hints on macOS', () => {
  it('prints the command glyph on the keycaps and in the tooltip', () => {
    const host = render('⌘');
    expect(caps(host)).toEqual(['⌘', 'K']);
    expect(tip(host, 'Undo')).toContain('⌘Z');
  });
});

describe('keyboard hints on Windows', () => {
  it('prints Ctrl on the keycaps and in the tooltip', () => {
    const host = render('Ctrl');
    expect(caps(host)).toEqual(['Ctrl', 'K']);
    expect(tip(host, 'Undo')).toContain('Ctrl+Z');
  });

  it('shows no command glyph anywhere, including the tooltip', () => {
    // The whole defect: a keyboard without a ⌘ key was told to press one.
    const host = render('Ctrl');
    expect(host.textContent).not.toContain('⌘');
  });
});

describe('the tool-button corner badge', () => {
  // 8.5px of `--ink-muted` is survivable for one letter you pattern-match and
  // not for a word you have to read, so the corner is for bare keys only. The
  // rule lives in the component, which is why it holds on both platforms
  // rather than only on the one whose cap happens to be long.
  it('carries a bare key', () => {
    expect(badges(render('Ctrl'))).toEqual(['N']);
    expect(badges(render('⌘'))).toEqual(['N']);
  });

  it('is dropped for a chord, which the tooltip still teaches', () => {
    for (const cap of ['Ctrl', '⌘']) {
      const host = render(cap);
      expect(badges(host)).not.toContain(cap === '⌘' ? '⌘Z' : 'Ctrl+Z');
      expect(tip(host, 'Undo')).toContain(cap === '⌘' ? '⌘Z' : 'Ctrl+Z');
    }
  });
});
