import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './app';
import { DeskActions } from './state/desk-actions';
import { HistoryStore } from './state/history-store';
import { ToolStore } from './state/tool-store';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('renders the shell with toolbar brand, tool rail, and workspace canvas', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Deskbound');
    expect(element.querySelector('app-tool-rail')).toBeTruthy();
    expect(element.querySelector('app-workspace canvas')).toBeTruthy();
  });

  it('shows the derived tier and navigation label in the toolbar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    // Default viewport starts at the month preset over the focused month.
    expect(element.querySelector('db-date-navigator')?.textContent).toContain('20');
    expect(element.querySelector('db-segmented')).toBeTruthy();
  });
});

describe('App undo shortcuts', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  /** Mounts the shell with one undone sticky waiting to be redone. */
  async function shellWithRedo(): Promise<HistoryStore> {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    TestBed.inject(DeskActions).addSticky({ x: 0, y: 0 });
    const history = TestBed.inject(HistoryStore);
    history.undo();
    expect(history.canRedo()).toBe(true);
    return history;
  }

  function press(key: string): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey: false }));
  }

  it('redoes on Ctrl+Y, which is what a Windows keyboard reaches for first', async () => {
    const history = await shellWithRedo();
    press('y');
    expect(history.canRedo()).toBe(false);
    expect(history.canUndo()).toBe(true);
  });

  it('still redoes on Ctrl+Shift+Z', async () => {
    const history = await shellWithRedo();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }),
    );
    expect(history.canRedo()).toBe(false);
  });

  it('leaves Ctrl+Y inert while the user is typing', async () => {
    // Same guard the undo branch sits behind: a text editor owns the keyboard
    // until it closes, and redo must not fire underneath it.
    const history = await shellWithRedo();
    TestBed.inject(ToolStore).editing.set(true);
    press('y');
    expect(history.canRedo()).toBe(true);
  });
});
