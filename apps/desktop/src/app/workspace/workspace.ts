/**
 * The spatial workspace: an infinite pannable/zoomable canvas hosting the
 * tier sheets (year/month/week/day) and freely positioned desk objects.
 *
 * Gesture rules follow the architecture guardrails: pointer movement only
 * updates transient state; a finished drag commits exactly one command.
 *
 * Rendering note: this milestone renders the workspace with DOM elements,
 * mirroring the design reference. The PixiJS scene replaces this component's
 * internals in a later milestone (see ROADMAP.md); the viewport math it uses
 * already lives in `@infinite-desk/canvas`.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { screenToWorld, type Point } from '@infinite-desk/canvas';
import type { DeskObject, EventItem } from '@infinite-desk/domain';
import {
  DbFileAttachment,
  DbImageObject,
  DbLayerPanel,
  DbSelectionBox,
  DbStickyNote,
  DbTextObject,
  DbZoomControl,
} from '@infinite-desk/deskbound';

import { DeskActions } from '../state/desk-actions';
import { DeskStore } from '../state/desk-store';
import { SelectionStore, type SelectionKind } from '../state/selection-store';
import { ToolStore } from '../state/tool-store';
import { ViewportStore } from '../state/viewport-store';
import { DayPage } from './day-page';
import { MonthSheet, type EventPick } from './month-sheet';
import { WeekSheet } from './week-sheet';
import { YearPlanner } from './year-planner';

/** Transient state of an active object drag. */
interface DragState {
  readonly id: string;
  /** Pointer offset from the object origin, in world units. */
  readonly dx: number;
  readonly dy: number;
  /** Object origin when the gesture started (for the move command). */
  readonly fromX: number;
  readonly fromY: number;
}

/** Transient state of an active pan gesture. */
interface PanState {
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startPanX: number;
  readonly startPanY: number;
}

