/**
 * `<db-tool-button>` — square tool-rail button with icon, corner shortcut
 * hint, and a hover/focus tooltip.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DbIcon } from './icon';
import type { IconName } from '../icons/icon-registry';

@Component({
  selector: 'db-tool-button',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-tipwrap' },
  template: `
    <button
      class="db-tool"
      [attr.data-active]="active()"
      [attr.data-temp]="temp()"
      [disabled]="disabled()"
      [attr.aria-label]="label()"
      [attr.aria-pressed]="active()"
      (click)="pressed.emit()"
    >
      <db-icon [name]="icon()" />
      @if (shortcut(); as key) {
        <span class="db-tool-key">{{ key }}</span>
      }
    </button>
    @if (label(); as text) {
      <span class="db-tip" role="tooltip">
        {{ text }}
        @if (shortcut(); as key) {
          <span class="db-kbd"><kbd>{{ key }}</kbd></span>
        }
      </span>
    }
  `,
})
export class DbToolButton {
  /** Icon shown on the button face. */
  readonly icon = input.required<IconName>();
  /** Accessible name and tooltip text. */
  readonly label = input<string | null>(null);
  /** Single-key shortcut hint, e.g. `"V"`. */
  readonly shortcut = input<string | null>(null);
  /** `true` when this tool is the active one. */
  readonly active = input(false);
  /** `true` while the tool is only temporarily engaged (e.g. space-pan). */
  readonly temp = input(false);
  /** Disables the button. */
  readonly disabled = input(false);
  /** Emits when the button is clicked. */
  readonly pressed = output<void>();
}
