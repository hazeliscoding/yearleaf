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
  `,
})
class HintHost {
  protected readonly jump = [MOD, 'K'];
}

function render(cap: string): HTMLElement {
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

describe('keyboard hints on macOS', () => {
  it('prints the command glyph on both keycap shapes', () => {
    const host = render('⌘');
    expect(caps(host)).toEqual(['⌘', 'K']);
    expect(host.querySelector('.db-tool-key')?.textContent?.trim()).toBe('⌘Z');
  });
});

describe('keyboard hints on Windows', () => {
  it('prints Ctrl on both keycap shapes', () => {
    const host = render('Ctrl');
    expect(caps(host)).toEqual(['Ctrl', 'K']);
    expect(host.querySelector('.db-tool-key')?.textContent?.trim()).toBe('Ctrl+Z');
  });

  it('shows no command glyph anywhere, including the tooltip', () => {
    // The whole defect: a keyboard without a ⌘ key was told to press one.
    const host = render('Ctrl');
    expect(host.textContent).not.toContain('⌘');
    expect(host.querySelector('.db-tip')?.textContent).toContain('Ctrl+Z');
  });
});
