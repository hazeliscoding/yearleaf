/**
 * `<db-number-field>` — numeric input with unit suffix and stepper buttons.
 */

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'db-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-numfield' },
  template: `
    <input
      inputmode="numeric"
      [value]="value()"
      [attr.aria-label]="ariaLabel()"
      (change)="commit($any($event.target).value)"
    />
    @if (unit(); as suffix) {
      <span class="db-num-unit">{{ suffix }}</span>
    }
    <span class="db-num-steps">
      <button type="button" aria-label="Increase" (click)="stepBy(1)">▲</button>
      <button type="button" aria-label="Decrease" (click)="stepBy(-1)">▼</button>
    </span>
  `,
})
export class DbNumberField {
  /** Current numeric value; two-way bindable. */
  readonly value = model(0);
  /** Unit hint rendered inside the field, e.g. `"°"` or `"px"`. */
  readonly unit = input<string | null>(null);
  /** Stepper increment. */
  readonly step = input(1);
  /** Accessible name for the input. */
  readonly ariaLabel = input('Number');

  /** Parses typed input, ignoring values that are not numbers. */
  protected commit(raw: string): void {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) this.value.set(parsed);
  }

  /** Applies one stepper increment in the given direction. */
  protected stepBy(direction: 1 | -1): void {
    this.value.set(this.value() + direction * this.step());
  }
}
