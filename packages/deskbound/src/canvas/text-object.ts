/**
 * `<db-text-object>` — freeform text written directly on the canvas, with
 * hover/selected/editing/locked chrome states.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Interaction states rendered by the text object chrome. */
export type DbTextObjectState = 'idle' | 'hover' | 'selected' | 'editing' | 'locked';

@Component({
  selector: 'db-text-object',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'db-textobj',
    '[class.db-textobj--hand]': 'hand()',
    '[attr.data-state]': 'state()',
  },
  template: '<ng-content />',
})
export class DbTextObject {
  /** Current interaction state. */
  readonly state = input<DbTextObjectState>('idle');
  /** Render in the handwriting typeface. */
  readonly hand = input(false);
}