@Component({
  selector: 'app-workspace',
  imports: [
    DayPage,
    DbFileAttachment,
    DbImageObject,
    DbLayerPanel,
    DbSelectionBox,
    DbStickyNote,
    DbTextObject,
    DbZoomControl,
    MonthSheet,
    WeekSheet,
    YearPlanner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Canvas',
    style: 'position:relative;overflow:hidden;background:var(--surface-canvas);display:block',
    '[style.cursor]': 'tools.canvasCursor()',
    '(pointerdown)': 'onCanvasPointerDown($event)',
    '(dblclick)': 'onCanvasDoubleClick($event)',
    '(wheel)': 'onWheel($event)',
    '(document:pointermove)': 'onPointerMove($event)',
    '(document:pointerup)': 'onPointerUp()',
  },
  template: `
    <div
      style="position:absolute;left:0;top:0;width:1600px;height:1100px;transform-origin:0 0"
      [style.transform]="viewport.worldTransform()"
      [style.transition]="viewport.animate() ? 'transform .3s var(--ease-out)' : 'none'"
    >
      <div
        style="position:absolute;inset:-1000px;background-image:linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px);background-size:28px 28px;pointer-events:none"
      ></div>
      @switch (viewport.tier()) {
        @case ('Month') {
          <div style="animation:tierIn .28s var(--ease-out)">
            <app-month-sheet (eventPicked)="onEventPicked($event)" />
            @for (float of desk.floats(); track float.id) {
              <div
                style="position:absolute;cursor:grab"
                [style.left.px]="floatX(float)"
                [style.top.px]="floatY(float)"
                [style.transform]="'rotate(' + float.rotation + 'deg)'"
                (pointerdown)="onFloatPointerDown(float, $event)"
                (click)="onFloatClick(float, $event)"
              >
                @switch (float.payload.kind) {
                  @case ('sticky') {
                    <db-selection-box
                      [selected]="isSelected(float.id)"
                      [dragging]="drag()?.id === float.id"
                      [rotatable]="true"
                    >
                      <db-sticky-note
                        [color]="float.payload.color"
                        [hand]="!!float.payload.hand"
                        [pinned]="!!float.payload.pinned"
                        [variant]="float.payload.compact ? 'compact' : 'standard'"
                        [items]="float.payload.items ?? null"
                        >{{ float.payload.text }}</db-sticky-note
                      >
                    </db-selection-box>
                  }
                  @case ('image') {
                    <db-selection-box [selected]="isSelected(float.id)" [dragging]="drag()?.id === float.id">
                      <db-image-object [frame]="float.payload.frame" [caption]="float.payload.caption" />
                    </db-selection-box>
                  }
                  @case ('file') {
                    <db-selection-box [selected]="isSelected(float.id)" [dragging]="drag()?.id === float.id">
                      <db-file-attachment
                        [kind]="float.payload.fileKind"
                        [name]="float.payload.name"
                        [meta]="float.payload.meta"
                      />
                    </db-selection-box>
                  }
                  @case ('text') {
                    @if (float.payload.draft) {
                      <div
                        contenteditable="true"
                        style="font-family:var(--font-hand);font-size:20px;color:var(--ink-primary);min-width:120px;outline:1px dashed var(--selection);padding:2px 6px"
                        (blur)="onDraftBlur(float, $event)"
                        (pointerdown)="$event.stopPropagation()"
                      >
                        {{ float.payload.text }}
                      </div>
                    } @else {
                      <db-text-object
                        [state]="isSelected(float.id) ? 'selected' : 'idle'"
                        [hand]="true"
                        style="font-size:20px"
                        >{{ float.payload.text }}</db-text-object
                      >
                    }
                  }
                }
              </div>
            }
          </div>
        }
        @case ('Week') {
          <div style="animation:tierIn .28s var(--ease-out)"><app-week-sheet /></div>
        }
        @case ('Day') {
          <div style="animation:tierIn .28s var(--ease-out)"><app-day-page /></div>
        }
        @case ('Year') {
          <div style="animation:tierIn .28s var(--ease-out)">
            <app-year-planner (monthPicked)="viewport.fitTier('Month')" />
          </div>
        }
      }
    </div>
    <div style="position:absolute;left:20px;bottom:16px">
      <db-zoom-control
        [zoom]="viewport.zoomPercent()"
        (zoomIn)="viewport.zoomStep(0.1)"
        (zoomOut)="viewport.zoomStep(-0.1)"
        (fitMonth)="viewport.fitTier('Month')"
        (fitYear)="viewport.fitTier('Year')"
      />
    </div>
    @if (showLayers()) {
      <div style="position:absolute;right:16px;bottom:16px">
        <db-layer-panel [layers]="desk.layers()" (toggleLayer)="desk.toggleLayerVisibility($event)" />
      </div>
    }
  `,
})
export class Workspace {
  protected readonly viewport = inject(ViewportStore);
  protected readonly tools = inject(ToolStore);
  protected readonly desk = inject(DeskStore);
  protected readonly selection = inject(SelectionStore);
  private readonly actions = inject(DeskActions);
  private readonly host = inject(ElementRef).nativeElement as HTMLElement;

  /** Whether the floating layer panel is visible (hidden under overlays). */
  readonly showLayers = input(true);

  /** Active object drag, or `null`. */
  protected readonly drag = signal<DragState | null>(null);
  /** Transient dragged position (world units) while a drag is live. */
  private readonly dragPosition = signal<Point | null>(null);
  /** Active pan gesture, or `null`. */
  private pan: PanState | null = null;

  /** Selected float id, memoized for the template. */
  private readonly selectedId = computed(() => this.selection.selection()?.id ?? null);

  /** `true` when the given float is the current selection. */
  protected isSelected(id: string): boolean {
    return this.selectedId() === id;
  }

  /** Rendered X of a float, honoring the transient drag position. */
  protected floatX(float: DeskObject): number {
    const dragging = this.drag();
    return dragging?.id === float.id ? (this.dragPosition()?.x ?? float.x) : float.x;
  }

