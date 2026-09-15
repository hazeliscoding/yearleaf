/**
 * Contextual inspector: renders the property groups matching the current
 * selection (sticky note, event, image, or generic object).
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import type { StationeryColor } from '@infinite-desk/domain';
import {
  DbColorPicker,
  DbInspectorGroup,
  DbInspectorPanel,
  DbInspectorRow,
  DbNumberField,
  DbSegmented,
  DbSlider,
  DbToggle,
} from '@infinite-desk/deskbound';

import { DeskActions } from '../state/desk-actions';
import { DeskStore } from '../state/desk-store';
import { SelectionStore } from '../state/selection-store';

@Component({
  selector: 'app-inspector',
  imports: [
    DbColorPicker,
    DbInspectorGroup,
    DbInspectorPanel,
    DbInspectorRow,
    DbNumberField,
    DbSegmented,
    DbSlider,
    DbToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block;height:100%', '(click)': '$event.stopPropagation()' },
  template: `
    <db-inspector-panel [panelTitle]="selection.inspectorTitle()" style="height:100%">
      @switch (kind()) {
        @case ('sticky') {
          <db-inspector-group label="Paper">
            <db-inspector-row label="Color">
              <db-color-picker [value]="stickyColorVar()" (valueChange)="recolorSticky($event)" />
            </db-inspector-row>
            <db-inspector-row label="Opacity">
              <db-slider [value]="100" unit="%" ariaLabel="Opacity" style="flex:1" />
            </db-inspector-row>
          </db-inspector-group>
          <db-inspector-group label="Geometry">
            <db-inspector-row label="Position">
              <db-number-field [value]="selectedX()" unit="x" ariaLabel="X position" style="width:74px" />
              <db-number-field [value]="selectedY()" unit="y" ariaLabel="Y position" style="width:74px" />
            </db-inspector-row>
            <db-inspector-row label="Rotation">
              <db-number-field [value]="selectedRotation()" unit="°" ariaLabel="Rotation" style="width:74px" />
            </db-inspector-row>
          </db-inspector-group>
          <db-inspector-group label="Behavior">
            <db-inspector-row label="Pinned"><db-toggle [checked]="true" label="" /></db-inspector-row>
            <db-inspector-row label="Locked"><db-toggle label="" /></db-inspector-row>
          </db-inspector-group>
        }
        @case ('event') {
          <db-inspector-group label="Event">
            <db-inspector-row label="Title">
              <input
                aria-label="Event title"
                style="flex:1;min-width:0;height:26px;border:1px solid var(--border);border-radius:var(--radius-subtle);background:var(--surface-raised);padding:0 8px;font:13px var(--font-ui);color:var(--ink-primary)"
                [value]="selection.eventTitle()"
                (input)="selection.eventTitle.set($any($event.target).value)"
              />
            </db-inspector-row>
            <db-inspector-row label="Time">
              <span style="font:13px var(--font-ui);color:var(--ink-primary);font-variant-numeric:tabular-nums">{{
                selection.eventTime()
              }}</span>
            </db-inspector-row>
            <db-inspector-row label="Color">
              <db-color-picker [value]="selection.eventColor()" />
            </db-inspector-row>
          </db-inspector-group>
          <db-inspector-group label="Schedule">
            <db-inspector-row label="Repeats"><db-toggle [checked]="true" label="" /></db-inspector-row>
            <db-inspector-row label="Reminder"><db-toggle [checked]="true" label="" /></db-inspector-row>
            <db-inspector-row label="Calendar">
              <db-segmented [options]="['Work', 'Personal']" value="Work" />
            </db-inspector-row>
          </db-inspector-group>
        }
        @case ('image') {
          <db-inspector-group label="Image">
            <db-inspector-row label="Frame">
              <db-segmented [options]="['Plain', 'Framed', 'Taped']" value="Taped" />
            </db-inspector-row>
            <db-inspector-row label="Caption">
              <input
                aria-label="Caption"
                style="flex:1;min-width:0;height:26px;border:1px solid var(--border);border-radius:var(--radius-subtle);background:var(--surface-raised);padding:0 8px;font:13px var(--font-ui);color:var(--ink-primary)"
                [value]="imageCaption()"
                (change)="recaptionImage($any($event.target).value)"
              />
            </db-inspector-row>
          </db-inspector-group>
        }
        @default {
          <db-inspector-group label="Object">
            <db-inspector-row label="Locked"><db-toggle label="" /></db-inspector-row>
            <db-inspector-row label="Pinned"><db-toggle [checked]="true" label="" /></db-inspector-row>
          </db-inspector-group>
        }
      }
    </db-inspector-panel>
  `,
})
export class Inspector {
  protected readonly selection = inject(SelectionStore);
  private readonly desk = inject(DeskStore);
  private readonly actions = inject(DeskActions);

  /** Selection kind driving the rendered groups. */
  protected readonly kind = computed(() => this.selection.selection()?.kind ?? null);

  /** The selected desk object, when the selection refers to one. */
  private readonly selectedFloat = computed(() => {
    const sel = this.selection.selection();
    return sel ? this.desk.floats().find((f) => f.id === sel.id) : undefined;
  });

  protected readonly selectedX = computed(() => Math.round(this.selectedFloat()?.x ?? 0));
  protected readonly selectedY = computed(() => Math.round(this.selectedFloat()?.y ?? 0));
  protected readonly selectedRotation = computed(() => this.selectedFloat()?.rotation ?? 0);

  /** The selected sticky's color as a CSS custom-property name. */
  protected readonly stickyColorVar = computed(() => {
    const payload = this.selectedFloat()?.payload;
    return payload?.kind === 'sticky' ? `--stationery-${payload.color}` : '--stationery-yellow';
  });

  /** Current caption of the selected image. */
  protected readonly imageCaption = computed(() => {
    const payload = this.selectedFloat()?.payload;
    return payload?.kind === 'image' ? payload.caption : '';
  });

  /** Applies a swatch pick to the selected sticky as an undoable command. */
  protected recolorSticky(cssVar: string): void {
    const id = this.selection.selection()?.id;
    if (!id) return;
    this.actions.setStickyColor(id, cssVar.replace('--stationery-', '') as StationeryColor);
  }

  /** Applies a caption edit to the selected image as an undoable command. */
  protected recaptionImage(caption: string): void {
    const id = this.selection.selection()?.id;
    if (id) this.actions.setImageCaption(id, caption);
  }
}
