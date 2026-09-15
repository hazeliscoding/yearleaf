/**
 * `<db-layer-panel>` — floating panel listing desk layers with color key,
 * lock state, and visibility toggles.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DbIcon } from '../core/icon';

/** One row of the layer panel. */
export interface DbLayer {
  /** Layer display name. */
  readonly name: string;
  /** Stationery color key shown as the swatch dot. */
  readonly color: string;
  /** `false` renders the row dimmed with an eye-off toggle. */
  readonly visible?: boolean;
  /** Locked layers show a lock glyph. */
  readonly locked?: boolean;
}

@Component({
  selector: 'db-layer-panel',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      'display:block;width:184px;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-standard);box-shadow:var(--shadow-1);padding:4px;font:var(--text-body-small)',
  },
  template: `
    @for (layer of layers(); track layer.name; let i = $index) {
      <div
        style="display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:var(--radius-subtle)"
        [style.opacity]="layer.visible === false ? 0.5 : 1"
      >
        <span
          style="width:8px;height:8px;border-radius:2px;flex:none"
          [style.background]="'var(--stationery-' + layer.color + ')'"
        ></span>
        <span style="flex:1">{{ layer.name }}</span>
        @if (layer.locked) {
          <db-icon name="lock" [size]="11" style="color:var(--ink-muted)" />
        }
        <button
          class="db-tool"
          style="width:20px;height:20px"
          [attr.aria-label]="(layer.visible === false ? 'Show ' : 'Hide ') + layer.name"
          (click)="toggleLayer.emit(i)"
        >
          <db-icon [name]="layer.visible === false ? 'eye-off' : 'eye'" [size]="12" />
        </button>
        <db-icon name="grip-vertical" [size]="11" style="color:var(--ink-disabled);cursor:grab" />
      </div>
    }
  `,
})
export class DbLayerPanel {
  /** Layer rows, top-most first. */
  readonly layers = input.required<readonly DbLayer[]>();
  /** Emits the row index whose visibility toggle was clicked. */
  readonly toggleLayer = output<number>();
}
