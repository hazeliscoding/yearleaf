/**
 * Application shell: toolbar, tool rail, workspace, contextual inspector,
 * and the command-palette / search overlays, plus global keyboard behavior.
 */

import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';

import type { EventRecord } from '@infinite-desk/domain';
import { DbCommandPalette, type DbPaletteItem } from '@infinite-desk/deskbound';

import { PALETTE_GROUPS } from './data/sample-desk';
import { Inspector } from './shell/inspector';
import { SearchOverlay } from './shell/search-overlay';
import { Toolbar } from './shell/toolbar';
import { ToolRail } from './shell/tool-rail';
import { DeskActions } from './state/desk-actions';
import { DeskStore } from './state/desk-store';
import { EventActions } from './state/event-actions';
import { EventStore } from './state/event-store';
import { HistoryStore } from './state/history-store';
import { SelectionStore } from './state/selection-store';
import { ToolStore } from './state/tool-store';
import { ViewportStore, type Tier } from './state/viewport-store';
import { Workspace } from './workspace/workspace';

/** Tool labels reachable through single-key shortcuts; mirrors the key hints
 *  printed on the tool rail, so pressing a key and clicking its button agree.
 *  Tools that are not built yet claim no key — see `ToolSpec.unavailable`. */
const TOOL_KEYS: Record<string, string> = {
  v: 'Select',
  h: 'Pan',
  t: 'Text',
  n: 'Sticky note',
  k: 'Task',
  e: 'Event',
};
/** Arrow-key nudge distances in world units (plain / shift). */
const NUDGE = 16;
const NUDGE_LARGE = 64;

