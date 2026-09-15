# desktop

The Angular application shell for Infinite Desk Calendar.

See the [repository README](../../README.md) for the project overview and
[ROADMAP.md](../../ROADMAP.md) for where this application is heading.

## Commands

Run from the repository root:

```bash
pnpm dev      # ng serve on http://localhost:4200
pnpm build    # production build into dist/desktop
pnpm test     # workspace package tests + this app's Vitest suite
```

Or from this directory: `pnpm start`, `pnpm build`, `pnpm test`.

## Structure

- `src/app/state/` — signal stores (viewport, tools, selection, desk, history) and the command-based `DeskActions`
- `src/app/workspace/` — the pannable canvas and its tier sheets (year, month, week, day)
- `src/app/shell/` — toolbar, tool rail, inspector, and search overlay
- `src/app/data/` — the September 2026 sample desk

The design system it renders with lives in `packages/deskbound`.
