/**
 * `<db-command-palette>` — ⌘K palette with grouped, keyboard-hinted results.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

import { DbIcon } from '../core/icon';
import { DbKbd } from '../core/kbd';
import type { IconName } from '../icons/icon-registry';

/** One actionable row in the palette. */
export interface DbPaletteItem {
  /** Leading icon; omitted rows keep their gutter alignment. */
  readonly icon?: IconName;
  /** Primary label. */
  readonly label: string;
  /** Secondary metadata, e.g. a resolved date. */
  readonly meta?: string;
  /** Keycap sequence hint. */
  readonly shortcut?: readonly string[];
  /** Highlighted (keyboard-selected) row. */
  readonly selected?: boolean;
}

/** A labelled group of palette items. */
export interface DbPaletteGroup {
  /** Group heading, e.g. `"Go to"`. */
  readonly label: string;
  /** Rows in the group. */
  readonly items: readonly DbPaletteItem[];
}

@Component({
  selector: 'db-command-palette',
  imports: [DbIcon, DbKbd],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `display:block` is required on the host: a custom element defaults to
  // inline, which drops the class's width and overflow and paints the panel
  // background as fragmented line boxes (same fix as DbInspectorPanel).
  host: {
    class: 'db-palette',
    style: 'display:block',
    role: 'dialog',
    'aria-label': 'Command palette',
  },
  template: `
    <div class="db-palette-input">
      <db-icon name="command" [size]="15" />
      <input
        #queryInput
        [value]="query()"
        [placeholder]="placeholder()"
        (input)="query.set($any($event.target).value)"
      />
      <db-kbd [keys]="['⎋']" />
    </div>
    <div style="max-height:320px;overflow-y:auto;padding-bottom:6px">
      @for (group of groups(); track group.label) {
        <div>
          <div class="db-palette-group">{{ group.label }}</div>
          @for (item of group.items; track item.label) {
            <div class="db-palette-item" [attr.data-sel]="!!item.selected" (click)="picked.emit(item)">
              @if (item.icon; as icon) {
                <db-icon [name]="icon" />
              } @else {
                <span style="width:16px"></span>
              }
              <span>{{ item.label }}</span>
              @if (item.meta; as meta) {
                <span class="db-pal-meta">{{ meta }}</span>
              }
              <span class="db-grow"></span>
              @if (item.shortcut; as keys) {
                <db-kbd [keys]="keys" />
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DbCommandPalette {
  /** Current query text; two-way bindable. */
  readonly query = model('');
  /** Input placeholder copy. */
  readonly placeholder = input('Type a command, date, or search…');
  /** Grouped rows to display. */
  readonly groups = input.required<readonly DbPaletteGroup[]>();
  /** Emits the row the user clicked. */
  readonly picked = output<DbPaletteItem>();

  private readonly queryInput = viewChild.required<ElementRef<HTMLInputElement>>('queryInput');

  constructor() {
    // The palette opens as an overlay; focus must land in the query field.
    afterNextRender(() => this.queryInput().nativeElement.focus());
  }
}
