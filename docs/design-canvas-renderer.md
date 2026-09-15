# Canvas Renderer Design (Milestone 2)

**Status:** Accepted for implementation
**Date:** September 15, 2026
**Scope:** Replacing the milestone-1 DOM workspace with the PixiJS scene; answers the
architecture record's open questions on world coordinates, culling, and progressive detail.

## Summary

Milestone 1 rendered four separate DOM "sheets" (year, month, week, day) that were swapped
per tier. Milestone 2 replaces them with **one continuous world** rendered by PixiJS 8:
calendar geometry has a fixed place in world space, zoom level determines detail
(the `--zoom-*` tier thresholds in the Deskbound tokens), and month navigation is panning.
The toolbar's tier control becomes a set of zoom/position presets rather than a scene switch.

Angular keeps the chrome (toolbar, rail, inspector, overlays) and all gesture → command
logic; the canvas package exposes a renderer controller that never leaks PixiJS objects.

## World layout (answers ADR open question: coordinate scale and origin)

Time is laid out as **year blocks** on an infinite plane. Within a year, months form a
3-column × 4-row grid (matching the year-planner reading order); years stack vertically.

```text
      col 0      col 1      col 2
    ┌──────────┬──────────┬──────────┐
r0  │ January  │ February │ March    │
r1  │ April    │ May      │ June     │   ← one year block
r2  │ July     │ August   │ September│
r3  │ October  │ November │ December │
    └──────────┴──────────┴──────────┘
                  ↓ next year block (below)
```

Constants (world units; 1 unit = 1 px at zoom 1.0):

| Constant | Value | Meaning |
| --- | --- | --- |
| `CELL_W × CELL_H` | 320 × 240 | one day cell |
| `MONTH_HEADER_H` | 140 | month title band |
| month grid | 7 × 6 cells, always 6 rows | uniform month height → O(1) math |
| `MONTH_W × MONTH_H` | 2240 × 1580 | header + grid |
| `MONTH_GAP` | 100 | gutter between months |
| `YEAR_GAP` | 240 | gutter between year blocks |
| origin `(0,0)` | top-left of January 2020's header | epoch predates all real data |

- `monthOrigin(year, month)` and `cellRectForDate(date)` are O(1) and deterministic.
- Months always render 6 rows; lead/trail slots show the adjacent month's dates dimmed.
  The **canonical** rect of a date is its position in its own month; hit-testing an
  outside cell resolves to the date it displays (flagged `inMonth: false`).
- Positions stay ≤ ~10⁵ world units per century — far inside float64 precision.
- The milestone-1 linear day-axis mapping (`worldXForDate`) is **superseded and removed**;
  the month-grid mapping is the single documented mapping required by the ADR. (History
  retains the old module.)
- Zoom bounds widen to `[0.08, 2.0]` so the year tier is reachable. Tier thresholds are
  unchanged (`year < 0.35 ≤ month < 0.75 ≤ week < 1.5 ≤ day`).

Desk objects (stickies, images, files, text) live in the same plane, keyed by world x/y
plus width/height (added to `DeskObject` this milestone for culling, selection, resize).
The space right of each year block is open desk — the sample desk parks its floats beside
September 2026.

## Progressive detail per tier

One geometry, four rendering densities. A month view is rebuilt when the tier band changes.

| Tier (zoom) | Calendar rendering |
| --- | --- |
| Year (< 0.35) | Month title, weekend/outside tint, colored density dots for days with content. No text beyond titles. |
| Month (0.35–0.75) | Full grid: numerals, today stamp, event chips (time + title), task chips, range bars, handwriting, photo placeholders. |
| Week (0.75–1.5) | Month rendering + event metadata lines and untruncated titles. |
| Day (≥ 1.5) | Week rendering + reminder/recurrence glyph emphasis; the cell reads as a small page. |

The mock's bespoke week/day sheet layouts (hour rulers) are **deferred** — they return
later as an optional layout mode; this milestone keeps the grid geometry at all tiers.
Decorative elements dropped from the mock: the annotation arrow and the sheet hint line.

## Scene architecture

