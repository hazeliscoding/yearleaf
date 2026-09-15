# Deskbound Design System

Deskbound is the design system for **Infinite Desk Calendar** — a desktop-first spatial calendar where users navigate time as an infinite canvas — and is reusable for creative productivity tools, journaling apps, planners, lightweight editors, and other spatial interfaces.

It combines Japanese stationery, editorial design, drafting tools, and desktop creative software. It should feel **tactile, quiet, expressive, spatial, crafted, mature, highly usable** — never like a generic SaaS kit.

Sources: no external Figma/codebase/assets were provided; this system was authored from the written brief ("Create design system" prompt, Sept 2026). No logo exists — render "Deskbound" in plain type (Zilla Slab 600) wherever a mark would go.

## Design philosophy
1. **Canvas first** — the user's work is the interface; chrome frames it, never competes.
2. **Digital stationery** — Hobonichi/Midori-grade warmth translated to UI, never kitschy skeuomorphism.
3. **Direct manipulation** — drag, resize, edit inline; no modal for what the canvas can do.
4. **Progressive detail** — information appears/collapses by zoom tier (year → month → week → day; thresholds in `tokens/spacing.css`).
5. **Structured + unstructured** — events and tasks coexist with sticky notes, ink, and images; neither dominates.
6. **Quiet chrome** — thin borders, restrained contrast, small shadows, compact controls.
7. **Personal expression** — customization (stationery colors, paper, markers) affects user content more than chrome.

## CONTENT FUNDAMENTALS
- **Tone:** calm, precise, unhurried. Written like good stationery copy: short declaratives, no exclamation marks, no hype.
- **Casing:** Sentence case everywhere (buttons, menus, labels). Month names and weekday headers may use the calendar typeface's natural forms; metadata labels are UPPERCASE with `--tracking-metadata`.
- **Person:** address the user as "you" sparingly; prefer imperative micro-copy ("Double-click anywhere to write." "Press N for a sticky note." "Drop an image onto the calendar."). Empty states are quiet prompts on the paper itself — never illustrations.
- **Emoji:** never in chrome. Users may paste emoji into their own content.
- **Dates:** written like print — "Tuesday, March 4" in full contexts, "Mar 4" compact, bare slab numerals in cells. Shortcut hints are first-class copy: "⌘K", "V", "Space + drag".
- **Vocabulary:** desk/paper words — canvas, paper, note, ink, stamp, layer, pin. Say "Jump to date", not "Navigate".

## VISUAL FOUNDATIONS
- **Surfaces:** warm neutrals, never pure white. Canvas `#EBE8E0` sits *under* paper `#F6F4EE`; raised paper `#FCFBF7` for menus/cards. Dark theme is charcoal drafting paper (`#211F1B` canvas) — paper objects stay lighter than the canvas to preserve physical layering.
- **Ink:** text is warm near-black `#2B2822` (printed ink), 5-step hierarchy (primary/secondary/muted/disabled/inverse).
- **Accent:** burnt ochre `#9C5310` (stamp ink) — used for primary actions and the Today marker. Selection & focus are drafting blue `#3B62A8`, deliberately distinct from the accent.
- **Stationery palette:** 13 muted colors (yellow→lavender), each a triple: `--stationery-X` (fill), `--stationery-X-ink` (accessible foreground), `--stationery-X-soft` (tint). Fills desaturate slightly in dark mode.
- **Texture:** extremely subtle only — faint grid lines (`--grid-line`) on the canvas, ruled lines (`--rule-line`) inside notes. No noise images, no skeuomorphic paper photos.
- **Borders:** 1px, low contrast (`--border`); `--border-strong` only for emphasis. Dividers even quieter.
- **Radii:** restrained — subtle 3px (most controls), standard 5px, soft 8px (paper objects, popovers), round reserved for expressive bits (color dots, pins). Never pill-everything.
- **Shadows:** shallow 5-level scale (0 flat → 4 modal). Dragged objects lift to level 3 (`--shadow-dragging`). `--shadow-paper` for resting canvas objects.
- **Hover:** background tint `--hover` (5% ink); pressed `--pressed` (9%). No color inversion, no scaling on chrome. Canvas objects lift + 1° settle on drop.
- **Motion:** quick (110–320ms), `--ease-out` for chrome, `--ease-spring` only for objects settling. Zoom preserves spatial position. Reduced motion collapses all durations to 0.
- **Layout:** dense desktop layouts — compact 2–64px spacing scale, 28px controls, 44px toolbars, 264px inspector. No marketing whitespace. No card-inside-card, no glassmorphism, no gradients.
- **Transparency/blur:** none in chrome; alpha only for hover tints, selection washes, grid lines.

