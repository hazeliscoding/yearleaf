/**
 * `<db-date-navigator>` — toolbar widget showing the current position in
 * time (label + zoom tier) with a "Jump to date" affordance.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DbIcon } from '../core/icon';
import { DbKbd } from '../core/kbd';

@Component({
  selector: 'db-date-navigator',
  imports: [DbIcon, DbKbd],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      'display:inline-flex;align-items:center;gap:8px;padding:4px 6px 4px 10px;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-standard);box-shadow:var(--shadow-1);font:var(--text-body-small)',
  },
  template: `
    <db-icon name="calendar" [size]="13" />
    <!-- Either side of the label, because they move what it names: a month
         when it reads "September 2026", a year when it reads "2026". The
         calendar runs three months across, so scrolling is not a substitute —
         dragging downward from September arrives at December. -->
    <button
      class="db-nav-step"
      type="button"
      [attr.aria-label]="'Previous ' + unit()"
      [title]="'Previous ' + unit()"
      (click)="previous.emit()"
    >
      <db-icon name="chevron-left" [size]="14" />
    </button>
    <span style="font:500 13px var(--font-calendar);min-width:106px;text-align:center">{{
      label()
    }}</span>
    <button
      class="db-nav-step"
      type="button"
      [attr.aria-label]="'Next ' + unit()"
      [title]="'Next ' + unit()"
      (click)="next.emit()"
    >
      <db-icon name="chevron-right" [size]="14" />
    </button>
    <span
      style="font:var(--text-metadata);color:var(--ink-muted);text-transform:uppercase;letter-spacing:var(--tracking-metadata)"
      >{{ zoomLabel() }}</span
    >
    <button class="db-btn db-btn--sm db-btn--subtle" (click)="jump.emit()">
      Jump to date&nbsp;<db-kbd [keys]="['⌘', 'J']" />
    </button>
  `,
})
export class DbDateNavigator {
  /** Position label, e.g. `"September 2026"`. */
  readonly label = input.required<string>();
  /** Active zoom tier label, e.g. `"Month"`. */
  readonly zoomLabel = input('Month');
  /** What one step moves, named in the arrows' accessible labels. */
  readonly unit = input<'month' | 'year'>('month');
  /** Emits when "Jump to date" is clicked. */
  readonly jump = output<void>();
  /** Emits when the back arrow is used. */
  readonly previous = output<void>();
  /** Emits when the forward arrow is used. */
  readonly next = output<void>();
}
