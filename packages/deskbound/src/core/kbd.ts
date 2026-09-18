/**
 * `<db-kbd>` — a sequence of keycaps, e.g. `⌘` `K`.
 *
 * Callers pass the logical `'Mod'` rather than a glyph; the cap printed
 * follows the host keyboard — `⌘` on macOS, `Ctrl` elsewhere.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { DB_MODIFIER_CAP, resolveCaps } from './platform';

@Component({
  selector: 'db-kbd',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-kbd' },
  template: `
    @for (key of caps(); track $index) {
      <kbd>{{ key }}</kbd>
    }
  `,
})
export class DbKbd {
  /** Keys rendered as individual keycaps, in order; `'Mod'` is resolved. */
  readonly keys = input.required<readonly string[]>();

  private readonly modifier = inject(DB_MODIFIER_CAP);

  /** {@link keys} with the logical modifier replaced by this platform's cap. */
  protected readonly caps = computed(() => resolveCaps(this.keys(), this.modifier));
}
