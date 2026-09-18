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
  signal,
  viewChild,
} from '@angular/core';

import {
  CalendarSceneController,
  cellRectForDate,
  checklistItemAt,
  PINNED_HEADER_H,
  screenToWorld,
  type DayContent,
  type Point,
  type SceneHit,
  type WorldRect,
} from '@infinite-desk/canvas';
import { dateKey, type Occurrence } from '@infinite-desk/domain';
import { DbZoomControl } from '@infinite-desk/deskbound';

import { sampleDayContent } from '../data/sample-desk';
import { AttachmentStore, MAX_ATTACHMENT_BYTES } from '../persistence/attachments';
import { DeskActions } from '../state/desk-actions';
import { DeskStore } from '../state/desk-store';
import { EventActions } from '../state/event-actions';
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
/** Zoom applied per unit of wheel delta, as an exponent. One notch is ~120. */
const WHEEL_ZOOM_RATE = 0.0015;

@Component({
  selector: 'app-workspace',
  imports: [DbZoomControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Canvas',
    '[attr.data-scene-ready]': 'sceneReady()',
    style: 'position:relative;overflow:hidden;background:var(--surface-canvas);display:block',
    '[style.cursor]': 'tools.canvasCursor()',
    '(pointerdown)': 'onPointerDown($event)',
    '(dblclick)': 'onDoubleClick($event)',
    '(wheel)': 'onWheel($event)',
    '(dragover)': 'onDragOver($event)',
    '(drop)': 'onDrop($event)',
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
        (zoomIn)="viewport.zoomStep(1)"
        (zoomOut)="viewport.zoomStep(-1)"
        (fitMonth)="viewport.fitTier('Month')"
        (fitYear)="viewport.fitTier('Year')"
      />
    </div>
  `,
})
export class Workspace {
  protected readonly viewport = inject(ViewportStore);
  protected readonly tools = inject(ToolStore);
  protected readonly desk = inject(DeskStore);
  protected readonly events = inject(EventStore);
  protected readonly selection = inject(SelectionStore);
  private readonly actions = inject(DeskActions);
  private readonly eventActions = inject(EventActions);
  private readonly attachments = inject(AttachmentStore);
  private readonly host = inject(ElementRef).nativeElement as HTMLElement;
  private readonly destroyRef = inject(DestroyRef);

  private readonly sceneCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('sceneCanvas');
  private readonly editArea = viewChild<ElementRef<HTMLTextAreaElement>>('editArea');

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
  /**
   * Day an event is being named for, before any row exists.
   *
   * Like {@link pendingText}: creating up front and deleting on an empty
   * commit leaves an undo step that resurrects a nameless event.
   */
  private readonly pendingEventDate = signal<Date | null>(null);
  /** Select-all on focus (used for freshly created objects). */
  private selectAllOnFocus = false;

  private drag: DragState | null = null;
  private resizeGesture: ResizeState | null = null;
  private transientRect: WorldRect | null = null;
  private pan: { startClientX: number; startClientY: number; startPanX: number; startPanY: number } | null = null;

  /** Screen-space geometry and styling of the DOM text editor. */
  protected readonly editor = computed(() => {
    const eventId = this.editingEventId();
    const pendingDate = this.pendingEventDate();
    if (eventId || pendingDate) {
      const event = eventId ? this.events.get(eventId) : undefined;
      if (eventId && !event) return null;
      const v = this.viewport.viewport();
      // Over the day's first chip row, in the chip's own type metrics.
      const cell = cellRectForDate(pendingDate ?? event!.occurrenceDate ?? event!.date);
      const inset = 10;
      return {
        text: event?.title ?? '',
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
    // Redraw pictures when their files finish loading. Attachments and desk
    // objects hydrate in parallel, so an image restored before its attachment
    // arrives has no URL to resolve and would sit as an empty frame.
    effect(() => {
      this.attachments.byId();
      if (this.sceneReady()) this.scene.refreshImages();
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
      // Resizing can reveal months of an adjacent year, which would otherwise
      // draw empty until the next pan: the visible range depends on the view
      // size as much as on the pan and zoom.
      this.viewport.viewSize();
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
        imageSource: (attachmentId) => this.attachments.urlFor(attachmentId),
        today: new Date(),
      });
    } catch (error) {
      console.warn('Canvas scene unavailable:', error);
      this.sceneFailed.set(true);
      return;
    }
    this.viewport.setViewSize(width, height);
    this.sceneReady.set(true);

    // Canvas content is not in the DOM, so the pinned band can only be seen
    // from a test through the scene that draws it.
    const bridge = (globalThis as unknown as Record<string, unknown>)['__e2e'] as
      | Record<string, unknown>
      | undefined;
    if (bridge) bridge['pinnedMonth'] = () => this.scene.pinnedMonth;

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
  /**
   * Whether a pointer event landed on the pinned month band.
   *
   * The band paints over the top of the desk, so a click there must not reach
   * the day cell behind it — an opaque strip that passes clicks through is the
   * worst of both, and a double-click on the month's own name was opening a
   * text editor on a day the reader could not even see.
   */
  private underPinnedHeader(event: MouseEvent): boolean {
    if (!this.scene.pinnedMonth) return false;
    return event.clientY - this.host.getBoundingClientRect().top < PINNED_HEADER_H;
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.underPinnedHeader(event)) return;
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
    if (this.underPinnedHeader(event)) return;
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
      if (!occurrence) return;
      this.selectEvent(hit);
      // Editing a computed occurrence makes it a real one first, so the change
      // lands on that date alone and leaves the rest of the series untouched —
      // the safe scope, and the design record's governing rule.
      this.openEventEditor(this.eventActions.materialise(occurrence));
      return;
    }

    this.openTextDraft(world);
  }

  /** Accepts dragged files so the browser does not navigate away to them. */
  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  /** Drops imported pictures onto the desk where they landed. */
  protected onDrop(event: DragEvent): void {
    const dropped = [...(event.dataTransfer?.files ?? [])];
    if (!dropped.length) return;
    // Cancel *every* file drop, not only the ones we accept. A browser opens
    // an uncancelled drop in place, and this window has no address bar to come
    // back from: dropping a PDF on the desk would replace the desk with it.
    event.preventDefault();

    const images = dropped.filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    void this.importDroppedImages(images, this.toWorld(event));
  }

  /**
   * Imports each dropped picture and places it on the desk.
   *
   * Images are measured before placing so the frame matches the picture's
   * shape from the first frame, rather than snapping when the bitmap loads.
   * Each becomes its own undoable step, fanned out so a multi-file drop does
   * not stack every picture on one spot.
   */
  private async importDroppedImages(files: readonly File[], at: Point): Promise<void> {
    // World units per screen pixel, so a dropped picture is about the same
    // size on screen wherever the desk is zoomed. A fixed world width lands as
    // a speck at the year tier.
    // Hand-sized in world units at the month tier, where the desk normally
    // sits, and grown only when zoomed further out — a fixed world size lands
    // as a speck across a whole year, and compensating for zoom at every level
    // makes a photo fill the screen when you are reading a single day.
    const zoom = this.viewport.viewport().zoom;
    const MONTH_TIER_ZOOM = 0.45;
    const enlarge = Math.min(Math.max(MONTH_TIER_ZOOM / (zoom || MONTH_TIER_ZOOM), 1), 4);
    const box = Math.round(320 * enlarge);
    // Offset by a fraction of the placed size, so a handful of pictures reads
    // as a pile rather than one picture with slivers behind it.
    const step = Math.round(box * 0.16);

    for (const [index, file] of files.entries()) {
      try {
        // Checked before the decode, not after: decoding is where an oversized
        // file actually hurts, so the ceiling has to be read first to be worth
        // anything. The importer refuses the same size on its own side.
        if (file.size > MAX_ATTACHMENT_BYTES) {
          throw new Error(`${file.name} is too large to import`);
        }
        // Measured from the file itself: one decode, and no dependence on the
        // attachment URL being readable yet.
        const bitmap = await createImageBitmap(file);
        const aspect = bitmap.width / (bitmap.height || 1);
        bitmap.close();

        const attachment = await this.attachments.import(file);
        this.actions.addImage(
          { x: Math.round(at.x + index * step), y: Math.round(at.y + index * step * 0.8) },
          attachment.id,
          aspect,
          box,
        );
      } catch (error) {
        console.error(`could not import ${file.name}`, error);
      }
    }
  }

  /** Ctrl/⌘ + wheel zooms around the cursor; plain wheel pans. */
  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = this.host.getBoundingClientRect();
      // Exponential in the wheel delta, so one notch out exactly undoes one
      // notch in, at any scale. The factor used to be linear in the delta,
      // which is not merely uneven: a notch reports about 120, so zooming out
      // asked for a factor of -0.2 and landed on the minimum zoom every time.
      this.viewport.zoomAt(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
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

    const pendingDate = this.pendingEventDate();
    if (pendingDate) {
      this.pendingEventDate.set(null);
      // An unnamed event is nothing, and nothing is what gets created.
      if (text.trim()) this.eventActions.create(pendingDate, text.trim());
      return;
    }

    const eventId = this.editingEventId();
    if (eventId) {
      this.editingEventId.set(null);
      this.eventActions.setTitle(eventId, text);
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
        this.selectAllOnFocus = false;
        this.pendingEventDate.set(hit.date);
        this.takeKeyboard();
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
    this.selection.occurrence.set(occurrence);
  }

  /** The stored event under an event-chip hit, if it has one yet. */
  private storedEventAt(hit: Extract<SceneHit, { kind: 'event' }>): Occurrence | null {
    return this.occurrenceIndex().get(dateKey(hit.date))?.[hit.index] ?? null;
  }
}