`@infinite-desk/canvas` gains a `scene/` area (PixiJS 8) with the ADR's explicit layers:

```text
CanvasScene (stage)
├── GridLayer          screen-space paper grid (not zoom-scaled)
└── WorldRoot          position = pan, scale = zoom
    ├── CalendarLayer  month views, culled by visible month range (arithmetic)
    ├── EventLayer     event/task/range chips at cell-derived world rects
    ├── NoteLayer      stickies and text objects
    ├── DrawingLayer   (empty this milestone — handwriting lands in M4)
    ├── AttachmentLayer images and file chips
    ├── ConnectorLayer (empty this milestone)
    └── InteractionLayer selection outline + handles, flash highlight
```

- **Rendering is on-demand**: the ticker is stopped; a dirty flag schedules
  `renderer.render()` on the next animation frame. A static scene costs zero GPU/CPU.
- **Culling**: calendar content derives the visible month range from the viewport rect
  (pure arithmetic). Freely positioned objects use the spatial index. Month views are
  cached for the visible range ± 1 and destroyed beyond it.
- **Theme**: colors are read from the Deskbound CSS custom properties at init and on
  theme change, so light/dark stay single-sourced in `tokens/*.css`.
- **Text**: PixiJS `Text` with the document's loaded fonts (`document.fonts.ready` is
  awaited before first text render). Slight upscale blur at day zoom is accepted this
  milestone; sharper re-rasterization is a perf-budget task for M6.

## Spatial index (answers "viewport culling and a spatial index")

A uniform grid hash (`spatial-index.ts`, cell size 512 world units), framework-free and
unit-tested: `insert/update/remove(id, rect)`, `query(rect)`, `hitTest(point)` returning
ids in insertion order (top-most = last). Event chips register synthetic ids
(`event:<iso-date>:<index>`); floats register their object id. All pointer picking goes
through this — the PixiJS event system stays disabled (`eventMode: 'none'`) for
performance and to keep input in one place.

## Angular ↔ canvas contract

The scene is driven through a `CalendarSceneController` that accepts domain state and
emits nothing but plain data — PixiJS types never cross the boundary:

- **In (Angular effects push):** viewport state, desk objects, per-date day content,
  selection id, transient drag position, editing id (object hidden while a DOM editor is
  over it), flash date, theme refresh, canvas resize.
- **Out (Angular pulls):** `hitTest(worldPoint) → { kind, id } | null`,
  `rectFor(id)` for overlay/inspector positioning.

Gestures remain in the Angular workspace component exactly as in milestone 1: pointer
events → transient state → **one command on gesture end** (move, resize). New this
milestone: Delete removes the selection, arrow keys nudge it (one command per press),
and a southeast handle resizes stickies and images via `ResizeObjectCommand`.

## Hybrid DOM editing (ADR: text editing uses real DOM)

Double-clicking a text object **or a sticky note** opens a DOM editor positioned with
`worldToScreen` over the object's rect, font-size multiplied by zoom, while the scene
hides the object. Blur (or Escape) commits one `UpdatePayloadCommand` and the scene
re-renders the saved value. Double-clicking empty paper creates a draft text object and
opens the same editor. This closes milestone 1's "sticky notes aren't editable" gap.

## Navigation

- **Tier presets** (toolbar segmented control): Year fits the current year block; Month
  fits the focused month; Week centers the focused week row at 0.78; Day centers today's
  cell at 1.6. The displayed tier label derives from `tierForZoom(zoom)` — free panning
  and zooming update it continuously.
- **Focused month/date** derives from the world point at the viewport center; the date
  navigator label follows it, giving real month navigation across all of time.
- **Jumps** (Today, search, palette) center the target cell and flash it via the
  interaction layer.
- Dev/e2e affordance: `?tier=` and `?theme=` URL parameters apply a preset at startup so
  headless screenshots can reach any state.

## Deferred within Milestone 2

- Drawing and connector content (layers exist, empty) — M4.
- Bespoke week/day layouts with hour rulers — optional mode, later.
- Rotation handle and multi-select — later milestone.
- Sharper text rasterization at high zoom; measured perf budgets — M6.
