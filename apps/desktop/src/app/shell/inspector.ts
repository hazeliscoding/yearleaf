/**
 * Contextual inspector: renders the property groups matching the current
 * selection (sticky note, event, or image), plus the geometry every desk
 * object has.
 *
 * Every control here writes through an action and reads back from the store.
 * A control with nothing behind it does not belong in this panel: one that
 * moves on click and changes nothing teaches people their edits are being
 * kept when they are not.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import {
  presetForRule,
  type ImagePayload,
  type RepeatPreset,
  type StationeryColor,
} from '@infinite-desk/domain';
import {
  DbColorPicker,
  DbInspectorGroup,
  DbInspectorPanel,
  DbInspectorRow,
  DbNumberField,
  DbToggle,
} from '@infinite-desk/deskbound';

import { DeskActions } from '../state/desk-actions';
import { DeskStore } from '../state/desk-store';
import { EventActions } from '../state/event-actions';
import { EventStore } from '../state/event-store';
import { SelectionStore } from '../state/selection-store';

/**
 * Frame treatments, paired with the label the segmented control shows.
 *
 * Neither direction can be derived by changing case: "Plain" is stored as
 * `borderless`, so a round trip through the control would otherwise write
 * `plain`, which matches nothing in the renderer and draws no frame at all.
 */
const FRAME_LABELS: Readonly<Record<ImagePayload['frame'], string>> = {
  borderless: 'Plain',
  framed: 'Framed',
  taped: 'Taped',
};

/** The reverse mapping, from what the control shows to what is stored. */
const FRAME_VALUES: Readonly<Record<string, ImagePayload['frame']>> = {
  Plain: 'borderless',
  Framed: 'framed',
  Taped: 'taped',
};

