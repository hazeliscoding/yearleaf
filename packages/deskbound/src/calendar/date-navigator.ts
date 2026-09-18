/**
 * `<db-date-navigator>` — toolbar widget showing the current position in
 * time (label + zoom tier) with a "Jump to date" affordance.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DbIcon } from '../core/icon';
import { DbKbd } from '../core/kbd';
import { MOD } from '../core/platform';

@Component({
  selector: 'db-date-navigator',
  imports: [DbIcon, DbKbd],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    'aria-label': 'Calendar position',
    style:
      // The arrows sit tight against the label they move, and the tier caption
      // is pushed away from them: at an even rhythm the forward arrow read as
      // equidistant between the thing it controls and a caption it does not.
      'display:inline-flex;align-items:center;gap:2px;padding:4px 6px 4px 10px;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-standard);box-shadow:var(--shadow-1);font:var(--text-body-small)',
  },
  template: `
    <db-icon name="calendar" [size]="13" style="margin-right:6px" />
    <!-- Either side of the label, because they move what it names: a month
         when it reads "September 2026", a year when it reads "2026". The
         calendar runs three months across, so scrolling is not a substitute —
         dragging downward from September arrives at December. -->
    <button
      class="db-nav-step"
      type="button"
      [attr.aria-label]="'Previous ' + unit()"
      [title]="'Previous ' + unit() + ' (Page Up)'"
      (click)="previous.emit()"
    >
      <db-icon name="chevron-left" [size]="14" />
    </button>
    <!-- Announced, because stepping changes nothing else a screen reader can
         hear: the button keeps its own name and the view it moves is a canvas. -->
    <span
      aria-live="polite"
      style="font:500 13px var(--font-calendar);min-width:106px;text-align:center"
      >{{ label() }}</span
    >
    <button
      class="db-nav-step"
      type="button"
      [attr.aria-label]="'Next ' + unit()"
      [title]="'Next ' + unit() + ' (Page Down)'"
      (click)="next.emit()"
    >
      <db-icon name="chevron-right" [size]="14" />
    </button>
    <!-- No tier caption here: the Day/Week/Month/Year control sits 60px away
         and already says it, and repeating it beside arrows whose unit it no
         longer governs made it read as a rule it does not state. -->
    <button class="db-btn db-btn--sm db-btn--subtle" style="margin-left:10px" (click)="jump.emit()">
      Jump to date&nbsp;<db-kbd [keys]="jumpKeys" />
    </button>
  `,
})
export class DbDateNavigator {
  /** Palette shortcut, printed with whichever modifier this platform has. */
  protected readonly jumpKeys = [MOD, 'K'];

  /** Position label, e.g. `"September 2026"`. */
  readonly label = input.required<string>();
  /** What one step moves, named in the arrows' accessible labels. */
  readonly unit = input<'month' | 'year'>('month');
  /** Emits when "Jump to date" is clicked. */
  readonly jump = output<void>();
  /** Emits when the back arrow is used. */
  readonly previous = output<void>();
  /** Emits when the forward arrow is used. */
  readonly next = output<void>();
}
