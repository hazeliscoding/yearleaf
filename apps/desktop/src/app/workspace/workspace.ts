/**
 * The spatial workspace: hosts the PixiJS scene from
 * `@infinite-desk/canvas` and owns every pointer gesture against it.
 *
 * Gesture rules follow the architecture guardrails: pointer movement only
 * updates transient scene state; a finished drag or resize commits exactly
 * one command. Text editing uses a DOM overlay positioned over the object
 * (the scene hides it meanwhile) per the hybrid editing decision.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import {
  CalendarSceneController,
  cellRectForDate,
  checklistItemAt,
  screenToWorld,
  type DayContent,
  type Point,
  type SceneHit,
  type WorldRect,
} from '@infinite-desk/canvas';
import { dateKey, type Occurrence } from '@infinite-desk/domain';
import { DbLayerPanel, DbZoomControl } from '@infinite-desk/deskbound';

import { sampleDayContent } from '../data/sample-desk';
import { DeskActions } from '../state/desk-actions';
import { DeskStore } from '../state/desk-store';
import { EventStore } from '../state/event-store';
import { SelectionStore } from '../state/selection-store';
import { ToolStore } from '../state/tool-store';
import { ViewportStore } from '../state/viewport-store';

/** Transient state of an active object drag. */
interface DragState {
  readonly id: string;
  /** Pointer offset from the object origin, in world units. */
  readonly dx: number;
  readonly dy: number;
  readonly from: { x: number; y: number };
}

/** Transient state of an active resize gesture (southeast handle). */
interface ResizeState {
  readonly id: string;
  readonly from: { width: number; height: number };
  /** World position of the pointer when the gesture started. */
  readonly startWorld: Point;
}

/** Object kinds whose southeast handle resizes them. */
const RESIZABLE = new Set(['sticky', 'image', 'text']);
/** Screen-pixel radius around the southeast handle that starts a resize. */
const HANDLE_RADIUS = 16;

