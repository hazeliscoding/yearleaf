/**
 * `<db-task-object>` — checklist task chip with due hint and priority dot.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Priority-dot colors from the design system. */
const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--danger)',
  med: 'var(--warning)',
  low: 'var(--info)',
};

@Component({
  selector: 'db-task-object',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-task', '[attr.data-done]': 'done()' },
  template: `
    <span class="db-check" style="gap:0">
      <input
        type="checkbox"
        [checked]="done()"
        [attr.aria-label]="label()"
        (change)="toggled.emit()"
      />
    </span>
    <span class="db-task-label">{{ label() }}</span>
    @if (due(); as hint) {
      <span class="db-task-due">{{ hint }}</span>
    }
    @if (priority(); as level) {
      <span class="db-task-pri" [style.background]="priorityColor()" [title]="level + ' priority'"></span>
    }
  `,
})
export class DbTaskObject {
  /** Task text. */
  readonly label = input.required<string>();
  /** Completion state. */
  readonly done = input(false);
  /** Free-text due hint, e.g. `"by 5pm"`. */
  readonly due = input<string | null>(null);
  /** Priority level driving the colored dot. */
  readonly priority = input<'high' | 'med' | 'low' | null>(null);
  /** Emits when the checkbox is toggled. */
  readonly toggled = output<void>();

  /** Resolved dot color for the current priority. */
  protected readonly priorityColor = computed(
    () => PRIORITY_COLOR[this.priority() ?? 'med'] ?? PRIORITY_COLOR['med'],
  );
}
