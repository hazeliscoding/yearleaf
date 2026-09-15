/**
 * `<button db-button>` — Deskbound button applied to a native `<button>`,
 * so disabled state, click handling, and focus semantics stay native.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DbIcon } from './icon';
import type { IconName } from '../icons/icon-registry';

/** Visual button variants defined by the design system. */
export type DbButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger';

/**
 * Button chrome.
 *
 * Usage: `<button db-button variant="primary" icon="calendar-plus">New event</button>`.
 * For icon-only buttons set `iconOnly` and provide a `title` for the
 * accessible name.
 */
@Component({
  selector: 'button[db-button]',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (icon(); as name) {
      <db-icon [name]="name" [size]="size() === 'sm' ? 13 : 14" />
    }
    @if (!iconOnly()) {
      <ng-content />
    }
  `,
})
export class DbButton {
  /** Visual variant; `secondary` is the bordered default. */
  readonly variant = input<DbButtonVariant>('secondary');
  /** Optional compact/large sizing. */
  readonly size = input<'sm' | 'lg' | null>(null);
  /** Optional leading icon. */
  readonly icon = input<IconName | null>(null);
  /** Renders only the icon (square button); label content is suppressed. */
  readonly iconOnly = input(false);

  /** Composed `db-btn` class list for the host button. */
  protected readonly classes = computed(() =>
    [
      'db-btn',
      this.variant() !== 'secondary' && `db-btn--${this.variant()}`,
      this.size() && `db-btn--${this.size()}`,
      this.iconOnly() && 'db-btn--icon',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
