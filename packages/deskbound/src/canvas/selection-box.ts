/**
 * `<db-selection-box>` — drafting-blue selection chrome around a canvas
 * object: outline, four resize handles, and an optional rotation handle.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'db-selection-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'db-selbox',
    '[attr.data-sel]': 'selected()',
    '[attr.data-locked]': 'locked()',
    '[attr.data-group]': 'group()',
    '[attr.data-drag]': 'dragging()',
  },
  template: `
    <ng-content />
    @if (selected()) {
      <span class="db-sel-outline"></span>
      @if (!locked()) {
        <span class="db-h" style="top:-4px;left:-4px"></span>
        <span class="db-h" style="top:-4px;right:-4px"></span>
        <span class="db-h" style="bottom:-4px;left:-4px"></span>
        <span class="db-h" style="bottom:-4px;right:-4px"></span>
        @if (rotatable()) {
          <span class="db-rot"></span>
        }
      }
    }
  `,
})
export class DbSelectionBox {
  /** Whether the selection chrome is visible. */
  readonly selected = input(false);
  /** Dashed neutral outline without handles (locked object). */
  readonly locked = input(false);
  /** Dashed outline marking a group selection. */
  readonly group = input(false);
  /** Lifted drag styling while the object is being moved. */
  readonly dragging = input(false);
  /** Show the rotation handle above the box. */
  readonly rotatable = input(false);
}
