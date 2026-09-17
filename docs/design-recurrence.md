# Recurrence and Occurrences Design (Milestone 4)

**Status:** Accepted for implementation
**Date:** September 17, 2026
**Scope:** Answers the architecture record's open question "How should recurring
events relate to freely moved or annotated occurrences?", and with it the shape of
the `event` and `recurrence_rule` tables. Also proposes a resolution to the parked
schema-v1 scope question.

## Summary

A recurring event is stored **once**. Its occurrences are **computed** for the
visible window, never stored — until the user touches one, at which point that
single occurrence **materialises** into a real row that overrides the series on
that date. Deleting one occurrence materialises a tombstone.

This is RFC 5545's model (`RRULE` + `EXDATE` + `RECURRENCE-ID` overrides) fitted to
a spatial desk, and it lands on machinery Yearleaf already has: the scene already
computes per-month content on the fly, and event chips already carry *derived*
identity (`event:<iso-date>:<index>`) rather than stored ids.

The governing rule, and the answer to the open question:

> **An occurrence's properties — including its position — are derived from the
> series until the user changes them. The first change makes that occurrence a
> real object that owns its properties from then on.**

## Why not the alternatives

| Option | Why not |
| --- | --- |
| **Expand the series into N stored rows at creation** | A weekly seminar over two years is 104 rows; changing the rule means rewriting all of them, and "repeats forever" has no row count. Marcus's 16-week seminar and June's birthdays both become bulk edits. |
| **Store occurrences lazily as they scroll into view** | Rows would appear from *reading* the calendar, so the database grows by navigation and an untouched year differs from a browsed one. Sync would replay meaningless writes. |
| **Keep overrides as diffs against the series** | Requires merge rules for every field and makes "what does this occurrence actually say" a computation. A materialised occurrence is just a `calendar_object` — it drags, resizes, persists and undoes through the paths that already exist. |

## Recurrence rules

Rules are stored as an **RFC 5545 `RRULE` string** (`FREQ=WEEKLY;BYDAY=TU`), because
it is a frozen, well-understood vocabulary and it is what an `.ics` export will need
in Milestone 5.

Yearleaf implements a **validated subset**, expanded over **floating calendar dates**
— no times, no time zones, no DST arithmetic. The desk is laid out by day; an event's
time is a label inside its chip, not an instant on a timeline. This removes the part
of RFC 5545 that implementations most often get wrong.

Supported in v1:

| Part | Supported | Example |
| --- | --- | --- |
| `FREQ` | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` | `FREQ=WEEKLY` |
| `INTERVAL` | any positive integer | every other week |
| `BYDAY` | weekday list; `nth` form for monthly | `BYDAY=TU,TH`, `BYDAY=3WE` |
| `BYMONTHDAY` | day-of-month for monthly/yearly | `BYMONTHDAY=15` |
| `COUNT` / `UNTIL` | either, not both | 16 weeks of seminar |
| `WKST` | week start, for correct `BYDAY` weeks | `WKST=MO` |

Rejected for v1 (parsed and **refused** with a clear error, never silently ignored):
`BYSETPOS`, `BYYEARDAY`, `BYWEEKNO`, `BYHOUR`/`BYMINUTE`/`BYSECOND`, and sub-daily
frequencies. A rule we cannot honour must not be stored as one we appear to honour.

Expansion lives in `@infinite-desk/domain` as a pure function so the web client
shares it. We do **not** take `rrule` (2.8.1, last published November 2023): the
subset above is tractable over floating dates and testable exhaustively, whereas the
library drags in the instant/time-zone semantics this model deliberately does not
have. If full RFC coverage is needed later (`.ics` *import*), it can be swapped in
behind the same `expand(rule, window)` signature.

## Occurrences

```text
                         materialise on first change
  series (1 row)  ──────────────────────────────────────►  override row
        │                                                   (real calendar_object)
        │ expand(rule, visible window)
        ▼
  virtual occurrences  ── id: event:<series-id>:<iso-date> ──►  drawn in day cells
