/**
 * `<db-calendar-cell>` — one day cell of the month sheet, with the slab
 * date numeral and projected content (events, tasks, ranges, handwriting).
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'db-calendar-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'db-cell',
    '[attr.data-weekend]': 'weekend()',
    '[attr.data-outside]': 'outside()',
    '[attr.data-selected]': 'selected()',
    '[style.minHeight.px]': 'minHeight()',
  },
  template: `
    <span class="db-datenum" [attr.data-kind]="numeralKind()">{{ day() }}</span>
    <ng-content />
  `,
})
export class DbCalendarCell {
  /** Day-of-month numeral. */
  readonly day = input.required<number>();
  /** Accent "today" stamp on the numeral. */
  readonly today = input(false);
  /** Weekend paper tint. */
  readonly weekend = input(false);
  /** Adjacent-month filler cell (dimmed). */
  readonly outside = input(false);
  /** Drafting-blue selection outline. */
  readonly selected = input(false);
  /** Holiday numeral tint. */
  readonly holiday = input(false);
  /** Minimum cell height in pixels. */
  readonly minHeight = input(96);

  /** Numeral emphasis derived from today/holiday/selected flags. */
  protected readonly numeralKind = computed(() =>
    this.today() ? 'today' : this.holiday() ? 'holiday' : this.selected() ? 'selected' : null,
  );
}
