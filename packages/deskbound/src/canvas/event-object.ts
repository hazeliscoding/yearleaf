/**
 * `<db-event-object>` — calendar event chip: timed, all-day, tentative,
 * or completed, with recurrence/reminder glyphs and an expanded layout.
 */

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DbIcon } from '../core/icon';

@Component({
  selector: 'db-event-object',
  imports: [DbIcon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'db-event',
    '[class.db-event--allday]': "variant() === 'allday'",
    '[class.db-event--tentative]': "variant() === 'tentative'",
    '[class.db-event--completed]': "variant() === 'completed'",
    '[class.db-event--expanded]': 'expanded()',
    '[style.--ec]': "'var(--stationery-' + color() + ')'",
    '[style.--eci]': "'var(--stationery-' + color() + '-ink)'",
  },
  template: `
    @if (expanded()) {
      <div style="display:flex;align-items:center;gap:6px">
        <ng-container *ngTemplateOutlet="head" />
      </div>
      @if (meta(); as info) {
        <div style="font:var(--text-caption);color:var(--ink-muted)">{{ info }}</div>
      }
    } @else {
      <ng-container *ngTemplateOutlet="head" />
    }
    <ng-template #head>
      @if (time(); as start) {
        <span class="db-event-time">{{ start }}</span>
      }
      <span
        class="db-event-title"
        style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
        >{{ title() }}</span
      >
      @if (recurring()) {
        <db-icon name="repeat" [size]="11" />
      }
      @if (reminder()) {
        <db-icon name="bell" [size]="11" />
      }
      @if (variant() === 'completed') {
        <db-icon name="check" [size]="11" />
      }
    </ng-template>
  `,
  styles: ':host.db-event--expanded{flex-direction:column;align-items:stretch}',
})
export class DbEventObject {
  /** Event title. */
  readonly title = input.required<string>();
  /** Start time (`HH:mm`); omit for all-day events. */
  readonly time = input<string | null>(null);
  /** Stationery color of the chip. */
  readonly color = input('blue');
  /** Status/visual variant. */
  readonly variant = input<'timed' | 'allday' | 'tentative' | 'completed'>('timed');
  /** Show the recurrence glyph. */
  readonly recurring = input(false);
  /** Show the reminder glyph. */
  readonly reminder = input(false);
  /** Two-line layout with a metadata row. */
  readonly expanded = input(false);
  /** Metadata line shown when {@link expanded}. */
  readonly meta = input<string | null>(null);
}