```

- **Virtual occurrences** are computed for the visible months only, exactly as the
  scene already culls month views. They carry a derived id so selection, hit testing
  and the inspector work on them unchanged, and they cost nothing to store.
- **Materialised occurrences** are `calendar_object` rows carrying
  `series_id` + `occurrence_date`. When expanding, an occurrence whose date has a
  materialised row is **skipped** — the row is drawn instead. This is `RECURRENCE-ID`.
- **Deleting one occurrence** writes a materialised row flagged `deleted`, which
  suppresses the virtual one. This is `EXDATE`, expressed as the same mechanism so
  there is one rule rather than two.
- **Deleting the series** deletes the series row; its overrides cascade.

### Position: the spatial half of the answer

This is where a desk differs from a calendar list.

- A virtual occurrence has **no stored position**. It is drawn in its day cell, laid
  out by the same code that lays out today's sample chips.
- Dragging an occurrence out of its cell materialises it **with explicit `x`/`y`**.
  From then on it is an ordinary desk object that happens to know which series it
  came from.
- The same holds for the series' own occurrences that were never moved: they follow
  the calendar when the user navigates, because their position is a function of their
  date and the month-grid mapping.

That yields one sentence a user could actually be told: *a repeating event sits in
its day until you move it; once you move it, it stays where you put it.*

## Editing a series

Editing any occurrence must ask the question every calendar app asks, because there
is no safe default:

| Choice | Effect |
| --- | --- |
| **This occurrence** | Materialise an override for that date. |
| **This and following** | Close the current series with `UNTIL` = the day before, and create a new series carrying the edit. Overrides after the split point move to the new series. |
| **All occurrences** | Edit the series row. Existing overrides are **kept**, because they represent deliberate user work. |

### Orphaned overrides

If the rule changes so that a materialised date no longer occurs, its override is
**orphaned, not deleted**. A moved-and-annotated occurrence is real user content and
must not vanish because a rule was edited. Orphans keep their position and are shown
on the desk as ordinary objects, detached from the series. Silent deletion is the one
behaviour this design forbids outright.

## Schema (migration 2)

```text
event                           recurrence_rule
-------------------------       -------------------------
id (calendar_object.id)         id
title                           event_id
time_label   (nullable)         rrule        -- RFC 5545 string, validated subset
all_day                         dtstart      -- anchor date (floating)
variant                         created_at
color
reminder_at  (nullable)
series_id    (nullable)  ─────► the event this occurrence overrides
occurrence_date (nullable)      -- set together with series_id
deleted      (0/1)              -- tombstone for a suppressed occurrence
```

- `series_id`/`occurrence_date` are both null for a normal event, both set for a
  materialised occurrence. A unique index on `(series_id, occurrence_date)` makes
  "one override per date" a database guarantee rather than a convention.
- Geometry, dates and z-order continue to live on `calendar_object`; `event` holds
  only what is specific to events, per the architecture record's split.

## What version 1 does not do

- No sub-daily recurrence, no time zones, no DST rules.
- No `.ics` import (export is Milestone 5 and only needs the subset above).
- No "move the whole series by a week" gesture; the series is edited through the
  inspector, not by dragging one of its occurrences.
- No recurring tasks or notes. Recurrence attaches to events only in v1.

## Recommendation on the parked schema-v1 scope question

The architecture record defines schema v1 as seven tables; the roadmap currently says
five of them "land as later migrations alongside their features". That wording has
been unresolved since September 16 and this is the moment it bites, because `event`
and `recurrence_rule` are the first of those five to arrive.

**Recommended:** restate it plainly rather than leave the ADR looking unmet —
Milestone 3 delivered *versioned migration machinery* plus the `desk` and
`calendar_object` schema; each remaining table ships as its own migration with the
feature that needs it (`event` + `recurrence_rule` here as migration 2, `attachment`
with image import, `tag` and `setting` with search and preferences). The alternative —
creating all seven now — means designing `event` before this record is accepted and
`attachment` before the import flow exists, which is how speculative columns are born.

**Accepted** on September 17, 2026: schema v1 grows one migration per feature.
Milestone 3 delivered the migration machinery plus `desk` and `calendar_object`;
`event` and `recurrence_rule` arrive here as migration 2.

## References

- [Architecture record — open questions](Infinite-Desk-Calendar-Architecture-Decisions.md)
- [Canvas renderer design](design-canvas-renderer.md) — month culling and derived chip ids
- [RFC 5545 §3.8.5](https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.5) — `RRULE`, `EXDATE`, `RDATE`
- [RFC 5545 §3.8.4.4](https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.4.4) — `RECURRENCE-ID`
- [rrule.js](https://github.com/jkbrzt/rrule) (evaluated, not adopted for v1)
