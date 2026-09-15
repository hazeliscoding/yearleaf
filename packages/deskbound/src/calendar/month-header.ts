/**
 * `<db-month-header>` — month sheet title row with prev/today/next controls.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DbButton } from '../core/button';

@Component({
  selector: 'db-month-header',
  imports: [DbButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:flex;align-items:baseline;gap:12px' },
  template: `
    <span style="font:var(--text-month-title)">{{ month() }}</span>
    <span style="font:var(--text-month-title);color:var(--ink-muted);font-weight:400">{{
      year()
    }}</span>
    <span style="flex:1"></span>
    <span style="display:flex;gap:4px;align-items:center">
      <button db-button variant="ghost" size="sm" icon="chevron-left" [iconOnly]="true" title="Previous month" (click)="prev.emit()"></button>
      <button db-button variant="subtle" size="sm" (click)="today.emit()">Today</button>
      <button db-button variant="ghost" size="sm" icon="chevron-right" [iconOnly]="true" title="Next month" (click)="next.emit()"></button>
    </span>
  `,
})
export class DbMonthHeader {
  /** Month display name, e.g. `"September"`. */
  readonly month = input.required<string>();
  /** Four-digit year. */
  readonly year = input.required<number>();
  /** Emits when the previous-month chevron is clicked. */
  readonly prev = output<void>();
  /** Emits when the next-month chevron is clicked. */
  readonly next = output<void>();
  /** Emits when the Today button is clicked. */
  readonly today = output<void>();
}
