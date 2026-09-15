/**
 * The week sheet (Sep 14–20): day columns over an hour ruler, expanded
 * event blocks, the Kyoto range bar, and loose handwriting.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { DbEventObject, DbRangeBar, DbStickyNote } from '@infinite-desk/deskbound';

import { WEEK_BLOCKS } from '../data/sample-desk';

/** Column width and hour-row height of the week grid, in pixels. */
const COL_WIDTH = 131;
const GUTTER = 46;
const HOUR_HEIGHT = 44;
const FIRST_HOUR = 8;

@Component({
  selector: 'app-week-sheet',
  imports: [DbEventObject, DbRangeBar, DbStickyNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Week sheet',
    style:
      'position:absolute;left:48px;top:24px;width:1080px;display:block;background:var(--surface-paper);border:1px solid var(--border);box-shadow:var(--shadow-1);padding:18px 22px 22px;box-sizing:border-box',
  },
  template: `
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px">
      <span style="font:600 26px var(--font-calendar)">September 14–20</span>
      <span
        style="font:var(--text-caption);color:var(--ink-muted);text-transform:uppercase;letter-spacing:var(--tracking-metadata)"
        >Week 38 · 2026</span
      >
    </div>
    <div
      style="position:relative;margin-left:46px;margin-bottom:8px;display:grid;grid-template-columns:repeat(7,1fr)"
    >
      @for (day of days; track day.date) {
        <div style="padding:4px 8px;border-left:1px solid var(--divider)">
          <span
            style="font:600 20px var(--font-calendar)"
            [style.color]="day.date === 15 ? 'var(--accent)' : 'var(--ink-primary)'"
            >{{ day.date }}</span
          >
          <span style="font:var(--text-caption);color:var(--ink-muted);margin-left:5px">{{
            day.label
          }}</span>
        </div>
      }
    </div>
    <div style="position:relative;margin-left:46px;height:36px">
      <div style="position:absolute;top:4px" [style.left.px]="kyoto.left" [style.width.px]="kyoto.width">
        <db-range-bar kind="travel" label="Kyoto trip" />
      </div>
    </div>
    <div style="position:relative;height:530px">
      @for (hour of hours; track hour.label) {
        <div
          style="position:absolute;left:0;right:0;border-top:1px solid var(--divider)"
          [style.top.px]="hour.top"
        >
          <span
            style="position:absolute;left:0;top:-7px;width:40px;font:var(--text-numeral-sm);color:var(--ink-muted)"
            >{{ hour.label }}</span
          >
        </div>
      }
      @for (col of columns; track col) {
        <div
          style="position:absolute;top:0;bottom:0;border-left:1px solid var(--divider)"
          [style.left.px]="col"
        ></div>
      }
      @for (block of blocks; track block.event.title) {
        <div style="position:absolute" [style.left.px]="block.left" [style.top.px]="block.top" [style.width.px]="block.width">
          <db-event-object
            [title]="block.event.title"
            [time]="block.event.time ?? null"
            [color]="block.event.color"
            [variant]="block.event.variant ?? 'timed'"
            [recurring]="!!block.event.recurring"
            [reminder]="!!block.event.reminder"
            [expanded]="true"
            [meta]="block.event.meta"
          />
        </div>
      }
      <div style="position:absolute;top:60px;transform:rotate(-2deg)" [style.left.px]="wednesdayX">
        <db-sticky-note color="mint" variant="compact" [hand]="true">pick up prints &#64; lab</db-sticky-note>
      </div>
      <div
        style="position:absolute;top:300px;font-family:var(--font-hand);font-size:17px;color:var(--ink-secondary);transform:rotate(-1deg)"
        [style.left.px]="thursdayX"
      >
        pack light — one bag!
      </div>
    </div>
  `,
})
export class WeekSheet {
  /** Day headers for Sep 14–20. */
  protected readonly days = [
    { date: 14, label: 'Mon' },
    { date: 15, label: 'Tue' },
    { date: 16, label: 'Wed' },
    { date: 17, label: 'Thu' },
    { date: 18, label: 'Fri' },
    { date: 19, label: 'Sat' },
    { date: 20, label: 'Sun' },
  ];

  /** Hour ruler rows from 08:00 to 19:00. */
  protected readonly hours = Array.from({ length: 12 }, (_, i) => ({
    top: i * HOUR_HEIGHT,
    label: `${FIRST_HOUR + i}:00`,
  }));

  /** X offsets of the seven day-column separators. */
  protected readonly columns = Array.from({ length: 7 }, (_, i) => GUTTER + i * COL_WIDTH);

  /** Positioned event blocks. */
  protected readonly blocks = WEEK_BLOCKS.map((block) => ({
    left: GUTTER + block.col * COL_WIDTH + 4,
    top: (block.hour - FIRST_HOUR) * HOUR_HEIGHT,
    width: COL_WIDTH - 10,
    event: block.event,
  }));

  /** Kyoto range spanning Thursday–Saturday. */
  protected readonly kyoto = { left: GUTTER + 3 * COL_WIDTH + 4, width: COL_WIDTH * 3 - 10 };
  protected readonly wednesdayX = GUTTER + 2 * COL_WIDTH + 8;
  protected readonly thursdayX = GUTTER + 3 * COL_WIDTH + 8;
}