@Component({
  selector: 'app-workspace',
  imports: [DbLayerPanel, DbZoomControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Canvas',
    '[attr.data-scene-ready]': 'sceneReady()',
    style: 'position:relative;overflow:hidden;background:var(--surface-canvas);display:block',
    '[style.cursor]': 'tools.canvasCursor()',
    '(pointerdown)': 'onPointerDown($event)',
    '(dblclick)': 'onDoubleClick($event)',
    '(wheel)': 'onWheel($event)',
    '(document:pointermove)': 'onPointerMove($event)',
    '(document:pointerup)': 'onPointerUp()',
  },
  template: `
    <canvas
      #sceneCanvas
      style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
    ></canvas>
    @if (sceneFailed()) {
      <div
        style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:var(--text-body);color:var(--ink-muted)"
      >
        The canvas could not start — this environment has no WebGL support.
      </div>
    }
    @if (editor(); as edit) {
      <textarea
        #editArea
        autofocus
        aria-label="Edit text"
        [placeholder]="edit.placeholder"
        [value]="edit.text"
        (blur)="commitEditor($event)"
        (keydown.escape)="$any($event.target).blur(); $event.stopPropagation()"
        (pointerdown)="$event.stopPropagation()"
        [style.left.px]="edit.left"
        [style.top.px]="edit.top"
        [style.width.px]="edit.width"
        [style.height.px]="edit.height"
        [style.font-size.px]="edit.fontSize"
        [style.line-height.px]="edit.lineHeight"
        [style.padding.px]="edit.padding"
        [style.background]="edit.background"
        [style.color]="edit.color"
        [style.font-family]="edit.fontFamily"
        style="position:absolute;box-sizing:border-box;border:none;outline:1.5px dashed var(--selection);resize:none;overflow:hidden;border-radius:3px;z-index:var(--z-object-drag,100)"
      ></textarea>
    }
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
  protected readonly events = inject(EventStore);
  protected readonly selection = inject(SelectionStore);
  private readonly actions = inject(DeskActions);
  private readonly host = inject(ElementRef).nativeElement as HTMLElement;
  private readonly destroyRef = inject(DestroyRef);

  private readonly sceneCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('sceneCanvas');
  private readonly editArea = viewChild<ElementRef<HTMLTextAreaElement>>('editArea');

  /** Whether the floating layer panel is visible (hidden under overlays). */
  readonly showLayers = input(true);

  /** The scene controller; PixiJS never leaks past it. */
  private readonly scene = new CalendarSceneController();
  protected readonly sceneReady = signal(false);
  protected readonly sceneFailed = signal(false);

  /** Object id currently edited through the DOM overlay, if any. */
  protected readonly editingId = signal<string | null>(null);
  /**
   * World position of a text object being composed that does not exist yet.
   *
   * Writing on empty paper opens the editor over bare canvas and only creates
   * an object once the text is committed non-empty, so an abandoned
   * composition leaves nothing behind — an empty text object would be an
   * invisible scrap sitting on the desk.
   */
  private readonly pendingText = signal<Point | null>(null);
  /** Event whose title is being typed in the overlay, if any. */
  private readonly editingEventId = signal<string | null>(null);
  /** Select-all on focus (used for freshly created objects). */
  private selectAllOnFocus = false;

  private drag: DragState | null = null;
  private resizeGesture: ResizeState | null = null;
  private transientRect: WorldRect | null = null;
  private pan: { startClientX: number; startClientY: number; startPanX: number; startPanY: number } | null = null;

  /** Screen-space geometry and styling of the DOM text editor. */
  protected readonly editor = computed(() => {
    const eventId = this.editingEventId();
    if (eventId) {
      const event = this.events.get(eventId);
      if (!event) return null;
      const v = this.viewport.viewport();
      // Over the day's first chip row, in the chip's own type metrics.
      const cell = cellRectForDate(event.occurrenceDate ?? event.date);
      const inset = 10;
      return {
        text: event.title,
        placeholder: 'Event name',
        left: v.panX + (cell.x + inset) * v.zoom,
        top: v.panY + (cell.y + 44) * v.zoom,
        width: (cell.width - 2 * inset) * v.zoom,
        height: 36 * v.zoom,
        fontSize: 19 * v.zoom,
        lineHeight: 24 * v.zoom,
        padding: 5 * v.zoom,
        background: 'var(--surface-raised)',
        color: 'var(--ink-primary)',
        fontFamily: 'var(--font-ui)',
      };
    }

    const pending = this.pendingText();
    if (pending) {
      const v = this.viewport.viewport();
      return {
        text: '',
        placeholder: 'Write on the desk…',
        left: v.panX + pending.x * v.zoom,
        top: v.panY + pending.y * v.zoom,
        width: 420 * v.zoom,
        height: 90 * v.zoom,
        fontSize: 30 * v.zoom,
        lineHeight: 38 * v.zoom,
        padding: 4 * v.zoom,
        background: 'transparent',
        color: 'var(--ink-primary)',
        fontFamily: 'var(--font-hand)',
      };
    }
    const id = this.editingId();
    if (!id) return null;
    const object = this.desk.floats().find((f) => f.id === id);
    if (!object) return null;
    const v = this.viewport.viewport();
    const sticky = object.payload.kind === 'sticky' ? object.payload : null;
    // Checklist stickies edit as one item per line, in the checklist's own
    // type metrics (see buildSticky / sticky-layout).
    const checklist = sticky?.items?.length ? sticky.items : null;
    const compact = !!sticky?.compact;
    const baseFont = checklist ? 20 : sticky ? (compact ? 22 : 26) : 30;
    const baseLine = checklist ? 30 : sticky ? (compact ? 26 : 32) : 38;
    const hand = checklist ? false : sticky ? !!sticky.hand : true;
    return {
      text: checklist
        ? checklist.map((item) => item.label).join('\n')
        : object.payload.kind === 'sticky' || object.payload.kind === 'text'
          ? object.payload.text
          : '',
      // A quiet prompt, per the design system's empty-state rule. It lives on
      // the input, never in the payload, so it cannot be committed the way the
      // old "new note" placeholder was.
      placeholder: checklist ? 'One task per line' : sticky ? 'Write a note…' : 'Type here…',
      left: v.panX + object.x * v.zoom,
      top: v.panY + object.y * v.zoom,
      width: object.width * v.zoom,
      height: object.height * v.zoom,
      fontSize: baseFont * v.zoom,
      lineHeight: baseLine * v.zoom,
      padding: (sticky ? (compact ? 14 : 20) : 4) * v.zoom,
      background: sticky ? `var(--stationery-${sticky.color})` : 'transparent',
      color: sticky ? `var(--stationery-${sticky.color}-ink)` : 'var(--ink-primary)',
      fontFamily: hand ? 'var(--font-hand)' : 'var(--font-ui)',
    };
  });

  constructor() {
    afterNextRender(() => void this.startScene());

    // Push reactive state into the scene once it is ready. Each effect
    // reads `sceneReady` so it re-fires with current values on startup.
    effect(() => {
      const v = this.viewport.viewport();
      if (this.sceneReady()) this.scene.setViewport(v);
    });
    effect(() => {
      const floats = this.desk.floats();
      if (this.sceneReady()) this.scene.setObjects(floats);
    });
    effect(() => {
      const id = this.selection.selection()?.id ?? null;
      if (this.sceneReady()) this.scene.setSelection(id);
    });
    effect(() => {
      const id = this.editingId();
      if (this.sceneReady()) this.scene.setEditing(id);
    });
    effect(() => {
      const date = this.desk.flashDate();
      if (this.sceneReady()) this.scene.setFlashDate(date);
    });
    // Re-expand events for the months on screen. Declared after the viewport
    // effect so the scene already knows where it is looking, and keyed on the
    // year span rather than the raw viewport so panning within a year does not
    // rebuild every month on every frame.
    effect(() => {
      const events = this.events.events();
      this.viewport.viewport();
      if (!this.sceneReady()) return;
      const window = this.scene.visibleDateRange();
      const key = `${window.from.getFullYear()}:${window.to.getFullYear()}`;
      if (key === this.contentKey && events === this.contentEvents) return;
      this.contentKey = key;
      this.contentEvents = events;
      this.occurrenceIndex.set(this.events.occurrencesByDate(window));
      this.scene.refreshDayContent();
    });
    // Focus the editor the moment it exists. A timer would race a fast
    // typist, and every keystroke that lands before focus is swallowed by
    // the global shortcuts instead of the note.
    effect(() => {
      const area = this.editArea()?.nativeElement;
      if (!area) return;
      area.focus();
      if (this.selectAllOnFocus) area.select();
    });

    this.destroyRef.onDestroy(() => this.scene.destroy());
  }

  /** Boots the renderer; degrades to a notice when WebGL is unavailable. */
  private async startScene(): Promise<void> {
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    try {
      await this.scene.init({
        canvas: this.sceneCanvas().nativeElement,
        width,
        height,
        dayContent: (date) => this.dayContentFor(date),
        today: new Date(),
      });
    } catch (error) {
      console.warn('Canvas scene unavailable:', error);
      this.sceneFailed.set(true);
      return;
    }
    this.viewport.setViewSize(width, height);
    this.sceneReady.set(true);

    const resizeObserver = new ResizeObserver(() => {
      const w = this.host.clientWidth;
      const h = this.host.clientHeight;
      if (w > 0 && h > 0) {
        this.scene.resize(w, h);
        this.viewport.setViewSize(w, h);
      }
    });
    resizeObserver.observe(this.host);
    this.destroyRef.onDestroy(() => resizeObserver.disconnect());

    // Repaint with the new palette whenever the app toggles `data-theme`.
    const themeObserver = new MutationObserver(() => this.scene.refreshTheme());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    this.destroyRef.onDestroy(() => themeObserver.disconnect());
  }

  /**
   * Content for one day cell: real event occurrences, plus the sample tasks,
   * handwriting and range bars that stand in until those features exist.
   *
   * The sample month's own events are deliberately ignored — they were seeded
   * as real rows on first run, so drawing them from the constant too would
   * show every one of them twice.
   */
  private dayContentFor(date: Date): DayContent | null {
    const occurrences = this.occurrenceIndex().get(dateKey(date)) ?? [];
    const sample = sampleDayContent(date);
    if (!occurrences.length) {
      if (!sample) return null;
      const { events: _seeded, ...rest } = sample;
      return rest;
    }
    return {
      ...(sample ?? {}),
      events: occurrences.map((occurrence) => ({
        title: occurrence.event.title,
        time: occurrence.event.timeLabel,
        color: occurrence.event.color,
        variant: occurrence.event.variant,
        // The repeat glyph marks anything belonging to a series, whether it is
        // still computed or has been materialised.
        recurring: !!occurrence.event.rrule || !!occurrence.event.seriesId,
      })),
    };
  }

  /** Occurrences the scene may ask for, grouped by day. */
  private readonly occurrenceIndex = signal<ReadonlyMap<string, Occurrence[]>>(new Map());
  /** Guards the rebuild below so panning does not re-expand every series. */
  private contentKey = '';
  private contentEvents: unknown = null;

  /** Converts a pointer event to world coordinates. */
  private toWorld(event: PointerEvent | MouseEvent): Point {
    const rect = this.host.getBoundingClientRect();
    return screenToWorld(this.viewport.viewport(), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  /** Starts a pan, drag, or resize depending on what is under the pointer. */
  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const world = this.toWorld(event);
    const panAnywhere = this.tools.spaceHeld() || this.tools.active() === 'Pan';
    if (!panAnywhere && this.createForActiveTool(world)) return;
    const hit = !panAnywhere && this.sceneReady() ? this.scene.hitTest(world) : null;

    if (hit?.kind === 'object') {
      const object = this.desk.get(hit.id);
      if (!object) return;
      const checklistIndex = checklistItemAt(object, world);
      if (checklistIndex !== null) {
        this.actions.toggleChecklistItem(hit.id, checklistIndex);
        this.selection.select(object.payload.kind, hit.id);
        return;
      }
      const selected = this.selection.selection()?.id === hit.id;
      if (selected && RESIZABLE.has(object.payload.kind) && this.nearSoutheast(object, world)) {
        this.resizeGesture = {
          id: hit.id,
          from: { width: object.width, height: object.height },
          startWorld: world,
        };
        return;
      }
      this.selection.select(object.payload.kind, hit.id);
      this.drag = {
        id: hit.id,
        dx: world.x - object.x,
        dy: world.y - object.y,
        from: { x: object.x, y: object.y },
      };
      return;
    }

    if (hit?.kind === 'event') {
      this.selectEvent(hit);
      return;
    }

    // Empty paper (cell or open desk): pan and deselect.
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

  /** Double-click edits editable objects or writes on empty paper. */
  protected onDoubleClick(event: MouseEvent): void {
    if (!this.sceneReady()) return;
    const world = this.toWorld(event);
    const hit = this.scene.hitTest(world);

    if (hit?.kind === 'object') {
      const object = this.desk.get(hit.id);
      if (!object) return;
      const editable = object.payload.kind === 'text' || object.payload.kind === 'sticky';
      if (editable) this.openEditor(hit.id, false);
      return;
    }
    if (hit?.kind === 'event') {
      const occurrence = this.storedEventAt(hit);
      // A computed occurrence has no row to edit yet; changing one has to ask
      // whether the edit means this date or the whole series, which arrives
      // with the recurrence UI.
      if (occurrence && !occurrence.virtual) {
        this.selectEvent(hit);
        this.openEventEditor(occurrence.event.id);
      }
      return;
    }

    this.openTextDraft(world);
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

  /** Advances the live drag, resize, or pan gesture (transient only). */
  protected onPointerMove(event: PointerEvent): void {
    if (this.drag) {
      const world = this.toWorld(event);
      const object = this.desk.get(this.drag.id);
      if (!object) return;
      this.transientRect = {
        x: Math.round(world.x - this.drag.dx),
        y: Math.round(world.y - this.drag.dy),
        width: object.width,
        height: object.height,
      };
      this.scene.setTransient(this.drag.id, this.transientRect);
    } else if (this.resizeGesture) {
      const world = this.toWorld(event);
      const object = this.desk.get(this.resizeGesture.id);
      if (!object) return;
      this.transientRect = {
        x: object.x,
        y: object.y,
        width: Math.max(120, Math.round(this.resizeGesture.from.width + world.x - this.resizeGesture.startWorld.x)),
        height: Math.max(64, Math.round(this.resizeGesture.from.height + world.y - this.resizeGesture.startWorld.y)),
      };
      this.scene.setTransient(this.resizeGesture.id, this.transientRect);
    } else if (this.pan) {
      this.viewport.panTo(
        this.pan.startPanX + (event.clientX - this.pan.startClientX),
        this.pan.startPanY + (event.clientY - this.pan.startClientY),
      );
    }
  }

  /** Ends the gesture; a real drag/resize commits exactly one command. */
  protected onPointerUp(): void {
    if (this.drag && this.transientRect) {
      this.actions.commitMove(this.drag.id, this.drag.from, {
        x: this.transientRect.x,
        y: this.transientRect.y,
      });
      this.scene.setTransient(this.drag.id, null);
    } else if (this.resizeGesture && this.transientRect) {
      this.actions.commitResize(this.resizeGesture.id, this.resizeGesture.from, {
        width: this.transientRect.width,
        height: this.transientRect.height,
      });
      this.scene.setTransient(this.resizeGesture.id, null);
    }
    this.drag = null;
    this.resizeGesture = null;
    this.transientRect = null;
    this.pan = null;
    if (this.tools.panning()) this.tools.panning.set(false);
  }

  /** Commits the DOM editor's content as one command and closes it. */
  protected commitEditor(event: FocusEvent): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.tools.editing.set(false);

    const eventId = this.editingEventId();
    if (eventId) {
      this.editingEventId.set(null);
      const title = text.trim();
      // An event with no name is nothing; the same rule as an empty text object.
      if (title) this.events.update(eventId, { title });
      else this.events.remove(eventId);
      return;
    }

    const pending = this.pendingText();
    if (pending) {
      this.pendingText.set(null);
      // Abandoned compositions create nothing at all.
      if (text.trim()) this.actions.addText(pending, text.trim());
      return;
    }

    const id = this.editingId();
    if (!id) return;
    const object = this.desk.get(id);
    if (object?.payload.kind === 'text') {
      this.actions.commitTextEdit(id, text);
    } else if (object?.payload.kind === 'sticky') {
      if (object.payload.items?.length) {
        const labels = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (labels.length) this.actions.setChecklistItems(id, labels);
      } else {
        this.actions.setStickyText(id, text);
      }
    }
    this.editingId.set(null);
  }

  /** Opens the DOM editor over an existing object. */
  private openEditor(id: string, selectAll: boolean): void {
    this.selectAllOnFocus = selectAll;
    this.editingId.set(id);
    this.takeKeyboard();
  }

  /** Creates an untitled event on a day and returns its id. */
  private createEventOn(date: Date): string {
    const id = `event${Date.now()}`;
    this.events.insert({ id, title: '', color: 'blue', date });
    this.selection.select('event', id);
    return id;
  }

  /** Opens the overlay to type an event's title. */
  private openEventEditor(id: string): void {
    this.selectAllOnFocus = true;
    this.editingEventId.set(id);
    this.takeKeyboard();
  }

  /** Opens the editor over empty paper to compose a new text object. */
  private openTextDraft(world: Point): void {
    this.selectAllOnFocus = false;
    this.pendingText.set({ x: Math.round(world.x), y: Math.round(world.y) });
    this.takeKeyboard();
  }

  /**
   * Marks the editor as owning the keyboard.
   *
   * The textarea itself is focused by an effect once Angular renders it (plus
   * `autofocus` as a belt-and-braces). Keys pressed in the frame before that
   * lands are dropped, but this flag keeps them from reaching the global
   * shortcuts, where they would arm tools and start pans mid-sentence.
   */
  private takeKeyboard(): void {
    this.tools.editing.set(true);
  }

  /**
   * Places the active tool's object at a world point and returns to Select,
   * so a second click does not silently create a second object.
   *
   * @returns `true` when a creation tool handled the click; `false` when the
   *   caller should treat it as selection or panning.
   */
  private createForActiveTool(world: Point): boolean {
    if (!this.sceneReady()) return false;
    const at = { x: Math.round(world.x), y: Math.round(world.y) };
    switch (this.tools.active()) {
      case 'Text':
        this.openTextDraft(world);
        break;
      case 'Sticky note':
        // Select-all so the first keystroke replaces the placeholder rather
        // than appending to it.
        this.openEditor(this.actions.addSticky(at), true);
        break;
      case 'Task':
        this.openEditor(this.actions.addChecklistSticky(at), true);
        break;
      case 'Event': {
        const hit = this.scene.hitTest(world);
        // An event belongs to a day, so a click off the grid is a miss rather
        // than a mistake: stay armed and let the user try again on a date.
        if (hit?.kind !== 'cell') return true;
        this.openEventEditor(this.createEventOn(hit.date));
        break;
      }
      default:
        return false;
    }
    this.tools.activate('Select');
    return true;
  }


  /** `true` when the pointer is within handle range of the SE corner. */
  private nearSoutheast(object: { x: number; y: number; width: number; height: number }, world: Point): boolean {
    const radius = HANDLE_RADIUS / this.viewport.viewport().zoom;
    const dx = world.x - (object.x + object.width);
    const dy = world.y - (object.y + object.height);
    return Math.hypot(dx, dy) <= radius;
  }

  /** A clicked calendar chip becomes the inspected event selection. */
  private selectEvent(hit: Extract<SceneHit, { kind: 'event' }>): void {
    const occurrence = this.occurrenceIndex().get(dateKey(hit.date))?.[hit.index];
    if (!occurrence) return;
    this.selection.select('event', hit.id);
    this.selection.eventTitle.set(occurrence.event.title);
    this.selection.eventTime.set(occurrence.event.timeLabel ?? 'All day');
    this.selection.eventColor.set(`--stationery-${occurrence.event.color}`);
  }

  /** The stored event under an event-chip hit, if it has one yet. */
  private storedEventAt(hit: Extract<SceneHit, { kind: 'event' }>): Occurrence | null {
    return this.occurrenceIndex().get(dateKey(hit.date))?.[hit.index] ?? null;
  }
}