  /** Rendered Y of a float, honoring the transient drag position. */
  protected floatY(float: DeskObject): number {
    const dragging = this.drag();
    return dragging?.id === float.id ? (this.dragPosition()?.y ?? float.y) : float.y;
  }

  /** Converts a pointer event to world coordinates. */
  private toWorld(event: PointerEvent | MouseEvent): Point {
    const rect = this.host.getBoundingClientRect();
    return screenToWorld(this.viewport.viewport(), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  /** Starts panning from empty canvas, or anywhere with space/Pan tool. */
  protected onCanvasPointerDown(event: PointerEvent): void {
    const panAnywhere = this.tools.spaceHeld() || this.tools.active() === 'Pan';
    if (event.target === this.host || panAnywhere) {
      const { panX, panY } = this.viewport.viewport();
      this.pan = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: panX,
        startPanY: panY,
      };
      this.tools.panning.set(true);
      this.selection.clear();
    }
  }

  /** Double-click on empty canvas starts a new text object (Month tier). */
  protected onCanvasDoubleClick(event: MouseEvent): void {
    if (event.target !== this.host || this.viewport.tier() !== 'Month') return;
    const world = this.toWorld(event);
    this.actions.addDraftText(Math.round(world.x), Math.round(world.y));
  }

  /** Ctrl/⌘ + wheel zooms around the cursor; plain wheel pans. */
  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = this.host.getBoundingClientRect();
      this.viewport.zoomAt(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        1 - event.deltaY * 0.01,
      );
    } else {
      this.viewport.panByScreen(-event.deltaX, -event.deltaY);
    }
  }

  /** Begins a float drag; movement stays transient until pointer-up. */
  protected onFloatPointerDown(float: DeskObject, event: PointerEvent): void {
    if (this.tools.spaceHeld() || this.tools.active() === 'Pan') return;
    event.stopPropagation();
    const world = this.toWorld(event);
    this.drag.set({
      id: float.id,
      dx: world.x - float.x,
      dy: world.y - float.y,
      fromX: float.x,
      fromY: float.y,
    });
    this.dragPosition.set({ x: float.x, y: float.y });
  }

  /** Selects a float (click fires after pointer-up). */
  protected onFloatClick(float: DeskObject, event: Event): void {
    event.stopPropagation();
    this.selection.select(float.payload.kind as SelectionKind, float.id);
  }

  /** Advances the live drag or pan gesture. */
  protected onPointerMove(event: PointerEvent): void {
    const dragging = this.drag();
    if (dragging) {
      const world = this.toWorld(event);
      this.dragPosition.set({
        x: Math.round(world.x - dragging.dx),
        y: Math.round(world.y - dragging.dy),
      });
    } else if (this.pan) {
      this.viewport.panTo(
        this.pan.startPanX + (event.clientX - this.pan.startClientX),
        this.pan.startPanY + (event.clientY - this.pan.startClientY),
      );
    }
  }

  /** Ends the gesture; a real drag commits exactly one move command. */
  protected onPointerUp(): void {
    const dragging = this.drag();
    const position = this.dragPosition();
    if (dragging && position) {
      this.actions.commitMove(
        dragging.id,
        { x: dragging.fromX, y: dragging.fromY },
        { x: position.x, y: position.y },
      );
    }
    this.drag.set(null);
    this.dragPosition.set(null);
    this.pan = null;
    if (this.tools.panning()) this.tools.panning.set(false);
  }

  /** A clicked calendar event becomes the inspected selection. */
  protected onEventPicked(pick: EventPick): void {
    this.selection.select('event', `${pick.day}-${pick.event.title}`);
    this.selection.eventTitle.set(pick.event.title);
    this.selection.eventTime.set(pick.event.time ?? 'All day');
    this.selection.eventColor.set(`--stationery-${pick.event.color}`);
  }

  /** Draft text loses focus → commit its content as one command. */
  protected onDraftBlur(float: DeskObject, event: FocusEvent): void {
    const text = (event.target as HTMLElement).textContent ?? '';
    this.actions.commitDraftText(float.id, text);
  }
}
