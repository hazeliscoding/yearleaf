/**
 * Plain-data contracts between the application and the scene. PixiJS types
 * never appear here — this file defines everything that crosses the
 * package boundary.
 */

import type { EventItem, RangeSegment, TaskItem } from '@infinite-desk/domain';

import type { WorldRect } from '../month-layout';

/** Everything rendered inside one day cell. */
export interface DayContent {
  readonly events?: readonly EventItem[];
  readonly tasks?: readonly TaskItem[];
  readonly range?: RangeSegment;
  /** Handwritten scribble (handwriting typeface). */
  readonly hand?: string;
  /** Caption of a small taped photo in the cell. */
  readonly img?: string;
}

/**
 * Supplies cell content for any date. Must be cheap and deterministic —
 * the scene calls it once per in-month day of every visible month.
 */
export type DayContentProvider = (date: Date) => DayContent | null;

/** What a pointer position resolves to, top-most first. */
export type SceneHit =
  | {
      /** A freely positioned desk object. */
      kind: 'object';
      /** The desk object id. */
      id: string;
    }
  | {
      /** An event chip inside a day cell. */
      kind: 'event';
      /** Synthetic id `event:<iso-date>:<index>`. */
      id: string;
      /** The chip's day (local midnight). */
      date: Date;
      /** Index into that day's `events` array. */
      index: number;
    }
  | {
      /** A day cell (no object or chip on top). */
      kind: 'cell';
      /** The date the cell displays. */
      date: Date;
      /** `false` for an adjacent month's dimmed lead/trail slot. */
      inMonth: boolean;
    };

/** Synthetic id for an event chip. */
export function eventChipId(date: Date, index: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `event:${y}-${m}-${d}:${index}`;
}

/** Parses an event-chip id back into its date and index, or `null`. */
export function parseEventChipId(id: string): { date: Date; index: number } | null {
  const match = /^event:(\d{4})-(\d{2})-(\d{2}):(\d+)$/.exec(id);
  if (!match) return null;
  return {
    date: new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    index: Number(match[4]),
  };
}

/** Options for {@link CalendarSceneController.init}. */
export interface SceneInitOptions {
  /** The canvas element the scene renders into. */
  readonly canvas: HTMLCanvasElement;
  /** Initial canvas size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Content source for day cells. */
  readonly dayContent: DayContentProvider;
  /** The date rendered with the today stamp. */
  readonly today: Date;
}

export type { WorldRect };
