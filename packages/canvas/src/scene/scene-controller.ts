/**
 * The spatial workspace scene: owns the PixiJS application, the explicit
 * layer stack from the architecture record, month-view culling, object
 * views, the spatial index, and the interaction chrome.
 *
 * Only plain data crosses this class's API (see scene-types.ts). Rendering
 * is on demand: the ticker is stopped and a dirty flag schedules a single
 * `render()` per animation frame, so a static desk costs nothing.
 */

import { Application, Container, Graphics } from 'pixi.js';

import type { DeskObject } from '@infinite-desk/domain';

import {
  EPOCH_YEAR,
  MONTH_H,
  MONTH_STRIDE_X,
  MONTH_STRIDE_Y,
  MONTH_W,
  YEAR_MONTH_COLS,
  YEAR_MONTH_ROWS,
  YEAR_STRIDE_Y,
  cellRectForDate,
  dateForWorldPoint,
  type WorldRect,
} from '../month-layout';
import { SpatialIndex } from '../spatial-index';
import { tierForZoom, type Point, type ViewportState, type ZoomTier } from '../viewport';
import { buildMonthView } from './month-view';
import { buildObjectView } from './object-view';
import { parseEventChipId, type SceneHit, type SceneInitOptions } from './scene-types';
import { readThemeTokens, type ThemeTokens } from './theme';

/** World-unit spacing of the faint paper grid. */
const GRID_SPACING = 40;
/** Minimum on-screen spacing below which the paper grid is omitted. */
const GRID_MIN_SCREEN = 12;

/** A cached month view plus the chip ids it registered. */
interface MonthEntry {
  readonly container: Container;
  readonly chipIds: readonly string[];
  readonly tier: ZoomTier;
}

export class CalendarSceneController {
  private app: Application | null = null;
  private theme!: ThemeTokens;
  private viewport: ViewportState = { panX: 0, panY: 0, zoom: 0.5 };
  private viewSize = { width: 0, height: 0 };

  // Layer stack (bottom → top), per the architecture record.
  private gridLayer!: Graphics;
  private worldRoot!: Container;
  private calendarLayer!: Container;
  private eventLayer!: Container;
  private noteLayer!: Container;
  private drawingLayer!: Container;
  private attachmentLayer!: Container;
  private connectorLayer!: Container;
  private interactionLayer!: Graphics;

  private readonly monthEntries = new Map<string, MonthEntry>();
  private readonly objectViews = new Map<string, Container>();
  private readonly objects = new Map<string, DeskObject>();
  private readonly index = new SpatialIndex();

  private dayContent!: SceneInitOptions['dayContent'];
  private today!: Date;
  private selection: string | null = null;
  private editing: string | null = null;
  private flashDate: Date | null = null;
  private transient: { id: string; rect: WorldRect } | null = null;

  private dirty = false;
  private rafId = 0;

  /** `true` once {@link init} has completed successfully. */
  get ready(): boolean {
    return this.app !== null;
  }

  /**
   * Creates the renderer and layer stack. Throws when no WebGL/WebGPU
   * context is available (callers should degrade gracefully).
   */
  async init(options: SceneInitOptions): Promise<void> {
    this.dayContent = options.dayContent;
    this.today = options.today;
    this.viewSize = { width: options.width, height: options.height };
    this.theme = readThemeTokens();

    const app = new Application();
    await app.init({
      canvas: options.canvas,
      width: options.width,
      height: options.height,
      antialias: true,
      background: this.theme.surfaceCanvas,
      resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
      autoDensity: true,
      autoStart: false,
      preference: 'webgl',
    });

    // Text must rasterize with the document's fonts, not fallbacks.
    try {
      await document.fonts?.ready;
    } catch {
      // Font readiness is best-effort; fallback rendering is acceptable.
    }

    this.gridLayer = new Graphics();
    this.worldRoot = new Container();
    this.calendarLayer = new Container();
    this.eventLayer = new Container();
    this.noteLayer = new Container();
    this.drawingLayer = new Container();
    this.attachmentLayer = new Container();
    this.connectorLayer = new Container();
    this.interactionLayer = new Graphics();
    this.worldRoot.addChild(
      this.calendarLayer,
      this.eventLayer,
      this.noteLayer,
      this.drawingLayer,
      this.attachmentLayer,
      this.connectorLayer,
      this.interactionLayer,
    );
    app.stage.addChild(this.gridLayer, this.worldRoot);
    this.app = app;

    this.applyViewportToStage();
    this.syncMonths();
    this.redrawGrid();
    this.markDirty();
  }

