/**
 * `<db-segmented>` — segmented radio-group control.
 */

import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

@Component({
  selector: 'db-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-seg', role: 'radiogroup', '[attr.aria-label]': 'ariaLabel()' },
  template: `
    @for (option of options(); track option; let i = $index) {
      <button
        type="button"
        role="radio"
        [attr.data-on]="value() === option"
        [attr.aria-checked]="value() === option"
        [attr.tabindex]="value() === option || (i === 0 && !isSelected()) ? 0 : -1"
        (click)="value.set(option)"
        (keydown)="onKey($event, i)"
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
  /**
   * Accessible name for the group.
   *
   * Each button names itself from its own label, so without this a screen
   * reader announces the choices but never what is being chosen.
   */
  readonly ariaLabel = input<string | null>(null);

  /** Whether the current value is one of the offered options. */
  protected readonly isSelected = computed(() => this.options().includes(this.value()));

  /**
   * Moves the selection with the arrow keys, wrapping at the ends.
   *
   * A radiogroup is expected to be one tab stop whose arrows change the choice,
   * not a row of separate stops. Declaring the role without this leaves the
   * control announced as a radiogroup and operable only by mouse.
   */
  protected onKey(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 :
      event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const options = this.options();
    const next = (index + step + options.length) % options.length;
    this.value.set(options[next]);
    const buttons = (event.currentTarget as HTMLElement).parentElement?.children;
    (buttons?.[next] as HTMLElement | undefined)?.focus();
  }
}
