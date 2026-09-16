# SQLite Persistence Design (Milestone 3)

**Status:** Accepted for implementation
**Date:** September 16, 2026
**Scope:** Answers the architecture record's open question "Which SQLite integration
provides the best Tauri security and migration workflow?" and sets the plumbing for
schema v1, WAL, and the `SQLitePersistence` adapter.

## Summary

SQLite is accessed **only from Rust**, through **rusqlite** (with the `bundled`
feature) plus **rusqlite_migration** for versioned migrations, wrapped in a small
set of hand-written, typed Tauri commands that mirror the
`@infinite-desk/persistence` contracts. No SQL string ever crosses the IPC
boundary; the webview can invoke `load_desk`, `save_object`, and `delete_object` —
nothing else.

This is the option that actually implements what the architecture record already
decided: "SQLite behind narrow Tauri commands" and "Rust as a small,
security-sensitive boundary."

## Candidates evaluated

| Option | How it works | Why it was / wasn't chosen |
| --- | --- | --- |
| **rusqlite + rusqlite_migration** (chosen) | Synchronous SQLite bindings in Rust; typed Tauri commands; migrations tracked in SQLite's `user_version` | Narrowest possible IPC surface, tiny dependency tree, pinned SQLite build, actively maintained (rusqlite 0.40.x, Aug 2026; rusqlite_migration 2.6, May 2026) |
| `tauri-plugin-sql` (official) | Frontend sends **raw SQL strings** over IPC; sqlx executes them; migrations declared in Rust | Rejected: the webview gets a general SQL interface. Capability permissions gate only operation *classes* (`allow-select`, `allow-execute`), not statements — a compromised webview owns the whole database. Directly contradicts the ADR's narrow-boundary decision |
| `tauri-plugin-libsql` / Drizzle sqlite-proxy | Drizzle ORM in TypeScript generates SQL, proxied through `invoke()` to libsql in Rust | Rejected for the same reason: arbitrary generated SQL crosses IPC. Also third-party and young (0.1.x). Attractive DX, wrong trust model for v1 |
| sqlx (direct, in custom commands) | Async SQLite driver with compile-time-checked queries and a built-in migrator | Workable, but compile-time checking needs a `DATABASE_URL`/offline-cache step in CI, and the async pool buys nothing at desk-scale write rates (once per finished gesture). Heavier for no benefit |
| Diesel + diesel_migrations | Sync ORM with schema codegen | Rejected: an ORM abstraction layer over ~7 tables serviced by a handful of fixed queries is overhead, not leverage |

## IPC boundary (answers the security half of the question)

The Rust side exposes exactly the persistence contract, no more:

```text
webview (TypeScript)                    Rust (src-tauri)
SQLitePersistence : DeskPersistence
  loadDesk(deskId)      ── invoke ──►   load_desk(desk_id)      ─► SELECT …
  saveObject(deskId, o) ── invoke ──►   save_object(desk_id, o) ─► INSERT OR REPLACE …
  deleteObject(deskId,i)── invoke ──►   delete_object(…)        ─► DELETE …
```

- Commands take **typed, serde-validated payloads** (the `DeskObject` shape),
  never SQL fragments. All SQL lives in Rust and is parameterized.
- The Tauri capability file allowlists **only these named commands** for the main
  window — deny-by-default for everything else.
- The connection lives in Tauri managed state (`Mutex<Connection>`); commands run
  on the async runtime via blocking sections. One writer is sufficient and correct:
  the persistence contract is called at gesture-commit frequency, never per
  pointer move.
- `bundled` compiles and statically links a pinned SQLite (3.53.x today), so all
  three platforms ship the identical database engine regardless of OS libraries.

New capabilities later (search queries, export, attachment metadata) are added as
new named commands — the surface grows by intent, not by SQL grammar.

## Migration workflow (answers the migration half of the question)

`rusqlite_migration` tracks the schema version in SQLite's native `user_version`
header field — no bookkeeping table, O(1) check on open.

- Migrations are an ordered list of **forward-only** SQL steps embedded in the
  binary (`M::up("…")`), one per schema change; schema v1 is migration 1.
  Down-migrations are omitted in v1 — an installed app never downgrades its data.
- They run **on app launch before the first window loads a desk**, inside a
  transaction (atomic: all-or-nothing per launch).
- Before migrating a database whose `user_version` is behind, the file is copied
  to a timestamped sibling (`infinite-desk.pre-v3.db`) — cheap insurance until
  Milestone 5's real backup system lands.
- A database whose `user_version` is **ahead** of the binary (user opened a desk
  with an older app after an update rolled back) refuses to open with a clear
  error instead of corrupting newer data.
- Rust-side tests: `migrations.validate()` plus a schema snapshot test (dump
  `sqlite_schema` after migrating a fresh db) so schema drift shows up in review.

## Connection pragmas and crash safety

Set once on open, in this order:

| Pragma | Value | Why |
| --- | --- | --- |
| `journal_mode` | `WAL` | ADR requirement; readers never block the writer |
| `synchronous` | `NORMAL` | Safe with WAL; a crash loses at most the last unsynced commit, never corrupts |
| `foreign_keys` | `ON` | Off by default in SQLite; schema v1 relies on it |
| `busy_timeout` | `5000` | Rides out transient contention instead of erroring |

Each `save_object`/`delete_object` is its own transaction, so a commit is durable
at gesture granularity — this is the concrete answer the ADR's separate open
question ("when should edits be flushed?") will build on: flush = command commit,
recovery = WAL replay on next open.

## Rejected concern: TypeScript-side query ergonomics

The main argument for `tauri-plugin-sql`/Drizzle is writing queries in TypeScript
next to the domain code. That trade is worth it in apps where the frontend *is*
the product logic and queries are numerous and fluid. Here the query surface is
deliberately tiny and stable (a persistence adapter, not a query layer), and the
web client will need an IndexedDB adapter behind the same interface anyway — so
SQL in TypeScript would be portability debt, not leverage.

## References

- [Architecture record — open questions](Infinite-Desk-Calendar-Architecture-Decisions.md)
- [rusqlite](https://lib.rs/crates/rusqlite) · [rusqlite_migration](https://lib.rs/crates/rusqlite_migration)
- [Tauri SQL plugin](https://v2.tauri.app/plugin/sql/) (evaluated, rejected)
- [tauri-plugin-libsql](https://github.com/HuakunShen/tauri-plugin-libsql) (evaluated, rejected)
- [SQLite write-ahead logging](https://sqlite.org/wal.html) · [`user_version`](https://www.sqlite.org/pragma.html#pragma_user_version)
