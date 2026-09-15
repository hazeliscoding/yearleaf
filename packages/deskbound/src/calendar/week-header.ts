/**
 * `<db-week-header>` — Monday-first weekday label row for the month sheet.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Weekday label sets by format. */
const NAMES = {
  full: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  abbr: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  narrow: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
} as const;

@Component({
  selector: 'db-week-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-weekhead' },
  template: `
    @for (name of names(); track $index) {
      <span style="padding-left:6px" [style.color]="$index > 4 ? 'var(--ink-disabled)' : null">{{
        name
      }}</span>
    }
  `,
})
export class DbWeekHeader {
  /** Label length variant. */
  readonly format = input<'full' | 'abbr' | 'narrow'>('abbr');

  /** Labels for the active format. */
  protected readonly names = computed(() => NAMES[this.format()]);
}
