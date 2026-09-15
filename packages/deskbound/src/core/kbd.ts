/**
 * `<db-kbd>` — a sequence of keycaps, e.g. `⌘` `K`.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'db-kbd',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-kbd' },
  template: `
    @for (key of keys(); track $index) {
      <kbd>{{ key }}</kbd>
    }
  `,
})
export class DbKbd {
  /** Keys rendered as individual keycaps, in order. */
  readonly keys = input.required<readonly string[]>();
}
