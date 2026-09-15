# Roadmap

Derived from the accepted architecture record
([docs/Infinite-Desk-Calendar-Architecture-Decisions.md](docs/Infinite-Desk-Calendar-Architecture-Decisions.md)),
whose delivery order this tracks. Checked items are done; the rest are in
planned order. Version 1 is a fully offline, single-user desktop
application — no accounts, no cloud, no sync.

## Milestone 0 — Repository foundation ✅

- [x] pnpm workspace: `apps/desktop`, `packages/{domain,canvas,deskbound,persistence}`
- [x] Angular 22 application scaffold (signals, zoneless, Vitest)
- [x] Deskbound design system ported from the design reference (tokens + Angular components)
- [x] Architecture record and design reference committed under `docs/`

## Milestone 1 — The spatial screen ✅

- [x] Deterministic date↔world mapping (`@infinite-desk/canvas`, epoch 2020-01-01, 320 units/day) with tests
- [x] Viewport math: focal-point-preserving zoom, pan, zoom-tier thresholds, with tests
- [x] Application shell: toolbar, tool rail, contextual inspector, ⌘K command palette, universal search overlay
- [x] Year / month / week / day tier sheets on a pannable, zoomable canvas (DOM-rendered)
- [x] Desk objects: sticky notes, images, files, freeform text; drag with transient state
- [x] Command architecture and universal undo/redo (add, move, delete, payload edit)
- [x] Light and dark themes; reduced-motion tokens

## Milestone 2 — PixiJS workspace ✅ (delivery steps 2–4)

The workspace is now one continuous world rendered by PixiJS 8
(design record: [docs/design-canvas-renderer.md](docs/design-canvas-renderer.md)):
months live in fixed world positions (3×4 year blocks), the detail tier
derives from the zoom level, and month navigation is panning.

- [x] PixiJS 8 scene with explicit layers (Calendar, Event, Note, Drawing, Attachment, Connector, Interaction)
- [x] Calendar grid rendered from the shared date↔world mapping with progressive detail per zoom tier
- [x] Viewport culling (visible-month arithmetic) and a spatial index for hit testing
- [x] Selection, movement, resizing (SE handle), delete, and arrow-key nudging against the Pixi scene
- [x] DOM overlay editing for text objects **and sticky notes** (canvas-positioned editor)
- [x] Real month navigation across all of time (tier presets, focused-month labels, date jumps)

Deferred out of this milestone (tracked in the design record): drawing and
connector content, bespoke week/day hour-ruler layouts, rotation handle,
multi-select, and sharper text rasterization at high zoom.

## Milestone 3 — Desktop shell and persistence (delivery steps 1 & 5)

- [ ] Tauri 2 shell: window management, native dialogs, packaging for Windows/macOS/Linux
- [ ] SQLite behind narrow Tauri commands (WAL enabled); decide the SQLite integration (open question in the ADR)
- [ ] Schema v1: `desk`, `calendar`, `calendar_object`, `event`, `attachment`, `tag`, `setting` with versioned migrations
- [ ] Reopen the last desk on launch; crash-safe write flushing
- [ ] `SQLitePersistence` implementing the `@infinite-desk/persistence` contracts
- [ ] Generate and vault the Tauri updater signing keypair before the first shipped build (losing it strands installed apps on old versions)
- [ ] Set up Azure Trusted Signing for Windows builds and wire it into CI (decided; same route as pr-sweep)
- [ ] GitHub Actions release pipeline — build, sign, and bundle per platform — modeled on pr-sweep's CI/CD

## Milestone 4 — Objects and input depth (delivery steps 6–7)

- [ ] Event, task, and sticky editing flows (create via tools, edit via DOM overlays)
- [ ] Recurrence rules and their relationship to moved/annotated occurrences (ADR open question)
- [ ] Handwriting and highlighter strokes; choose the drawing representation (ADR open question)
- [ ] Image import via drag and drop; attachments copied into the managed asset directory with checksums

## Milestone 5 — Findability and safety (delivery step 8)

- [ ] Universal search over real structured text and metadata (today's index is a sample)
- [ ] Command palette wired to the full command set
- [ ] Export/backup that restores a complete desk, including attachments and version metadata
- [ ] Automatic local backups and recovery after interrupted imports

## Milestone 6 — First release hardening (delivery step 9)

- [ ] Accessibility: keyboard access to every tool, accessible structured mirrors of canvas content, screen-reader passes
- [ ] Playwright end-to-end suite covering the ADR's priority scenarios
- [ ] Performance budgets measured on dense, lived-in desks (frame time, hit-test latency, open time, memory)
- [ ] Cross-platform webview testing; packaging and updates through the signed release pipeline (Windows: Azure Trusted Signing; macOS: Developer ID + notarization)

## Beyond Version 1 (explicitly deferred)

- Web client (IndexedDB persistence adapter, browser file handling)
- Cloud API (ASP.NET Core), PostgreSQL, object storage; multi-device sync
- Real-time collaboration (CRDT evaluation only once sync is proven)
