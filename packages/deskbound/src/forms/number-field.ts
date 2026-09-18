/**
 * `<db-number-field>` — numeric input with unit suffix and stepper buttons.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'db-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-numfield', '[attr.data-unit]': 'unit() ? "" : null' },
  template: `
    <input
      #field
      inputmode="numeric"
      [value]="value()"
      [attr.aria-label]="ariaLabel()"
      (change)="commit($any($event.target).value)"
    />
    @if (unit(); as suffix) {
      <span class="db-num-unit">{{ suffix }}</span>
    }
    <span class="db-num-steps">
      <!-- Named from the field, or a panel with three of these offers six
           buttons called "Increase" and "Decrease" with nothing to tell a
           screen reader which value each one moves. -->
      <button type="button" [attr.aria-label]="'Increase ' + ariaLabel()" (click)="stepBy(1)">
        ▲
      </button>
      <button type="button" [attr.aria-label]="'Decrease ' + ariaLabel()" (click)="stepBy(-1)">
        ▼
      </button>
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

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /**
   * Commits typed input, and always redraws the box from the model afterwards.
   *
   * A blank field is a correction in progress, not a request for zero — and
   * `Number('')` is `0`, so accepting anything finite would send an object to
   * the origin the moment someone cleared the box to retype it. Rejecting alone
   * is not enough either: the model would not change, so nothing would prompt
   * Angular to rewrite the input, and the field would sit there showing a
   * number the object does not have. Redrawing unconditionally also renders an
   * accepted value canonically rather than exactly as typed.
   */
  protected commit(raw: string): void {
    const trimmed = raw.trim();
    const parsed = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(parsed)) this.value.set(parsed);
    this.field().nativeElement.value = String(this.value());
  }

  /** Applies one stepper increment in the given direction. */
  protected stepBy(direction: 1 | -1): void {
    this.value.set(this.value() + direction * this.step());
  }
}
