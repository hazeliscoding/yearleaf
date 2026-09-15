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
    <span style="font:500 13px var(--font-calendar)">{{ label() }}</span>
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
  /** Emits when "Jump to date" is clicked. */
  readonly jump = output<void>();
}
