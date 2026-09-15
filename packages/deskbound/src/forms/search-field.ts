/**
 * `<db-search-field>` — compact search input with a leading glyph.
 */

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { DbIcon } from '../core/icon';

@Component({
  selector: 'db-search-field',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-search' },
  template: `
    <db-icon name="search" [size]="13" />
    <input
      class="db-input"
      type="search"
      aria-label="Search"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="value.set($any($event.target).value)"
    />
  `,
})
export class DbSearchField {
  /** Placeholder copy. */
  readonly placeholder = input('Search…');
  /** Current query; two-way bindable. */
  readonly value = model('');
}
