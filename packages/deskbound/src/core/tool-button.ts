/**
 * `<db-tool-button>` — square tool-rail button with icon, corner shortcut
 * hint, and a hover/focus tooltip.
 *
 * The corner carries a bare key only. A chord is left to the tooltip, which
 * has room to set it: the corner is 8.5px of `--ink-muted` in a 32px cell,
 * which survives one letter the eye pattern-matches and not a word it has to
 * read. The rule lives here rather than at the call sites so the next
 * `shortcut="Mod+S"` gets it without knowing it exists.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { DbIcon } from './icon';
import { DB_MODIFIER_CAP, isSingleCap, resolveHint } from './platform';
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
      @if (badge(); as key) {
        <span class="db-tool-key">{{ key }}</span>
      }
    </button>
    @if (label(); as text) {
      <span class="db-tip" role="tooltip">
        {{ text }}
        @if (hint(); as key) {
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
  /**
   * Shortcut hint as `+`-separated logical caps, e.g. `"V"` or `"Mod+Z"`.
   * A bare key is printed on the button corner as well as in the tooltip;
   * a chord is printed in the tooltip alone.
   */
  readonly shortcut = input<string | null>(null);
  /** `true` when this tool is the active one. */
  readonly active = input(false);
  /** `true` while the tool is only temporarily engaged (e.g. space-pan). */
  readonly temp = input(false);
  /** Disables the button. */
  readonly disabled = input(false);
  /** Emits when the button is clicked. */
  readonly pressed = output<void>();

  private readonly modifier = inject(DB_MODIFIER_CAP);

  /** {@link shortcut} written for this platform's keyboard. */
  protected readonly hint = computed(() => {
    const shortcut = this.shortcut();
    return shortcut === null ? null : resolveHint(shortcut, this.modifier);
  });

  /** {@link hint} when it is a bare key, which is all the corner can hold. */
  protected readonly badge = computed(() => {
    const shortcut = this.shortcut();
    return shortcut !== null && isSingleCap(shortcut) ? this.hint() : null;
  });
}