@Component({
  selector: 'app-inspector',
  imports: [
    DbColorPicker,
    DbInspectorGroup,
    DbInspectorPanel,
    DbInspectorRow,
    DbNumberField,
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
            <!-- These two are why deleting the old Pinned toggle was only half
                 a fix: the sticky payload has carried a pin flag and a
                 handwriting flag all along, and the renderer draws both. The
                 toggle was not a control with nothing behind it — it was a
                 control wired to nothing despite having something behind it. -->
            <db-inspector-row label="Pinned">
              <db-toggle
                label=""
                ariaLabel="Pinned"
                [checked]="stickyPinned()"
                (checkedChange)="pinSticky($event)"
              />
            </db-inspector-row>
            <db-inspector-row label="Handwritten">
              <db-toggle
                label=""
                ariaLabel="Handwritten"
                [checked]="stickyHand()"
                (checkedChange)="handwriteSticky($event)"
              />
            </db-inspector-row>
          </db-inspector-group>
        }
        @case ('event') {
          <db-inspector-group label="Event">
            <db-inspector-row label="Title">
              <input
                aria-label="Event title"
                class="db-input"
                style="flex:1;min-width:0"
                [value]="eventTitle()"
                (change)="renameEvent($any($event.target).value)"
              />
            </db-inspector-row>
            <db-inspector-row label="All day">
              <!-- An affirmative way back. Emptying the time field does the
                   same thing, but nothing about an empty box says so, and a
                   state with no control is what this panel set out to stop
                   shipping. -->
              <db-toggle
                label=""
                ariaLabel="All day"
                [checked]="!eventTime()"
                (checkedChange)="setAllDay($event)"
              />
            </db-inspector-row>
            @if (eventTime()) {
              <db-inspector-row label="Time">
                <!-- The placeholder holds the format, which is what a
                     placeholder is for. The all-day state is reported by the
                     switch above instead: as ghost text it was indistinguishable
                     from a real value, and the user could not tell whether the
                     event stored the literal words. -->
                <input
                  aria-label="Event time"
                  class="db-input db-numeral"
                  placeholder="e.g. 14:00"
                  style="flex:1;min-width:0"
                  [value]="eventTime()"
                  (change)="retimeEvent($any($event.target))"
                />
              </db-inspector-row>
            }
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
            <div class="db-help" style="padding:0 12px 10px">
              This event repeats — changes here apply to every occurrence.
              Double-click one on the calendar to change only that date.
            </div>
          }
          @if (isOverride()) {
            <div class="db-help" style="padding:0 12px 10px">
              This is one date of a repeating event; changes here affect only it.
            </div>
          }
        }
        @case ('image') {
          <db-inspector-group label="Image">
            <db-inspector-row label="Frame">
              <!-- A dropdown for the same reason the Repeats row is one: three
                   segments measure 164px in a 143px cell, so the last of them —
                   Taped, the default every dropped picture lands on — was cut
                   off the edge of the panel and the window behind it. -->
              <div class="db-select" style="flex:1;min-width:0">
                <select
                  aria-label="Frame"
                  style="width:100%"
                  [value]="imageFrame()"
                  (change)="reframeImage($any($event.target).value)"
                >
                  @for (option of frameOptions; track option) {
                    <option [value]="option" [selected]="option === imageFrame()">
                      {{ option }}
                    </option>
                  }
                </select>
              </div>
            </db-inspector-row>
            <db-inspector-row label="Caption">
              <input
                aria-label="Caption"
                class="db-input"
                style="flex:1;min-width:0"
                [value]="imageCaption()"
                (change)="recaptionImage($any($event.target).value)"
              />
            </db-inspector-row>
          </db-inspector-group>
        }
        @case ('file') {
          <!-- Facts the chip already carries, reported rather than invented.
               A read-only row is honest where a control would not be: nothing
               in the app can change a file's name or size yet. -->
          <db-inspector-group label="File">
            <db-inspector-row label="Name">
              <span class="db-ivalue" [title]="fileName()">{{ fileName() }}</span>
            </db-inspector-row>
            <db-inspector-row label="Size">
              <span class="db-ivalue">{{ fileMeta() }}</span>
            </db-inspector-row>
          </db-inspector-group>
        }
        @case ('text') {
          <!-- Full width rather than an inspector row: a sentence squeezed into
               the row's 143px value column truncated after about half of it, so
               the panel reported less of the writing than the desk did. -->
          <db-inspector-group label="Text">
            <span class="db-ivalue db-ivalue--prose">{{ textContent() }}</span>
          </db-inspector-group>
          <div class="db-help" style="padding:0 12px 10px">
            Double-click the text on the desk to rewrite it.
          </div>
        }
      }
      <!-- Every desk object has a place and an angle, whatever its kind. An
           event does not: its position comes from the date it sits on. -->
      @if (hasGeometry()) {
        <db-inspector-group label="Geometry">
          <!-- A row each, and no unit glyph. Two fields declared at 74px were
               squeezed to 68px by the 143px value column while Rotation kept
               its 74, and a desk object's Y runs to five digits on a calendar
               that strides 1680 units a month — so the value drew straight
               through the "y" marker. The row's own label says which axis it
               is; the glyph only repeated it. -->
          <db-inspector-row label="X">
            <db-number-field
              [value]="selectedX()"
              [step]="NUDGE"
              ariaLabel="X position"
              style="flex:1;min-width:0"
              (valueChange)="moveSelected('x', $event)"
            />
          </db-inspector-row>
          <db-inspector-row label="Y">
            <db-number-field
              [value]="selectedY()"
              [step]="NUDGE"
              ariaLabel="Y position"
              style="flex:1;min-width:0"
              (valueChange)="moveSelected('y', $event)"
            />
          </db-inspector-row>
          <db-inspector-row label="Rotation">
            <db-number-field
              [value]="selectedRotation()"
              unit="°"
              ariaLabel="Rotation"
              style="flex:1;min-width:0"
              (valueChange)="rotateSelected($event)"
            />
          </db-inspector-row>
        </db-inspector-group>
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
  // Deliberately empty rather than "All day": the field writes whatever it
  // holds, so a readable fallback in the value is a time nobody asked for.
  protected readonly eventTime = computed(() => this.selectedEvent()?.timeLabel ?? '');
  protected readonly eventColor = computed(
    () => `--stationery-${this.selectedEvent()?.color ?? 'blue'}`,
  );

  /** Commits a title edit to the event behind the selected chip. */
  protected renameEvent(title: string): void {
    const event = this.selectedEvent();
    if (event) this.eventActions.setTitle(event.id, title);
  }

  /** Commits a time edit; emptying the field makes the event all-day again. */
  protected retimeEvent(field: HTMLInputElement): void {
    const event = this.selectedEvent();
    if (!event) return;
    this.eventActions.setTime(event.id, field.value);
    // Redraw from the store for the same reason the number field does: an
    // entry that was refused, or one that was accepted in a different shape
    // than it was typed, would otherwise sit in the box looking like the
    // event's time when it is not.
    field.value = this.eventTime();
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

  /** `true` while the selection is a desk object, which owns its geometry. */
  protected readonly hasGeometry = computed(() => !!this.selectedFloat());

  // Whole units, because these fields are read at a glance and written back
  // verbatim: a stepper press on an object set down at -1.3714° should leave
  // it at a round angle, not carry the stray decimals along for ever.
  protected readonly selectedX = computed(() => Math.round(this.selectedFloat()?.x ?? 0));
  protected readonly selectedY = computed(() => Math.round(this.selectedFloat()?.y ?? 0));
  protected readonly selectedRotation = computed(() =>
    Math.round(this.selectedFloat()?.rotation ?? 0),
  );

  /** Frame choices offered for an image, in the order they are shown. */
  protected readonly frameOptions = Object.values(FRAME_LABELS);

  /**
   * World units a stepper press moves an object, matching the arrow-key nudge.
   *
   * One unit is the field's default and is close to invisible: at the month
   * tier it works out under half a screen pixel, so the press costs an undo
   * entry and shows nothing.
   */
  protected readonly NUDGE = 16;

  /** `true` when the selected sticky shows its push-pin. */
  protected readonly stickyPinned = computed(() => {
    const payload = this.selectedFloat()?.payload;
    return payload?.kind === 'sticky' && !!payload.pinned;
  });

  /** `true` when the selected sticky is written in the handwriting face. */
  protected readonly stickyHand = computed(() => {
    const payload = this.selectedFloat()?.payload;
    return payload?.kind === 'sticky' && !!payload.hand;
  });

  /** Shows or removes the selected sticky's push-pin. */
  protected pinSticky(pinned: boolean): void {
    const id = this.selection.selection()?.id;
    if (id) this.actions.setStickyPinned(id, pinned);
  }

  /** Switches the selected sticky between the handwriting and the plain face. */
  protected handwriteSticky(hand: boolean): void {
    const id = this.selection.selection()?.id;
    if (id) this.actions.setStickyHand(id, hand);
  }

  /** Clearing the time is what makes an event all-day; this says so out loud. */
  protected setAllDay(allDay: boolean): void {
    const event = this.selectedEvent();
    if (!event) return;
    // Turning the switch off has to put something in the field, or the event
    // would still be all-day and the switch would spring back on.
    this.eventActions.setTime(event.id, allDay ? '' : '09:00');
  }

  /** Name of the selected file chip, as imported. */
  protected readonly fileName = computed(() => {
    const payload = this.selectedFloat()?.payload;
    return payload?.kind === 'file' ? payload.name : '';
  });

  /** The file chip's secondary line, which is its formatted size. */
  protected readonly fileMeta = computed(() => {
    const payload = this.selectedFloat()?.payload;
    return payload?.kind === 'file' ? payload.meta : '';
  });

  /** The selected text object's words, for the panel to report. */
  protected readonly textContent = computed(() => {
    const payload = this.selectedFloat()?.payload;
    return payload?.kind === 'text' ? payload.text : '';
  });

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

  /** The selected image's frame, as the label the segmented control shows. */
  protected readonly imageFrame = computed(() => {
    const payload = this.selectedFloat()?.payload;
    return payload?.kind === 'image' ? FRAME_LABELS[payload.frame] : '';
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

  /** Applies a frame pick to the selected image as an undoable command. */
  protected reframeImage(label: string): void {
    const id = this.selection.selection()?.id;
    const frame = FRAME_VALUES[label];
    if (id && frame) this.actions.setImageFrame(id, frame);
  }

  /**
   * Moves the selected object along one axis.
   *
   * The other axis comes from the object itself rather than from its field, so
   * editing X cannot quietly round a fractional Y on the way past.
   */
  protected moveSelected(axis: 'x' | 'y', value: number): void {
    const object = this.selectedFloat();
    if (!object) return;
    this.actions.setPosition(
      object.id,
      axis === 'x' ? value : object.x,
      axis === 'y' ? value : object.y,
    );
  }

  /** Turns the selected object to the angle typed into the rotation field. */
  protected rotateSelected(degrees: number): void {
    const id = this.selection.selection()?.id;
    if (id) this.actions.setRotation(id, degrees);
  }
}
