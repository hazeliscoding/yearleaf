/**
 * The September 2026 month sheet: header, weekday row, day-cell grid with
 * events/tasks/ranges/handwriting, an annotation arrow, and the empty-state
 * hint line.
 */

import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';

import { buildMonthGrid, isSameDay, type EventItem, type MonthGridCell } from '@infinite-desk/domain';
import {
  DbCalendarCell,
  DbEventObject,
  DbImageObject,
  DbMonthHeader,
  DbRangeBar,
  DbTaskObject,
  DbWeekHeader,
} from '@infinite-desk/deskbound';

import { MONTH_CONTENT, type DayContent } from '../data/sample-desk';
import { DeskStore } from '../state/desk-store';

/** A grid cell joined with its sample content. */
interface SheetCell extends MonthGridCell {
  readonly content: DayContent;
  readonly today: boolean;
}

/** An event click, identifying the day it lives on. */
export interface EventPick {
  readonly day: number;
  readonly event: EventItem;
}

@Component({
  selector: 'app-month-sheet',
  imports: [
    DbCalendarCell,
    DbEventObject,
    DbImageObject,
    DbMonthHeader,
    DbRangeBar,
    DbTaskObject,
    DbWeekHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Month sheet',
    style:
      'position:absolute;left:48px;top:24px;width:1010px;display:block;background:var(--surface-paper);border:1px solid var(--border);box-shadow:var(--shadow-1);padding:18px 22px 22px;box-sizing:border-box',
  },
  template: `
    <db-month-header month="September" [year]="2026" style="margin-bottom:10px" />
    <db-week-header />
    <div style="display:grid;grid-template-columns:repeat(7,1fr)">
      @for (cell of cells(); track cell.date.getTime()) {
        <db-calendar-cell
          [day]="cell.day"
          [today]="cell.today"
          [weekend]="cell.weekend"
          [outside]="!cell.inMonth"
          [selected]="cell.inMonth && desk.flashDay() === cell.day"
          [minHeight]="104"
          [style.animation]="
            cell.inMonth && desk.flashDay() === cell.day ? 'flashPulse 1s ease 2' : null
          "
        >
          @for (event of cell.content.events; track event.title) {
            <div style="cursor:pointer" (click)="pickEvent(cell, event, $event)">
              <db-event-object
                [title]="event.title"
                [time]="event.time ?? null"
                [color]="event.color"
                [variant]="event.variant ?? 'timed'"
                [recurring]="!!event.recurring"
                [reminder]="!!event.reminder"
              />
            </div>
          }
          @for (task of cell.content.tasks; track task.label) {
            <db-task-object
              [label]="task.label"
              [done]="!!task.done"
              [due]="task.due ?? null"
              [priority]="task.priority ?? null"
            />
          }
          @if (cell.content.range; as range) {
            <db-range-bar
              [kind]="range.kind"
              [label]="range.label"
              [style.margin-right]="range.edge !== 'end' ? '-7px' : null"
              [style.margin-left]="range.edge !== 'start' ? '-7px' : null"
              [style.border-radius]="rangeRadius(range.kind, range.edge)"
            />
          }
          @if (cell.content.hand; as hand) {
            <div
              style="font-family:var(--font-hand);font-size:15px;line-height:1.25;color:var(--ink-secondary);position:relative;z-index:2"
            >
              {{ hand }}
            </div>
          }
          @if (cell.content.img; as caption) {
            <db-image-object frame="taped" [caption]="caption" [width]="100" [height]="62" />
          }
        </db-calendar-cell>
      }
    </div>
    <svg
      width="1010"
      height="620"
      viewBox="0 0 1010 620"
      style="position:absolute;left:22px;top:84px;pointer-events:none"
      aria-hidden="true"
    >
      <path
        d="M 640 96 C 700 130, 700 160, 648 196"
        fill="none"
        stroke="var(--accent)"
        stroke-width="1.6"
        stroke-dasharray="5 4"
        opacity="0.85"
      ></path>
      <path d="M 654 188 L 646 197 L 658 199" fill="none" stroke="var(--accent)" stroke-width="1.6"></path>
    </svg>
    <div style="font:var(--text-caption);color:var(--ink-muted);margin-top:10px">
      Double-click anywhere to write. Press N for a sticky note. Drop an image onto the calendar.
    </div>
  `,
})
export class MonthSheet {
  protected readonly desk = inject(DeskStore);

  /** Emits when an event chip is clicked. */
  readonly eventPicked = output<EventPick>();

  /** The month grid joined with sample content; today derives from the clock. */
  protected readonly cells = computed<SheetCell[]>(() => {
    const now = new Date();
    return buildMonthGrid(2026, 8).map((cell) => ({
      ...cell,
      today: cell.inMonth && isSameDay(cell.date, now),
      content: (cell.inMonth && MONTH_CONTENT[cell.day]) || {},
    }));
  });

  /** Corner radius for a range segment, shaped by its edge and kind. */
  protected rangeRadius(kind: string, edge: 'start' | 'middle' | 'end'): string {
    if (edge === 'start') return '2px 0 0 2px';
    if (edge === 'middle') return '0';
    return kind === 'deadline' ? '0 9px 9px 0' : '0 2px 2px 0';
  }

  /** Forwards an event click without letting it bubble into canvas deselect. */
  protected pickEvent(cell: SheetCell, event: EventItem, domEvent: Event): void {
    domEvent.stopPropagation();
    this.eventPicked.emit({ day: cell.day, event });
  }
}
