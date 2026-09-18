/**
 * Left tool rail: tool groups with dividers, plus undo/redo at the bottom.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DbToolButton } from '@infinite-desk/deskbound';

import { HistoryStore } from '../state/history-store';
import { TOOL_GROUPS, ToolStore } from '../state/tool-store';

@Component({
  selector: 'app-tool-rail',
  imports: [DbToolButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'toolbar',
    'aria-label': 'Tools',
    style:
      'display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;background:var(--surface-toolbar);border-right:1px solid var(--border)',
  },
  template: `
    @for (group of groups; track $index; let last = $last) {
      @for (tool of group; track tool.label) {
        <db-tool-button
          [icon]="tool.icon"
          [label]="tool.unavailable ? tool.label + ' — not available yet' : tool.label"
          [shortcut]="tool.shortcut ?? null"
          [active]="tools.active() === tool.label"
          [disabled]="!!tool.unavailable"
          (pressed)="tools.activate(tool.label)"
        />
      }
      @if (!last) {
        <span style="width:60%;height:1px;background:var(--border);margin:4px 0"></span>
      }
    }
    <span style="flex:1"></span>
    <db-tool-button
      icon="undo-2"
      label="Undo"
      shortcut="Mod+Z"
      [disabled]="!history.canUndo()"
      (pressed)="history.undo()"
    />
    <db-tool-button
      icon="redo-2"
      label="Redo"
      [disabled]="!history.canRedo()"
      (pressed)="history.redo()"
    />
  `,
})
export class ToolRail {
  protected readonly tools = inject(ToolStore);
  protected readonly history = inject(HistoryStore);
  protected readonly groups = TOOL_GROUPS;
}
