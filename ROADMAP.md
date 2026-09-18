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

- [x] Tauri 2 shell: window management, capability ACL, dev/build wiring (native dialogs land with the features that need them; packaging moved to milestone 6)
- [x] SQLite behind narrow Tauri commands (WAL enabled): rusqlite + rusqlite_migration ([design record](docs/design-sqlite-persistence.md)) — no SQL crosses IPC
- [x] Schema foundation: versioned migration machinery plus `desk` and `calendar_object` (migration 1). Decided 2026-09-17 — schema v1 grows one migration per feature rather than landing all seven tables up front, so each table is designed alongside the flow that uses it
- [x] Reopen the last desk on launch (single `default` desk for now); crash-safe flushing — one transaction per committed command, WAL replay on reopen
- [x] `SQLitePersistence` implementing the `@infinite-desk/persistence` contracts, injected only under Tauri (in-memory fallback in the browser)

## Milestone 4 — Objects and input depth (delivery steps 6–7)

- [ ] Event, task, and sticky editing flows (create via tools, edit via DOM overlays) — checklist toggling/editing is done, but there is still no way to *create* a checklist sticky, and the Task tool arms without doing anything (persona finding)
- [ ] Fix: extended punctuation (em dash, arrows, accents) renders as tofu in newly typed sticky text — hand-font glyph coverage in the canvas rasterization (persona finding)
- [x] Fix: armed creation tools are inert — Text/Sticky/Task now place their object at the click point, disarm afterwards, and show a crosshair while armed; tools that are not built yet (Event, the drawing group, Image/Arrow/Stamp) render disabled instead of arming and doing nothing
- [x] Fix: empty "start typing…" draft text objects persist — text is now composed in the overlay and no object exists until a non-empty commit; a new sticky's placeholder is preselected so typing replaces it
- [x] Fix: `Shift+T` (the palette's advertised Today shortcut) is swallowed by the Text tool binding; keystrokes landing before the editor takes focus no longer arm tools or start pans
- [ ] Fix: `Ctrl+Y` doesn't redo on Windows
- [ ] Remaining finish-gate items from the 2026-09-17 creation review: committed text sits ~9 world units below where it was composed (the overlay is a WYSIWYG promise; sticky metrics are already exact); the bare-canvas text composer could use a faint paper fill so it reads as a writing surface rather than a selection marquee; disabled chrome measures ~2:1 so nine dead rail tools read as *empty* rather than *not yet*. Text anchors top-left at the click while notes centre on it — kept deliberately (a text caret is an insertion point, a note is paper under a thumb), revisit only if it confuses real users
- [ ] Findings from June's 2026-09-17 re-test (creation itself now works for her): the inspector offers Colour/Opacity/Position/Rotation for a note but no field to type its words, while events get a Title box — so she went hunting; checkboxes are hard to hit at month zoom and a miss selects the whole note; "Today" returns to the right date at whatever zoom you had strayed to, so she landed on four giant day cells; event chips are too thin to click at 46%; renaming an event in the inspector is silently discarded (events are still sample data, not objects)
- [ ] Creation follow-ups from the 2026-09-17 design review: an armed creation tool cannot be completed from the keyboard (`n` then Enter should place at viewport centre, restoring the pointerless path the `N` shortcut used to give); `editingId` and the pending composition should collapse into one editor-target signal so they are mutually exclusive by construction; Escape commits rather than discards a composition (decided deliberately — never lose typing — but worth revisiting); clearing a checklist sticky to zero lines keeps the old items where clearing a text object deletes it
- [ ] Multi-select and the lasso: the lasso tool arms but does nothing, marquee-drag pans, Shift+click doesn't extend — promoted from the milestone-2 deferral by persona demand; duplicate/copy-paste of objects belongs with it
- [x] A way to reach next month. Arrows either side of the navigator label move what the label names — a month, or a year at the year tier — and PageUp/PageDown do the same without a pointer. Stepping keeps your zoom and your place within the month, and crosses the row and year wraps that scrolling cannot: months run three across, so dragging downward from September arrives at December, which a professional calendar reader mistook for the weekday columns being misaligned. The navigator now names the month filling the screen rather than the one under the centre point, which is how it came to report "July 2026" while October and November were on screen. A Month fit returns to the month you were reading instead of landing on the middle of the year block. And the wheel zoom factor was linear in the wheel delta, so a notch of 120 asked for a scale of -0.2 and clamped: three notches out from any zoom landed on a view of several blank years
- [x] The scroll trap is closed on the canvas, where the deceiving happens. A sheet whose own title has scrolled off the top keeps naming itself in a band pinned to the top of the viewport, with the weekday letters aligned to the columns they name — which is the other half of the misreading, since the reader who got lost concluded the columns themselves were wrong. The band names the sheet that is *unlabelled*, not the one filling the screen: drifting down from September puts September's last rows along the top and December's sheet, header and all, below them, and December above September is exactly the surprise. So the moment a drag crosses a quarter now announces itself. The band stays out of a whole-year view where every sheet is titled, off bare desk where there is nothing to name, and off a sliver of the month above that the default framing leaves showing over the gutter
- [ ] Scroll-trap leftovers: the gutters between sheets are still blank texture, so a reader mid-drag has no forward signpost — only the band behind them; and there is still no edge to the desk, so dragging east of the last column reaches unlabelled nothing
- [x] Fits, jumps and steps glide instead of cutting. `ViewportStore.animate` had been written in five places and read nowhere, so nothing was animated despite the code documenting itself as animated. Two reviewers independently said the cut was the reason the layout stayed invisible: reaching October without ever learning it sits below July and two columns left. Zoom eases geometrically, a gesture abandons a flight in progress, the first framing on load does not fly in from the origin, and `prefers-reduced-motion` turns it off
- [ ] Navigation leftovers from Priya's 2026-09-18 retest: double-clicking a month card in the year view makes a two-pixel note instead of flying into that month, which is what every year view does; "Today" silently changes your zoom, dropping a reader at Week when they were working at Month; the year view has no day numbers and no today marker, which is the one thing a year view is for; there is no horizontal wheel gesture, so the only axis that means "next month" has none; dragging east of the last column reaches unlabelled nothing with no edge marker; and the step shortcuts are advertised only in the arrows' tooltips, not in the command palette that already renders shortcut chips
- [ ] Every keyboard hint in the app prints ⌘ regardless of platform, on a desktop build that runs on Windows. `db-kbd` needs to resolve the modifier per platform
- [ ] Navigation UX from the 2026-09-16 persona smoke tests: "Fit month" fits the screen-center month, not the working month; no next/previous-month affordance and no horizontal wheel panning (the 3×4 layout defeats "next page is below"); year-zoom scrolling overshoots by years; no way back after a year-view detour; floating panels obscure drop targets; sticky editor shows no visible caret; tooltips clip at the screen edge; long sticky content overflows the note; no visible delete affordance in the inspector
- [x] Fix: transient flash when an object is added or deleted (was the inspector opening/closing — the renderer resize composited one blank frame; now renders synchronously on resize)
- [x] Fix: the command palette rendered as an inline box (calendar read through it) and the toolbar search glyph sat outside the field; dark theme had no shadow re-base, so panels and canvas objects cast no usable shadow
- [ ] Remaining chrome defects from the 2026-09-16 design review (design-system side): the palette's scrollable list bisects a row at the rounded bottom edge with no scroll affordance; the ⎋ keycap reads as a prohibition sign at 10.5px; the floating zoom control uses `--shadow-1` where the system's own floating recipe specifies `--shadow-2`. (The Opacity row and the raw-float rotation went with the inspector honesty pass; the layer panel no longer renders.)
- [ ] Remaining hardcoded alphas that were never re-based for dark (same class as the shadow fix): the tooltip keycap is white-on-cream and loses its edge entirely, inspector colour swatches lose their border on the dark panel, and the sticky fold/pin/tape fills in `objects.css` are unaudited
- [ ] Decide whether overlays are truly modal: the palette and search scrims are `inset:0` inside the canvas cell, so the toolbar and tool rail stay fully lit and clickable behind an open overlay while the zoom control is dimmed — one rule either way, no seam at the chrome edge
- [ ] Recurrence rules and their relationship to moved/annotated occurrences — [design record](docs/design-recurrence.md) accepted: a series is stored once and its occurrences computed, materialising into real objects only when touched; position is derived from the date until the user moves it
- [x] Recurrence engine in `@infinite-desk/domain`: the accepted `RRULE` subset parses, validates, round-trips and expands over floating dates; `occurrencesInWindow` resolves stored events into drawable occurrences, applying overrides and tombstones and preserving orphans
- [x] Migration 2: `event` + `recurrence_rule`, with the override key and one-override-per-date enforced by the database; an installed v1 desk upgrades with its objects intact
- [x] Event persistence: typed `load_events`/`save_event`/`delete_event` commands (migration 3 adds `placed`, the flag that says whether an event owns its position), the `DeskPersistence` contract, and both adapters
- [x] Event creation in the app: the Event tool and "New event" button create an event on the clicked day and title it in place; computed occurrences replace the sample event constants, and the sample month is seeded as real editable rows
- [x] Events are undoable like the rest of the desk (add/rename/delete as commands; deleting a series restores its overrides on undo), and cancelling one date of a series materialises a tombstone
- [x] Materialise an override when a computed occurrence is edited or cancelled — double-clicking one makes it real first, so the change lands on that date alone; the inspector edits the series and says which it is doing
- [ ] "This and following" — the third scope from the design record (an `UNTIL` split plus migrating overrides across the boundary). "This occurrence" and "all" are covered by the gesture and the inspector respectively
- [ ] Moving a computed occurrence off its day cell should materialise it too (editing and cancelling already do); needs the drag path to recognise event chips
- [ ] Finish-gate items on the event chrome: the title editor's position, type size and fill are hardcoded constants that disagree with `drawEventChip`, so text shifts on commit; the editor always opens on the day's first chip row, hiding whatever is already there, and the row the user double-clicked is known but discarded. The chip is also never hidden while its title is edited, so fixing the metrics without hiding it would render the same words twice in the same place
- [ ] Events render in insertion order with no time-based sort, so giving an event an earlier time does not move it above a later one in the day cell — which makes the time look decorative. Needs a created-at field to break ties, since `occurrencesInWindow` currently sorts id-lexicographically and new ids sort above seeded ones
- [x] Recurrence UI: the inspector's Repeats control creates or clears a series (Never/Daily/Weekly/Monthly/Yearly, anchored on the event's own date); richer rules show as "Custom" rather than being silently simplified. Title and colour edits finally persist
- [ ] Handwriting and highlighter strokes; choose the drawing representation (ADR open question)
- [x] Image import via drag and drop; attachments copied into the managed asset directory with checksums (migration 4), drawn as real bitmaps, deduplicated by content, and held in memory in the browser build
- [x] Attachment hardening from the 2026-09-17 reviews: unreferenced asset rows and files are reclaimed when the desk opens (safe there because history does not survive a restart, so nothing can resurrect an object that would claim its picture back); imports cross IPC as a raw request body with their metadata in headers instead of a JSON array of integers; a decoded picture is scaled to a 2048px long side before becoming a texture, so an 8000px photo no longer stays resident at full size; both sides refuse a file over 32 MB, the webview before it decodes
- [ ] Attachment leftovers: object URLs are never revoked in the browser build, where imports are also silently session-only; a refused import — too large, or bytes that will not decode — is only reported to the console, so the picture simply never appears and the desk offers no explanation
- [ ] Paste an image from the clipboard — drop is the only import path today, which is undiscoverable and unreachable without a pointer; it reuses the same import and place calls
- [ ] Photo reframing: resize is free-form while the sprite cover-crops to the frame, so dragging a corner silently cuts the sides off a picture with no way to choose what is kept. Preserving the source aspect on a photo's handle (free-form behind Alt) is the small fix; a focal point on `ImagePayload` is the full one. (The caption-row clause of this item was stale — `f8dbd87` fixed it — and the layer-panel clause is resolved: the panel no longer renders.)
- [x] The inspector tells the truth: Position, Rotation and image Frame were `model()` signals that moved under the cursor and discarded the edit. All three are wired through commands now, Opacity and Locked are gone because nothing backs them, and Pinned came back wired — the sticky payload had carried a pin flag and a handwriting flag all along, so that toggle was never a control with nothing behind it. File and text selections report what they actually are, and an event can finally be given a time, which is validated as a clock value because the chip reserves room for it before the title and a sentence there cost the event its name on the calendar. A number field refuses a blank or unparseable entry and redraws from the object rather than keeping a value nothing has
- [x] The layer panel no longer renders. Its rows claimed a colour-to-category taxonomy the app has no concept of — desk objects carry no layer membership, so the eye toggled nothing and the colours mapped to nothing. `DbLayerPanel` stays in the design system for when layers are real, which needs a layer reference on `DeskObject`, a layers table, and removal from the spatial index on hide so hidden objects stop being clickable

