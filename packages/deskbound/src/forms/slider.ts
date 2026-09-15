/**
 * `<db-slider>` — range slider with an optional numeric readout.
 */

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'db-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-slider' },
  template: `
    <input
      type="range"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [value]="value()"
      [attr.aria-label]="ariaLabel()"
      (input)="value.set(+$any($event.target).value)"
    />
    @if (showValue()) {
      <span class="db-slider-val">{{ value() }}{{ unit() }}</span>
    }
  `,
})
export class DbSlider {
  /** Current value; two-way bindable. */
  readonly value = model(0);
  /** Inclusive lower bound. */
  readonly min = input(0);
  /** Inclusive upper bound. */
  readonly max = input(100);
  /** Step increment. */
  readonly step = input(1);
  /** Unit suffix shown after the readout, e.g. `"%"`. */
  readonly unit = input('');
  /** Whether to render the numeric readout. */
  readonly showValue = input(true);
  /** Accessible name for the range input. */
  readonly ariaLabel = input('Value');
}