## Typography
- **Interface:** Hanken Grotesk — controls, menus, inspectors, forms.
- **Calendar:** Zilla Slab — month titles, date numerals, section headers. Printed, slab, warm. Numerals use `tnum`/`lnum` (`.db-numeral` helper).
- **Writing:** Gochi Hand — user handwritten notes only; never chrome.
- Full scale in `tokens/typography.css` (`--text-display` … `--text-numeral-sm`).
- ⚠️ **Font substitution:** all three are Google Fonts stand-ins loaded from CDN (no brand binaries were provided). Supply licensed files to replace them.

## ICONOGRAPHY
- **Set:** [Lucide](https://lucide.dev) via CDN (`https://unpkg.com/lucide@latest`) — consistent 1.5px strokes, precise drafting-tool character, legible at 16–20px. This is a flagged substitution: the brief calls for a custom set; Lucide is the closest stroke-consistent match. No icon font, no emoji, no hand-drawn SVGs.
- **Usage:** stroke `currentColor`, width 1.5, sizes 14/16/20 (`--icon-sm/--icon/--icon-lg`). Tool icons: `mouse-pointer-2` (select), `hand` (pan), `type` (text), `sticky-note`, `calendar-plus` (event), `square-check` (task), `pen-line`, `pencil`, `highlighter`, `eraser`, `lasso`, `image`, `paperclip`, `move-up-right` (arrow), `spline` (connector), `stamp`, `layers-2`, `zoom-in/out`, `calendar`, `repeat`, `bell` (reminder), `lock`, `group`, `layout-grid` (arrange), `undo-2`, `redo-2`.
- Unicode: keyboard glyphs (⌘ ⇧ ⌥ ⎋ ↵) are used verbatim in Kbd components.

## Accessibility
WCAG 2.2 AA. Visible 2px focus ring (`--focus-ring`), logical tab order, keyboard access for every tool (single-key shortcuts V/H/T/N/E/P, ⌘K palette, Esc exits), non-color state indicators (checkmarks, lock glyphs, underlines), reduced-motion support, every stationery fill paired with a ≥4.5:1 ink.

## Index
- `styles.css` — global entry (imports everything below)
- `tokens/` — fonts, colors (light+dark), typography, spacing, effects, base
- `guidelines/` — foundation specimen cards (Design System tab)
- `components/core/` — Button, ToolButton, Toolbar (+ToolbarDivider), Kbd, Tooltip, Icon
- `components/overlays/` — ContextMenu, CommandPalette, Popover, Modal, InspectorPanel (+InspectorGroup, InspectorRow)
- `components/forms/` — Field, Input (+TextArea), SearchField, Select, Checkbox, Radio, Toggle, Slider, SegmentedControl, NumberField, ColorPicker, DatePicker (+TimeField)
- `components/canvas/` — StickyNote, EventObject, TaskObject, TextObject, ImageObject, FileAttachment, Highlight, SelectionBox
- `components/calendar/` — CalendarCell, DateNumber, MonthHeader, WeekHeader, RangeBar, DateNavigator, ZoomControl, LayerPanel
- `ui_kits/infinite-desk-calendar/` — full app screen recreation
- `SKILL.md` — agent skill entry point

### Intentional additions
No source inventory existed, so the component set was authored from the brief's own component list; nothing beyond the brief was added.
