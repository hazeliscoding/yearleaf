/**
 * `<db-toggle>` — switch control.
 */

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'db-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-toggle' },
  template: `
    <input
      type="checkbox"
      role="switch"
      [checked]="checked()"
      [disabled]="disabled()"
      [attr.aria-label]="label() || null"
      (change)="checked.set($any($event.target).checked)"
    />
    @if (label(); as text) {
      <span>{{ text }}</span>
    }
  `,
})
export class DbToggle {
  /** Switch state; two-way bindable. */
  readonly checked = model(false);
  /** Optional visible label; also used as the accessible name. */
  readonly label = input<string | null>(null);
  /** Disables the switch. */
  readonly disabled = input(false);
}
