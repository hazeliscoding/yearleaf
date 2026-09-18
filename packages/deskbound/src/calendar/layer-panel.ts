/**
 * `<db-layer-panel>` — floating panel listing the desk's layers as a color key.
 *
 * The panel is read-only by design. Desk objects carry no layer membership, so
 * per-layer visibility and lock controls would advertise behavior the
 * application cannot perform; they return once a layer reference exists on the
 * object model and the scene can act on it.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One row of the layer panel. */
export interface DbLayer {
  /** Layer display name. */
  readonly name: string;
  /** Stationery color key shown as the swatch dot. */
  readonly color: string;
}

@Component({
  selector: 'db-layer-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      'display:block;width:184px;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-standard);box-shadow:var(--shadow-1);padding:4px;font:var(--text-body-small)',
  },
  template: `
    @for (layer of layers(); track layer.name) {
      <div
        style="display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:var(--radius-subtle)"
      >
        <span
          style="width:8px;height:8px;border-radius:2px;flex:none"
          [style.background]="'var(--stationery-' + layer.color + ')'"
        ></span>
        <span style="flex:1">{{ layer.name }}</span>
      </div>
    }
  `,
})
export class DbLayerPanel {
  /** Layer rows, rendered in array order. */
  readonly layers = input.required<readonly DbLayer[]>();
}
