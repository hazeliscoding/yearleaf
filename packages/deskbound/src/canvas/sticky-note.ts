/**
 * `<db-sticky-note>` — paper sticky note in the 13 stationery colors,
 * with optional handwriting, checklist, pin, fold, and lock affordances.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DbIcon } from '../core/icon';
import type { ChecklistItem } from '@infinite-desk/domain';

@Component({
  selector: 'db-sticky-note',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'db-sticky',
    '[class.db-sticky--compact]': "variant() === 'compact'",
    '[class.db-sticky--large]': "variant() === 'large'",
    '[class.db-sticky--hand]': 'hand()',
    '[attr.data-folded]': 'folded()',
    '[style.--sc]': "'var(--stationery-' + color() + ')'",
    '[style.--sci]': "'var(--stationery-' + color() + '-ink)'",
  },
  template: `
    @if (pinned()) {
      <span class="db-pin" aria-label="Pinned"></span>
    }
    @if (locked()) {
      <span class="db-lockmark"><db-icon name="lock" [size]="10" /></span>
    }
    @if (items(); as list) {
      <ul>
        @for (item of list; track $index) {
          <li [attr.data-done]="!!item.done">
            <i class="db-box"></i>
            <span>{{ item.label }}</span>
          </li>
        }
      </ul>
    } @else {
      <ng-content />
    }
  `,
})
export class DbStickyNote {
  /** Stationery color name, e.g. `"mint"`. */
  readonly color = input('yellow');
  /** Size variant. */
  readonly variant = input<'standard' | 'compact' | 'large'>('standard');
  /** Render projected text in the handwriting typeface. */
  readonly hand = input(false);
  /** Checklist entries; when present they replace the projected text. */
  readonly items = input<readonly ChecklistItem[] | null>(null);
  /** Show the red push pin. */
  readonly pinned = input(false);
  /** Show the folded bottom-right corner. */
  readonly folded = input(false);
  /** Show the lock glyph. */
  readonly locked = input(false);
}