## Milestone 5 — Findability and safety (delivery step 8)

- [ ] Universal search over real structured text and metadata (today's index is a sample)
- [ ] Command palette wired to the full command set — today it is decorative (persona finding): typing filters nothing, arrow keys don't move the highlight, Enter blindly runs the first row, "Type a command or date…" parses no dates, and the sample rows show a hardcoded stale "Today — Sep 15, 2026"
- [ ] Export/backup that restores a complete desk, including attachments and version metadata
- [ ] Automatic local backups and recovery after interrupted imports

## Milestone 6 — First release hardening (delivery step 9)

- [ ] Accessibility: keyboard access to every tool, accessible structured mirrors of canvas content, screen-reader passes
- [ ] Contrast: `--ink-muted` carries caption and metadata text but measures 3.0–4.4:1 on every surface it lands on, in both themes (worst: the 8.5px tool-rail key hint at 3.14:1 on a selected row) — either re-tune the token or move small text to `--ink-secondary`. `.db-input--stateful` is the precedent for the second approach: a placeholder that reports state rather than hinting at a format is content, and takes the readable token
- [ ] Stepper presses each record their own undo step, so five clicks on a number field's arrow need five Ctrl+Z. Defensible under the one-gesture-one-command rule, but coalescing repeated steps on the same field within a short window would match what the rest of the app feels like. Related: `selectedRotation` displays a whole number while the object stores the fractional tilt it was set down with, so an untouched field can read up to half a degree off until the first edit normalises it
- [ ] Inspector follow-ups from the 2026-09-18 design reviews: Position X and Y are world coordinates with no referent a user can read — the origin is never on screen, so "7120 x / 45200 y" names nothing, and dragging is the real gesture for it; the colour picker offers 6 of the 13 stationery colours, so a red event shows no selection and cannot be given its red back once another is picked; the text panel tells you to double-click the desk to rewrite it while a sticky, editable by the identical gesture, says nothing; inspector group headers are `role="button"` with no `tabindex`, so no group collapses from the keyboard; number-field steppers are 14×10 CSS px against the 24×24 WCAG 2.2 asks, with no arrow-key alternative since the input is not `type="number"`; an event that has been dragged off its day cell will carry real geometry once that lands, but `hasGeometry()` only consults `desk.floats()`, so its Geometry group would silently not appear
- [ ] `DbSlider` and the `eye`/`eye-off`/`grip-vertical`/`layers-2` icons have no consumers left after the inspector and layer-panel passes. Keep them as catalogue entries or delete them, but decide — `DbLayerPanel` is recorded as a deliberate keep and these are not
- [ ] A sticky's `compact` flag is the Pinned argument all over again: `object-view.ts` sizes padding, type and line height from it, `sticky-layout.ts` hit-tests checklists with it, `workspace.ts` sizes the inline editor with it, and `sample-desk.ts` ships `s3` compact — so two sticky sizes sit side by side on the seeded desk with no control anywhere that sets or clears it
- [ ] Findings from Priya's 2026-09-18 smoke test that are not already tracked: selection handles are drawn on all four corners but only the southeast one resizes, so three of the four are decorative and a drag on them does nothing; right-click does nothing anywhere, so there is no Delete, Duplicate or Bring-to-front and the Delete key is the only way to remove anything, unannounced; a checklist selection is titled "Sticky note" and offers no checklist controls, and its colour swatch is not ringed the way a sticky's is; every keyboard hint shows ⌘ on Windows; "Jump to date ⌘J" and "⌘ Commands" open the same panel; the year view is twelve blank rectangles with no day numbers and no today marker, which is the one thing a year view is for
- [ ] At 960px — the app's own `minWidth` — the toolbar's Commands button, its icon button and the New event primary all sit past the window edge and are unreachable, since the document does not scroll. New event is already off-screen at 1100px
- [ ] One focus vocabulary: `base.css` gives a 2px `--focus-ring` outline, `.db-input:focus` replaces it with a thinner 1px box-shadow that also fires on mouse focus, and the overlay inputs set `outline:none` with no replacement at all
- [ ] Playwright end-to-end suite covering the ADR's priority scenarios
- [ ] Performance budgets measured on dense, lived-in desks (frame time, hit-test latency, open time, memory)
- [ ] Cross-platform webview testing; packaging for Windows/macOS/Linux
- [ ] Generate and vault the Tauri updater signing keypair before the first shipped build (losing it strands installed apps on old versions)
- [ ] Set up Azure Trusted Signing for Windows builds and wire it into CI (decided; same route as pr-sweep); macOS: Developer ID + notarization
- [ ] GitHub Actions release pipeline — build, sign, and bundle per platform — modeled on pr-sweep's CI/CD

## Beyond Version 1 (explicitly deferred)

- Web client (IndexedDB persistence adapter, browser file handling)
- Cloud API (ASP.NET Core), PostgreSQL, object storage; multi-device sync
- Real-time collaboration (CRDT evaluation only once sync is proven)
