/**
 * Top application toolbar: brand, Today, date navigator, tier presets,
 * search, command palette trigger, theme toggle, and primary action.
 *
 * The tier control reflects the tier *derived* from the current zoom and
 * applies zoom/position presets when clicked (the workspace is one
 * continuous world since milestone 2).
 */

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import {
  DbButton,
  DbDateNavigator,
  DbSearchField,
  DbSegmented,
} from '@infinite-desk/deskbound';

import { ViewportStore, type Tier } from '../state/viewport-store';

@Component({
  selector: 'app-toolbar',
  imports: [DbButton, DbDateNavigator, DbSearchField, DbSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      'grid-column:1/4;display:flex;align-items:center;gap:8px;padding:0 10px;background:var(--surface-toolbar);border-bottom:1px solid var(--border)',
  },
  template: `
    <span style="font:600 15px var(--font-calendar);margin-right:4px">Deskbound</span>
    <button db-button variant="subtle" (click)="goToday.emit()">Today</button>
    <db-date-navigator
      [label]="viewport.navLabel()"
      [zoomLabel]="viewport.tier()"
      (jump)="openPalette.emit()"
    />
    <db-segmented
      [options]="tiers"
      [value]="viewport.tier()"
      (valueChange)="viewport.fitTier($any($event))"
    />
    <span style="flex:1"></span>
    <div style="cursor:pointer" (click)="openSearch.emit(); $event.stopPropagation()">
      <db-search-field
        placeholder="Search events, notes, dates…"
        style="width:230px;pointer-events:none"
      />
    </div>
    <button db-button variant="subtle" icon="command" (click)="openPalette.emit(); $event.stopPropagation()">
      Commands
    </button>
    <button
      db-button
      variant="ghost"
      [icon]="dark() ? 'sun' : 'moon'"
      [iconOnly]="true"
      title="Toggle theme"
      (click)="toggleTheme.emit(); $event.stopPropagation()"
    ></button>
    <button db-button variant="primary" icon="calendar-plus">New event</button>
  `,
})
export class Toolbar {
  protected readonly viewport = inject(ViewportStore);
  /** All selectable tier presets, closest first. */
  protected readonly tiers: Tier[] = ['Day', 'Week', 'Month', 'Year'];

  /** Whether the dark theme is active (drives the toggle icon). */
  readonly dark = input(false);
  /** Emits when Today is clicked. */
  readonly goToday = output<void>();
  /** Emits when the search field is engaged. */
  readonly openSearch = output<void>();
  /** Emits when the command palette should open. */
  readonly openPalette = output<void>();
  /** Emits when the theme toggle is clicked. */
  readonly toggleTheme = output<void>();
}