@Component({
  selector: 'app-root',
  imports: [DbCommandPalette, Inspector, SearchOverlay, Toolbar, ToolRail, Workspace],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      'display:grid;grid-template-rows:44px 1fr;grid-template-columns:44px 1fr auto;height:100vh;background:var(--surface-canvas)',
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
      (newEvent)="tools.activate('Event')"
    />
    <app-tool-rail />
    <div style="position:relative;overflow:hidden">
      <app-workspace style="position:absolute;inset:0" [showLayers]="!paletteOpen() && !searchOpen()" />
      @if (searchOpen()) {
        <app-search-overlay (closed)="searchOpen.set(false)" (jumped)="jumpToSeptemberDay($event)" />
      }
      @if (paletteOpen()) {
        <div
          data-screen-label="Command palette"
          style="position:absolute;inset:0;background:var(--scrim,rgba(43,40,34,.18));display:flex;justify-content:center;padding-top:64px;z-index:var(--z-palette,700)"
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
  protected readonly tools = inject(ToolStore);
  private readonly desk = inject(DeskStore);
  private readonly events = inject(EventStore);
  private readonly history = inject(HistoryStore);
  private readonly actions = inject(DeskActions);
  private readonly eventActions = inject(EventActions);

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

    // Dev/e2e affordance: `?tier=Year&theme=dark` applies a startup state
    // so headless screenshots can reach any view without interaction.
    const params = new URLSearchParams(location.search);
    if (params.get('theme') === 'dark') this.dark.set(true);
    const tier = params.get('tier');
    if (tier === 'Day' || tier === 'Week' || tier === 'Month' || tier === 'Year') {
      this.viewport.initialTier = tier as Tier;
    }
    // `?e2e` exposes a read-only bridge so Playwright can locate canvas
    // content and convert world to screen coordinates for real clicks.
    if (params.has('e2e')) {
      (globalThis as unknown as Record<string, unknown>)['__e2e'] = {
        floats: () => this.desk.floats(),
        viewport: () => this.viewport.viewport(),
        panTo: (x: number, y: number) => this.viewport.panTo(x, y),
        events: () => this.events.events(),
        // Titles the desk resolves for one day, after rule expansion and
        // override application — the same list the day cell draws.
        occurrencesOn: (iso: string) => {
          const day = new Date(iso);
          const index = this.events.occurrencesByDate({ from: day, to: day });
          return [...index.values()].flat().map((o) => o.event.title);
        },
        addEvent: (event: Record<string, unknown>) =>
          this.events.insert({
            ...(event as unknown as EventRecord),
            date: new Date(event['date'] as string),
            occurrenceDate: event['occurrenceDate']
              ? new Date(event['occurrenceDate'] as string)
              : undefined,
          }),
        // The double-click path: materialise the selected occurrence, then
        // rename the row that now stands for that date.
        editSelectedOccurrence: (title: string) => {
          const occurrence = this.selection.occurrence();
          if (!occurrence) return false;
          this.eventActions.setTitle(this.eventActions.materialise(occurrence), title);
          return true;
        },
        // Selects the chip belonging to one stored event, wherever it sits.
        selectEvent: (id: string) => {
          const event = this.events.get(id);
          if (!event) return false;
          const day = event.occurrenceDate ?? event.date;
          const found = [...this.events.occurrencesByDate({ from: day, to: day }).values()]
            .flat()
            .find((o) => o.event.id === id);
          if (!found) return false;
          this.selection.select('event', found.id);
          this.selection.occurrence.set(found);
          return true;
        },
        // Selecting a chip by date rather than by pixel: the chip's position
        // depends on zoom and on what else shares the day.
        selectOccurrenceOn: (iso: string, index: number) => {
          const day = new Date(iso);
          const found = [...this.events.occurrencesByDate({ from: day, to: day }).values()]
            .flat()
            .at(index);
          if (!found) return false;
          this.selection.select('event', found.id);
          this.selection.occurrence.set(found);
          return true;
        },
        toScreen: (x: number, y: number) => {
          const v = this.viewport.viewport();
          return { x: v.panX + x * v.zoom, y: v.panY + y * v.zoom };
        },
      };
    }
  }

  /** Jumps home: centers today's cell and flashes it. */
  protected goToday(): void {
    this.jumpToDate(new Date());
  }

  /** Closes overlays, centers the target day, and flashes it. */
  protected jumpToDate(date: Date): void {
    this.searchOpen.set(false);
    this.paletteOpen.set(false);
    this.viewport.centerOnDate(date);
    this.desk.flash(date);
  }

  /** Search results reference days of the September 2026 sample desk. */
  protected jumpToSeptemberDay(day: number): void {
    this.jumpToDate(new Date(2026, 8, day));
  }

  protected openSearch(): void {
    this.searchOpen.set(true);
    this.paletteOpen.set(false);
  }

  protected openPalette(): void {
    this.paletteOpen.set(true);
    this.searchOpen.set(false);
  }

  /** Executes the palette rows that are wired in this milestone. */
  protected runPaletteItem(item: DbPaletteItem): void {
    this.paletteOpen.set(false);
    switch (item.label) {
      case 'Today':
        this.goToday();
        break;
      case 'Next Friday':
        this.jumpToSeptemberDay(18);
        break;
      case 'October 2026':
        this.viewport.fitMonthOf(2026, 9);
        break;
      case 'Jump to Kyoto trip':
        this.jumpToSeptemberDay(17);
        break;
      case 'New sticky note':
        this.actions.addSticky(this.viewport.centerWorld(), true);
        break;
      case 'Fit month':
        this.viewport.fitTier('Month');
        break;
      case 'Toggle layer: Photos':
        this.desk.toggleLayerVisibility(4);
        break;
    }
  }

  /** Global shortcuts: ⌘K, Escape, space-pan, undo/redo, tools, N, Delete, arrows. */
  protected onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const tag = (target.tagName || '').toLowerCase();
    // `tools.editing()` covers the frame between an editor appearing and
    // receiving focus, where the event target is still the document body.
    const typing =
      tag === 'input' || tag === 'textarea' || target.isContentEditable || this.tools.editing();

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

    const selected = this.selection.selection();
    const selectedObject = selected && selected.kind !== 'event' ? selected.id : null;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedObject) {
        this.actions.deleteObject(selectedObject);
        return;
      }
      // Cancelling one date of a series suppresses that occurrence rather than
      // deleting the series; both routes are undoable.
      const occurrence = this.selection.occurrence();
      if (occurrence) {
        this.eventActions.removeOccurrence(occurrence);
        return;
      }
    }
    if (event.key.startsWith('Arrow') && selectedObject) {
      event.preventDefault();
      const step = event.shiftKey ? NUDGE_LARGE : NUDGE;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      this.actions.nudge(selectedObject, dx, dy);
      return;
    }

    const key = event.key.toLowerCase();
    // The palette advertises ⇧T for Today, so the Text tool must not eat it.
    if (key === 't' && event.shiftKey) {
      this.goToday();
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
