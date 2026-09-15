# Contributing

Working agreements for this repository. They are short, but they are firm.

## Commits

- **Conventional Commits, always.** `type(scope): subject` — lowercase type, imperative subject, no trailing period.
  - Types in use: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`, `ci`, `perf`.
  - Scopes mirror the workspace: `domain`, `canvas`, `deskbound`, `persistence`, `desktop`, `tauri`, `repo`.
  - Example: `feat(canvas): add deterministic date-to-world mapping`
- **Human authorship only.** Commits carry no AI co-author trailers or generated-by footers — ever.
- Keep commits scoped to one logical change; the history should read like a changelog.

## Code documentation

- **Every public API is documented** with xmldoc-style comments:
  - TypeScript: TSDoc blocks (`/** … */`) with `@param`, `@returns`, `@remarks` where they add information.
  - Rust: `///` doc comments on public items.
- Comments state contracts and constraints — what a caller must know — not a narration of the implementation.
- Non-trivial private members get a one-line doc comment when their purpose is not obvious from the name.

## Repository hygiene

- **No AI tooling in the tree.** Assistant configuration and context files (`.claude/`, `CLAUDE.md`, `.cursor*`, `.aider*`, `AGENTS.md`, and friends) are gitignored and must not be committed.
- Architecture decisions live in `docs/`; significant decisions get recorded there before large implementations land.
- The imported design reference in `docs/design/` is read-only source material — the live design system is `packages/deskbound`.

## Boundaries (from the architecture record)

- Angular owns application chrome; the canvas package owns spatial content.
- All persistent mutations go through commands (undoable, testable) — never direct writes from pointer handlers.
- Renderer objects are projections of domain state, never the source of truth.

See `docs/Infinite-Desk-Calendar-Architecture-Decisions.md` for the full record.
