/**
 * Inspector chrome: `<db-inspector-panel>` (right-hand contextual panel),
 * `<db-inspector-group>` (collapsible section), and `<db-inspector-row>`
 * (label + control grid row).
 */

import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { DbIcon } from '../core/icon';

@Component({
  selector: 'db-inspector-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-inspector', style: 'display:block' },
  template: `
    @if (panelTitle(); as title) {
      <div style="padding:10px 12px;font:var(--text-subheading);border-bottom:1px solid var(--divider)">
        {{ title }}
      </div>
    }
    <ng-content />
  `,
})
export class DbInspectorPanel {
  /** Heading naming the inspected object kind, e.g. `"Sticky note"`. */
  readonly panelTitle = input<string | null>(null);
}

@Component({
  selector: 'db-inspector-group',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-igroup', style: 'display:block' },
  template: `
    <div class="db-igroup-head" role="button" [attr.aria-expanded]="open()" (click)="open.set(!open())">
      <db-icon [name]="open() ? 'chevron-down' : 'chevron-right'" [size]="12" />
      <span>{{ label() }}</span>
    </div>
    @if (open()) {
      <div class="db-igroup-body"><ng-content /></div>
    }
  `,
})
export class DbInspectorGroup {
  /** Section label, e.g. `"Geometry"`. */
  readonly label = input.required<string>();

  /** Expanded state; groups start open. */
  protected readonly open = signal(true);
}

@Component({
  selector: 'db-inspector-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-irow' },
  template: `
    <label>{{ label() }}</label>
    <div style="display:flex;gap:6px;align-items:center;min-width:0">
      <ng-content />
    </div>
  `,
})
export class DbInspectorRow {
  /** Row label shown in the left column. */
  readonly label = input.required<string>();
}