  /** Tears the renderer down; the controller cannot be reused afterwards. */
  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.app?.destroy();
    this.app = null;
    this.monthEntries.clear();
    this.objectViews.clear();
    this.objects.clear();
    this.index.clear();
  }

  /** Resizes the renderer to new CSS-pixel dimensions. */
  resize(width: number, height: number): void {
    if (!this.app) return;
    this.viewSize = { width, height };
    this.app.renderer.resize(width, height);
    this.syncMonths();
    this.redrawGrid();
    this.markDirty();
  }

  /** Applies a new pan/zoom state and re-culls visible months. */
  setViewport(viewport: ViewportState): void {
    this.viewport = viewport;
    if (!this.app) return;
    this.applyViewportToStage();
    this.syncMonths();
    this.redrawGrid();
    this.drawInteraction();
    this.markDirty();
  }

  /** Replaces the desk objects; views diff by object reference. */
  setObjects(objects: readonly DeskObject[]): void {
    if (!this.app) return;
    const seen = new Set<string>();
    for (const object of objects) {
      seen.add(object.id);
      const previous = this.objects.get(object.id);
      if (previous !== object) {
        this.objectViews.get(object.id)?.destroy();
        const view = buildObjectView(object, this.theme);
        view.visible = this.editing !== object.id;
        this.layerFor(object).addChild(view);
        this.objectViews.set(object.id, view);
        this.objects.set(object.id, object);
        this.index.insert(object.id, rectOfObject(object));
      }
    }
    for (const id of [...this.objects.keys()]) {
      if (!seen.has(id)) {
        this.objectViews.get(id)?.destroy();
        this.objectViews.delete(id);
        this.objects.delete(id);
        this.index.remove(id);
      }
    }
    this.drawInteraction();
    this.markDirty();
  }

  /**
   * Shows an in-progress gesture's geometry without committing it: the
   * object renders at the transient rect until cleared with `null`.
   */
  setTransient(id: string, rect: WorldRect | null): void {
    if (!this.app) return;
    const object = this.objects.get(id);
    if (!object) return;
    this.transient = rect ? { id, rect } : null;
    const view = this.objectViews.get(id);
    if (!view) return;
    const effective = rect ?? rectOfObject(object);
    const resized = effective.width !== object.width || effective.height !== object.height;
    if (resized) {
      view.destroy();
      const rebuilt = buildObjectView(
        { ...object, x: effective.x, y: effective.y, width: effective.width, height: effective.height },
        this.theme,
      );
      rebuilt.visible = this.editing !== id;
      this.layerFor(object).addChild(rebuilt);
      this.objectViews.set(id, rebuilt);
    } else {
      view.position.set(effective.x + effective.width / 2, effective.y + effective.height / 2);
    }
    this.drawInteraction();
    this.markDirty();
  }

  /** Highlights the selected object or event chip (`null` clears). */
  setSelection(id: string | null): void {
    this.selection = id;
    this.drawInteraction();
    this.markDirty();
  }

  /** Hides an object while a DOM editor covers it (`null` shows all). */
  setEditing(id: string | null): void {
    this.editing = id;
    for (const [objectId, view] of this.objectViews) view.visible = objectId !== id;
    this.markDirty();
  }

  /** Flash-highlights a day cell after a jump (`null` clears). */
  setFlashDate(date: Date | null): void {
    this.flashDate = date;
    this.drawInteraction();
    this.markDirty();
  }

  /** Re-reads theme tokens (after a `data-theme` change) and repaints. */
  refreshTheme(): void {
    if (!this.app) return;
    this.theme = readThemeTokens();
    this.app.renderer.background.color = this.theme.surfaceCanvas;
    this.rebuildMonths();
    for (const [id, view] of this.objectViews) {
      const object = this.objects.get(id);
      if (!object) continue;
      view.destroy();
      const rebuilt = buildObjectView(object, this.theme);
      rebuilt.visible = this.editing !== id;
      this.layerFor(object).addChild(rebuilt);
      this.objectViews.set(id, rebuilt);
    }
    this.redrawGrid();
    this.drawInteraction();
    this.markDirty();
  }

  /** Resolves what sits under a world point, top-most entry winning. */
  hitTest(world: Point): SceneHit | null {
    const ids = this.index.hitTest(world);
    const top = ids[ids.length - 1];
    if (top) {
      const chip = parseEventChipId(top);
      if (chip) return { kind: 'event', id: top, date: chip.date, index: chip.index };
      return { kind: 'object', id: top };
    }
    const cell = dateForWorldPoint(world);
    return cell ? { kind: 'cell', date: cell.date, inMonth: cell.inMonth } : null;
  }

  /** World rect of an object or event chip, if known. */
  rectFor(id: string): WorldRect | undefined {
    const object = this.objects.get(id);
    return object ? rectOfObject(object) : this.index.rectOf(id);
  }

  // ---- Internals ---------------------------------------------------------

  /** Routes an object to its architecture layer. */
  private layerFor(object: DeskObject): Container {
    return object.payload.kind === 'image' || object.payload.kind === 'file'
      ? this.attachmentLayer
      : this.noteLayer;
  }

  private applyViewportToStage(): void {
    this.worldRoot.position.set(this.viewport.panX, this.viewport.panY);
    this.worldRoot.scale.set(this.viewport.zoom);
  }

  /** The world rect currently visible, expanded by half a month stride. */
  private visibleWorldRect(): WorldRect {
    const { panX, panY, zoom } = this.viewport;
    const marginX = MONTH_STRIDE_X / 2;
    const marginY = MONTH_STRIDE_Y / 2;
    return {
      x: -panX / zoom - marginX,
      y: -panY / zoom - marginY,
      width: this.viewSize.width / zoom + 2 * marginX,
      height: this.viewSize.height / zoom + 2 * marginY,
    };
  }

  /** Creates month views entering the viewport, destroys those leaving. */
  private syncMonths(): void {
    const view = this.visibleWorldRect();
    const tier = tierForZoom(this.viewport.zoom);
    const needed = new Set<string>();

    const yearFirst = EPOCH_YEAR + Math.floor(view.y / YEAR_STRIDE_Y);
    const yearLast = EPOCH_YEAR + Math.floor((view.y + view.height) / YEAR_STRIDE_Y);
    for (let year = yearFirst; year <= yearLast; year++) {
      for (let row = 0; row < YEAR_MONTH_ROWS; row++) {
        for (let col = 0; col < YEAR_MONTH_COLS; col++) {
          const x = col * MONTH_STRIDE_X;
          const y = (year - EPOCH_YEAR) * YEAR_STRIDE_Y + row * MONTH_STRIDE_Y;
          const overlaps =
            x < view.x + view.width && x + MONTH_W > view.x &&
            y < view.y + view.height && y + MONTH_H > view.y;
          if (overlaps) needed.add(`${year}:${row * YEAR_MONTH_COLS + col}`);
        }
      }
    }

    for (const [key, entry] of this.monthEntries) {
      if (!needed.has(key) || entry.tier !== tier) this.destroyMonth(key);
    }
    for (const key of needed) {
      if (!this.monthEntries.has(key)) this.buildMonth(key, tier);
    }
  }

  /** Rebuilds every visible month (theme or today change). */
  private rebuildMonths(): void {
    for (const key of [...this.monthEntries.keys()]) this.destroyMonth(key);
    this.syncMonths();
  }

  private buildMonth(key: string, tier: ZoomTier): void {
    const [year, monthIndex] = key.split(':').map(Number);
    const { container, chips } = buildMonthView(
      year,
      monthIndex,
      tier,
      this.theme,
      this.dayContent,
      this.today,
    );
    this.calendarLayer.addChild(container);
    for (const chip of chips) this.index.insert(chip.id, chip.rect);
    this.monthEntries.set(key, { container, chipIds: chips.map((c) => c.id), tier });
  }

  private destroyMonth(key: string): void {
    const entry = this.monthEntries.get(key);
    if (!entry) return;
    entry.container.destroy({ children: true });
    for (const id of entry.chipIds) this.index.remove(id);
    this.monthEntries.delete(key);
  }

  /** Screen-space paper grid, offset by pan so it scrolls with the world. */
  private redrawGrid(): void {
    const g = this.gridLayer;
    g.clear();
    const spacing = GRID_SPACING * this.viewport.zoom;
    if (spacing < GRID_MIN_SCREEN) return;
    const { width, height } = this.viewSize;
    const offsetX = ((this.viewport.panX % spacing) + spacing) % spacing;
    const offsetY = ((this.viewport.panY % spacing) + spacing) % spacing;
    for (let x = offsetX; x <= width; x += spacing) g.moveTo(x, 0).lineTo(x, height);
    for (let y = offsetY; y <= height; y += spacing) g.moveTo(0, y).lineTo(width, y);
    g.stroke({ width: 1, color: this.theme.gridLine.color, alpha: this.theme.gridLine.alpha });
  }

  /** Selection outline + handles and the jump-flash highlight. */
  private drawInteraction(): void {
    const g = this.interactionLayer;
    g.clear();
    const zoom = this.viewport.zoom;

    if (this.flashDate) {
      const cell = cellRectForDate(this.flashDate);
      g.roundRect(cell.x + 3, cell.y + 3, cell.width - 6, cell.height - 6, 4)
        .fill({ color: this.theme.selection, alpha: 0.08 })
        .stroke({ width: 4 / zoom, color: this.theme.selection });
    }

    if (!this.selection) return;
    const rect =
      this.transient?.id === this.selection ? this.transient.rect : this.rectFor(this.selection);
    if (!rect) return;

    const pad = 4 / zoom;
    g.rect(rect.x - pad, rect.y - pad, rect.width + 2 * pad, rect.height + 2 * pad).stroke({
      width: 2.5 / zoom,
      color: this.theme.selection,
    });
    if (this.objects.has(this.selection)) {
      const size = 12 / zoom;
      const corners: readonly [number, number][] = [
        [rect.x - pad, rect.y - pad],
        [rect.x + rect.width + pad, rect.y - pad],
        [rect.x - pad, rect.y + rect.height + pad],
        [rect.x + rect.width + pad, rect.y + rect.height + pad],
      ];
      for (const [cx, cy] of corners) {
        g.rect(cx - size / 2, cy - size / 2, size, size)
          .fill(this.theme.surfaceRaised)
          .stroke({ width: 2 / zoom, color: this.theme.selection });
      }
    }
  }

  /** Schedules a single render on the next animation frame. */
  private markDirty(): void {
    if (this.dirty || !this.app) return;
    this.dirty = true;
    this.rafId = requestAnimationFrame(() => {
      this.dirty = false;
      this.app?.render();
    });
  }
}

/** The axis-aligned world rect of a desk object. */
function rectOfObject(object: DeskObject): WorldRect {
  return { x: object.x, y: object.y, width: object.width, height: object.height };
}
