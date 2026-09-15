/**
 * `<db-range-bar>` — multi-day range segment (vacation, project, travel,
 * deadline) rendered inside calendar cells or above week columns.
 *
 * Edge shaping for multi-cell ranges (squared inner corners, bleed into
 * neighboring cells) is applied by the caller via host styles.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DbIcon } from '../core/icon';
import type { IconName } from '../icons/icon-registry';

/** Default color and icon per range kind. */
const KINDS: Record<string, { c: string; icon: IconName }> = {
  vacation: { c: 'mint', icon: 'sun' },
  project: { c: 'indigo', icon: 'pen-line' },
  travel: { c: 'coral', icon: 'plane' },
  deadline: { c: 'red', icon: 'flag' },
};

@Component({
  selector: 'db-range-bar',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'db-range',
    '[class.db-range--deadline]': "kind() === 'deadline'",
    '[style.background]':
      "'color-mix(in srgb,var(--stationery-' + resolvedColor() + ') 45%,var(--surface-raised))'",
    '[style.color]': "'var(--stationery-' + resolvedColor() + '-ink)'",
  },
  template: `
    <db-icon [name]="kindSpec().icon" [size]="10" />
    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ label() }}</span>
  `,
})
export class DbRangeBar {
  /** Segment label (usually only on the first day of the range). */
  readonly label = input('');
  /** Range category. */
  readonly kind = input<'vacation' | 'project' | 'travel' | 'deadline'>('project');
  /** Stationery color override; defaults to the kind's color. */
  readonly color = input<string | null>(null);

  /** Spec for the active kind. */
  protected readonly kindSpec = computed(() => KINDS[this.kind()] ?? KINDS['project']);
  /** Effective stationery color. */
  protected readonly resolvedColor = computed(() => this.color() ?? this.kindSpec().c);
}
