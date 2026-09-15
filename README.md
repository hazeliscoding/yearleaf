# Yearleaf — Infinite Desk Calendar 🍂

A desktop-first, **local-first spatial calendar** where time is an infinite canvas. Zoom out and the desk is an annual planner; move closer and it becomes a month, a week, and finally a day that behaves like a notebook page. Events share the paper with sticky notes, handwriting, images, tasks, and highlights.

![Month view of the Infinite Desk Calendar](docs/assets/month-view.png)

No account. No cloud. Your desk lives on your machine.

## ✨ What works today

The first milestone implements the [Deskbound-designed](docs/design/) application screen end to end:

- **Spatial workspace** — pan (space-drag, wheel, or the Pan tool) and zoom (Ctrl/⌘ + wheel around the cursor, or the zoom widget) across a paper desk.
- **Four zoom tiers** — year planner, month sheet, week sheet, and day page, switchable from the toolbar.
- **A lived-in month** — events (timed, all-day, tentative, recurring, completed), tasks, multi-day ranges, handwriting, and taped photos on a September 2026 sample desk.
- **Desk objects** — draggable sticky notes (with checklists), images, file attachments, and freeform text; double-click empty paper to write.
- **Universal undo/redo** — every mutation is a command; a drag commits exactly one history entry (⌘Z / ⇧⌘Z).
- **Selection & inspector** — click an object for its contextual inspector (paper color, geometry, event schedule, image caption).
- **Search & command palette** — search events, notes, handwriting, and files; ⌘K opens the palette; jumps flash the target day.
- **Light & dark themes** — warm paper by day, charcoal drafting paper by night.

## 🧭 Architecture

The full decision record lives in [`docs/Infinite-Desk-Calendar-Architecture-Decisions.md`](docs/Infinite-Desk-Calendar-Architecture-Decisions.md). The short version:

| Layer | Choice |
| --- | --- |
| Application UI | Angular 22 (signals, zoneless) |
| Spatial renderer | PixiJS 8 (upcoming — see [ROADMAP](ROADMAP.md); the current milestone renders the workspace with DOM) |
| Desktop shell | Tauri 2 (upcoming) |
| Local data | SQLite + filesystem attachments (upcoming) |
| Design system | Deskbound (`packages/deskbound`) |
| Tests | Vitest + Playwright (later) |

### Workspace layout

```text
yearleaf/
├── apps/
│   └── desktop/            Angular application shell
├── packages/
│   ├── domain/             Entities, calendar math, command/undo architecture
│   ├── canvas/             Date↔world mapping, viewport math, zoom tiers
│   ├── deskbound/          Design system: CSS tokens + Angular components
│   └── persistence/        Storage contracts + in-memory adapter
└── docs/
    ├── design/             Imported design reference (opens in a browser)
    └── *.md                Architecture record
```

Two rules keep the codebase honest: **Angular owns chrome, the canvas owns spatial content**, and **every persistent mutation is an undoable command** — pointer handlers never write state directly.

## 🚀 Getting started

Requires Node ≥ 20 and [pnpm](https://pnpm.io) (`corepack enable pnpm`).

```bash
pnpm install
pnpm dev            # serve the app at http://localhost:4200
pnpm build          # production build
pnpm test           # package tests (Vitest) + app tests
```

Try it: press `N` for a sticky note, drag it somewhere better, then ⌘Z twice.

## 🗺️ Where this is going

See [ROADMAP.md](ROADMAP.md) — next up are the PixiJS workspace renderer, the Tauri shell, and SQLite persistence.

## Contributing

Conventional commits, documented public APIs, no AI co-author trailers — the working agreements are in [CONTRIBUTING.md](CONTRIBUTING.md).
