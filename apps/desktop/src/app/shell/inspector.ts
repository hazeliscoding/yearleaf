/**
 * Contextual inspector: renders the property groups matching the current
 * selection (sticky note, event, image, or generic object).
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { presetForRule, type RepeatPreset, type StationeryColor } from '@infinite-desk/domain';
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
import { EventActions } from '../state/event-actions';
import { EventStore } from '../state/event-store';
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
                [value]="eventTitle()"
                (change)="renameEvent($any($event.target).value)"
              />
            </db-inspector-row>
            <db-inspector-row label="Time">
              <span style="font:13px var(--font-ui);color:var(--ink-primary);font-variant-numeric:tabular-nums">{{
                eventTime()
              }}</span>
            </db-inspector-row>
            <db-inspector-row label="Color">
              <db-color-picker [value]="eventColor()" (valueChange)="recolorEvent($event)" />
            </db-inspector-row>
          </db-inspector-group>
          @if (!isOverride()) {
          <db-inspector-group label="Schedule">
            <db-inspector-row label="Repeats">
              <!-- A dropdown rather than a segmented control: five options do
                   not fit the inspector's width, and the last two would sit
                   off the edge of the panel. -->
              <div class="db-select" style="flex:1;min-width:0">
                <select
                  aria-label="Repeats"
                  style="width:100%"
                  [value]="repeatValue()"
                  (change)="setRepeat($any($event.target).value)"
                >
                  @for (option of repeatOptions(); track option) {
                    <option [value]="option" [selected]="option === repeatValue()">{{ option }}</option>
                  }
                </select>
              </div>
            </db-inspector-row>
          </db-inspector-group>
          }
          @if (editsWholeSeries()) {
            <div
              style="padding:8px 12px;font:var(--text-caption);color:var(--ink-secondary);border-bottom:1px solid var(--divider)"
            >
              This event repeats — changes here apply to every occurrence.
              Double-click one on the calendar to change only that date.
            </div>
          }
          @if (isOverride()) {
            <div
              style="padding:8px 12px;font:var(--text-caption);color:var(--ink-secondary);border-bottom:1px solid var(--divider)"
            >
              This is one date of a repeating event; changes here affect only it.
            </div>
          }
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
  private readonly eventActions = inject(EventActions);
  private readonly events = inject(EventStore);

  /**
   * Repeat choices offered for an event, plainly worded. A rule richer than
   * the presets gains a "Custom" entry so the control can show what is in
   * force instead of appearing to be set to nothing.
   */
  protected readonly repeatOptions = computed(() => {
    const base = ['Never', 'Daily', 'Weekly', 'Monthly', 'Yearly'];
    return this.repeatValue() === 'Custom' ? [...base, 'Custom'] : base;
  });

  /**
   * The event behind the selected chip, read live from the store.
   *
   * The selection holds the occurrence as it was when clicked; reading the
   * event out of that snapshot would leave the panel showing stale values the
   * moment one of its own controls changed something.
   */
  private readonly selectedEvent = computed(() => {
    const id = this.selection.occurrence()?.event.id;
    return id ? this.events.get(id) : undefined;
  });

  /** The repeat preset currently in force, as a segmented value. */
  protected readonly repeatValue = computed(() => {
    const event = this.selectedEvent();
    if (!event) return 'Never';
    const preset = presetForRule(event.rrule, event.date);
    if (preset) return preset[0].toUpperCase() + preset.slice(1);
    // A richer rule than the presets describe must not be shown as one of
    // them, or picking a preset would silently simplify it.
    return event.rrule ? 'Custom' : 'Never';
  });

  /** `true` when the selection belongs to a series, so edits reach them all. */
  protected readonly editsWholeSeries = computed(() => !!this.selectedEvent()?.rrule);

  /** `true` when the selection is one materialised date of a series. */
  protected readonly isOverride = computed(() => !!this.selectedEvent()?.seriesId);

  // Read straight off the store so the panel cannot drift from the desk — it
  // previously mirrored these into signals, which then survived an undo.
  protected readonly eventTitle = computed(() => this.selectedEvent()?.title ?? '');
  protected readonly eventTime = computed(() => this.selectedEvent()?.timeLabel ?? 'All day');
  protected readonly eventColor = computed(
    () => `--stationery-${this.selectedEvent()?.color ?? 'blue'}`,
  );

  /** Commits a title edit to the event behind the selected chip. */
  protected renameEvent(title: string): void {
    const event = this.selectedEvent();
    if (event) this.eventActions.setTitle(event.id, title);
  }

  /** Recolours the event behind the selected chip. */
  protected recolorEvent(cssVar: string): void {
    const event = this.selectedEvent();
    if (!event) return;
    this.eventActions.setColor(
      event.id,
      cssVar.replace('--stationery-', '') as StationeryColor,
    );
  }

  /** Applies a repeat choice, or stops the event repeating. */
  protected setRepeat(choice: string): void {
    const event = this.selectedEvent();
    if (!event || choice === 'Custom') return;
    this.eventActions.setRepeat(
      event.id,
      choice === 'Never' ? null : (choice.toLowerCase() as RepeatPreset),
    );
  }

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
