/**
 * `<db-segmented>` — segmented radio-group control.
 */

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'db-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-seg', role: 'radiogroup' },
  template: `
    @for (option of options(); track option) {
      <button
        type="button"
        role="radio"
        [attr.data-on]="value() === option"
        [attr.aria-checked]="value() === option"
        (click)="value.set(option)"
      >
        {{ option }}
      </button>
    }
  `,
})
export class DbSegmented {
  /** Selectable option labels (label doubles as value). */
  readonly options = input.required<readonly string[]>();
  /** Currently selected option; two-way bindable. */
  readonly value = model<string>('');
}
