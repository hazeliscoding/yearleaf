/**
 * `<db-zoom-control>` — floating workspace zoom widget: −/+ steps, the
 * current percentage, and fit shortcuts.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DbIcon } from '../core/icon';

@Component({
  selector: 'db-zoom-control',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      'display:inline-flex;align-items:center;gap:2px;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-standard);box-shadow:var(--shadow-1);padding:2px',
  },
  template: `
    <button class="db-tool" style="width:24px;height:24px" aria-label="Zoom out" (click)="zoomOut.emit()">
      <db-icon name="minus" [size]="12" />
    </button>
    <span
      class="db-numeral"
      style="font:var(--text-numeral-sm);min-width:38px;text-align:center;color:var(--ink-secondary)"
      >{{ zoom() }}%</span
    >
    <button class="db-tool" style="width:24px;height:24px" aria-label="Zoom in" (click)="zoomIn.emit()">
      <db-icon name="plus" [size]="12" />
    </button>
    <span class="db-toolbar-divider" style="margin:2px 2px"></span>
    <button class="db-btn db-btn--sm db-btn--subtle" (click)="fitMonth.emit()">Fit month</button>
    <button class="db-btn db-btn--sm db-btn--subtle" (click)="fitYear.emit()">Fit year</button>
  `,
})
export class DbZoomControl {
  /** Current zoom percentage (already rounded). */
  readonly zoom = input.required<number>();
  /** Emits on the + button. */
  readonly zoomIn = output<void>();
  /** Emits on the − button. */
  readonly zoomOut = output<void>();
  /** Emits on "Fit month". */
  readonly fitMonth = output<void>();
  /** Emits on "Fit year". */
  readonly fitYear = output<void>();
}
