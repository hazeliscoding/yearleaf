/**
 * `<db-color-picker>` — compact swatch row over the sticky-note stationery
 * palette. Values are CSS custom property names (`--stationery-teal`).
 */

import { ChangeDetectionStrategy, Component, model } from '@angular/core';

/** Sticky-note swatch group from the design system's ColorPicker. */
const STICKY_SWATCHES = [
  '--stationery-yellow',
  '--stationery-coral',
  '--stationery-green',
  '--stationery-teal',
  '--stationery-indigo',
  '--stationery-olive',
] as const;

@Component({
  selector: 'db-color-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:flex;gap:4px;flex-wrap:wrap' },
  template: `
    @for (swatch of swatches; track swatch) {
      <button
        type="button"
        class="db-swatch"
        [attr.data-on]="value() === swatch"
        [style.background]="'var(' + swatch + ')'"
        [attr.aria-label]="swatch"
        [title]="swatch"
        (click)="value.set(swatch)"
      ></button>
    }
  `,
})
export class DbColorPicker {
  /** Selected custom-property name; two-way bindable. */
  readonly value = model<string>('--stationery-yellow');

  /** Swatches offered by the compact picker. */
  protected readonly swatches = STICKY_SWATCHES;
}
