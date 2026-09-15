/**
 * Application shell: toolbar, tool rail, workspace, contextual inspector,
 * and the command-palette / search overlays, plus global keyboard behavior.
 */

import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';

import { DbCommandPalette, type DbPaletteItem } from '@infinite-desk/deskbound';

import { PALETTE_GROUPS } from './data/sample-desk';
import { Inspector } from './shell/inspector';
import { SearchOverlay } from './shell/search-overlay';
import { Toolbar } from './shell/toolbar';
import { ToolRail } from './shell/tool-rail';
import { DeskActions } from './state/desk-actions';
import { DeskStore } from './state/desk-store';
import { HistoryStore } from './state/history-store';
import { SelectionStore } from './state/selection-store';
import { ToolStore } from './state/tool-store';
import { ViewportStore } from './state/viewport-store';
import { Workspace } from './workspace/workspace';

/** Tool labels reachable through single-key shortcuts. */
const TOOL_KEYS: Record<string, string> = { v: 'Select', h: 'Pan', t: 'Text', p: 'Pen' };

@Component({
  selector: 'app-root',
  imports: [DbCommandPalette, Inspector, SearchOverlay, Toolbar, ToolRail, Workspace],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      'display:grid;grid-template-rows:44px 1fr;grid-template-columns:44px 1fr auto;height:100vh;background:var(--surface-canvas)',
    '(click)': 'selection.clear()',
    '(document:keydown)': 'onKeyDown($event)',
    '(document:keyup)': 'onKeyUp($event)',
  },
  template: `
    <app-toolbar
      [dark]="dark()"
      (goToday)="goToday()"
      (openSearch)="openSearch()"
      (openPalette)="openPalette()"
      (toggleTheme)="dark.set(!dark())"
    />
    <app-tool-rail />
    <div style="position:relative;overflow:hidden">
      <app-workspace style="position:absolute;inset:0" [showLayers]="!paletteOpen() && !searchOpen()" />
      @if (searchOpen()) {
        <app-search-overlay (closed)="searchOpen.set(false)" (jumped)="jumpToDay($event)" />
      }
      @if (paletteOpen()) {
        <div
          data-screen-label="Command palette"
          style="position:absolute;inset:0;background:rgba(43,40,34,.18);display:flex;justify-content:center;padding-top:64px;z-index:700"
          (click)="paletteOpen.set(false)"
        >
          <div style="align-self:flex-start" (click)="$event.stopPropagation()">
            <db-command-palette
              [groups]="paletteGroups"
              placeholder="Type a command or date…"
              (picked)="runPaletteItem($event)"
            />
          </div>
        </div>
      }
    </div>
    @if (selection.selection()) {
      <app-inspector />
    }
  `,
})
export class App {
  protected readonly selection = inject(SelectionStore);
  private readonly viewport = inject(ViewportStore);
  private readonly tools = inject(ToolStore);
  private readonly desk = inject(DeskStore);
  private readonly history = inject(HistoryStore);
  private readonly actions = inject(DeskActions);

  /** Dark-theme flag; mirrored onto `<html data-theme>`. */
  protected readonly dark = signal(false);
  /** Command palette visibility. */
  protected readonly paletteOpen = signal(false);
  /** Search overlay visibility. */
  protected readonly searchOpen = signal(false);

  protected readonly paletteGroups = PALETTE_GROUPS;

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.dark() ? 'dark' : '';
    });
  }

  /** Jumps home to today: month tier, refit, and a flash on today's cell. */
  protected goToday(): void {
    const now = new Date();
    const day = now.getFullYear() === 2026 && now.getMonth() === 8 ? now.getDate() : 15;
    this.jumpToDay(day);
  }

  /** Closes overlays, refits the month sheet, and flashes the target day. */
  protected jumpToDay(day: number): void {
    this.searchOpen.set(false);
    this.paletteOpen.set(false);
    this.viewport.fitTier('Month');
    this.desk.flash(day);
  }

  protected openSearch(): void {
    this.searchOpen.set(true);
    this.paletteOpen.set(false);
  }

  protected openPalette(): void {
    this.paletteOpen.set(true);
    this.searchOpen.set(false);
  }

  /** Executes the few palette rows that are wired in this milestone. */
  protected runPaletteItem(item: DbPaletteItem): void {
    this.paletteOpen.set(false);
    switch (item.label) {
      case 'Today':
        this.goToday();
        break;
      case 'New sticky note':
        this.actions.addSticky();
        break;
      case 'Fit month':
        this.viewport.fitTier('Month');
        break;
      case 'Toggle layer: Photos':
        this.desk.toggleLayerVisibility(4);
        break;
    }
  }

  /** Global shortcuts: ⌘K, Escape, space-pan, undo/redo, tools, N. */
  protected onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const tag = (target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || target.isContentEditable;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.update((open) => !open);
      this.searchOpen.set(false);
      return;
    }
    if (event.key === 'Escape') {
      this.paletteOpen.set(false);
      this.searchOpen.set(false);
      this.selection.clear();
      return;
    }
    if (typing) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.history.redo();
      else this.history.undo();
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      this.tools.spaceHeld.set(true);
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'n') {
      this.actions.addSticky();
      return;
    }
    const tool = TOOL_KEYS[key];
    if (tool) this.tools.activate(tool);
  }

  /** Releases the temporary space-pan mode. */
  protected onKeyUp(event: KeyboardEvent): void {
    if (event.key === ' ') this.tools.spaceHeld.set(false);
  }
}
