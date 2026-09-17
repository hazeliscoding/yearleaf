/**
 * Translation between the domain's `EventRecord` and the wire shape the Tauri
 * commands speak.
 *
 * The database stores floating calendar dates as `YYYY-MM-DD` text, because a
 * desk is laid out by day and an instant would drag time zones into a model
 * that deliberately has none.
 */

import type { EventRecord, EventVariant, StationeryColor } from '@infinite-desk/domain';

/** An event exactly as it crosses the IPC boundary. */
export interface EventWire {
  id: string;
  title: string;
  timeLabel: string | null;
  color: string;
  variant: string | null;
  date: string;
  rrule: string | null;
  seriesId: string | null;
  occurrenceDate: string | null;
  deleted: boolean;
  placed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** `YYYY-MM-DD` for a floating date. */
function toWireDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Parses `YYYY-MM-DD` into a local-midnight date. */
function fromWireDate(text: string): Date {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Converts a stored event into its domain form. */
export function toEventRecord(wire: EventWire): EventRecord {
  return {
    id: wire.id,
    title: wire.title,
    timeLabel: wire.timeLabel ?? undefined,
    color: wire.color as StationeryColor,
    variant: (wire.variant as EventVariant | null) ?? undefined,
    date: fromWireDate(wire.date),
    rrule: wire.rrule ?? undefined,
    seriesId: wire.seriesId ?? undefined,
    occurrenceDate: wire.occurrenceDate ? fromWireDate(wire.occurrenceDate) : undefined,
    deleted: wire.deleted,
    placed: wire.placed,
    x: wire.x,
    y: wire.y,
    width: wire.width,
    height: wire.height,
    rotation: wire.rotation,
  };
}

/** Converts a domain event into the wire shape the commands accept. */
export function toEventWire(event: EventRecord): EventWire {
  return {
    id: event.id,
    title: event.title,
    timeLabel: event.timeLabel ?? null,
    color: event.color,
    variant: event.variant ?? null,
    date: toWireDate(event.date),
    rrule: event.rrule ?? null,
    seriesId: event.seriesId ?? null,
    occurrenceDate: event.occurrenceDate ? toWireDate(event.occurrenceDate) : null,
    deleted: event.deleted ?? false,
    placed: event.placed ?? false,
    x: event.x ?? 0,
    y: event.y ?? 0,
    width: event.width ?? 200,
    height: event.height ?? 24,
    rotation: event.rotation ?? 0,
  };
}
