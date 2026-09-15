/**
 * The day page (Tuesday, September 15): notebook-style page with an hour
 * ruler, timed events, the now line, tasks, ruled notes, attachments, and
 * related-item chips.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import {
  DbEventObject,
  DbFileAttachment,
  DbImageObject,
  DbTaskObject,
} from '@infinite-desk/deskbound';

import { DAY_TASKS } from '../data/sample-desk';

/** Hour-row height of the day ruler, in pixels. */
const HOUR_HEIGHT = 46;
const FIRST_HOUR = 8;

@Component({
  selector: 'app-day-page',
  imports: [DbEventObject, DbFileAttachment, DbImageObject, DbTaskObject],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Day page',
    style:
      'position:absolute;left:180px;top:24px;width:880px;display:block;background:var(--surface-paper);border:1px solid var(--border);box-shadow:var(--shadow-1);padding:26px 30px 30px;box-sizing:border-box',
  },
  template: `
    <div
      style="display:flex;align-items:baseline;gap:12px;border-bottom:2px solid var(--ink-primary);padding-bottom:10px;margin-bottom:16px"
    >
      <span style="font:600 30px var(--font-calendar)">Tuesday, September 15</span>
      <span
        style="font:var(--text-caption);color:var(--accent);text-transform:uppercase;letter-spacing:var(--tracking-metadata)"
        >Today</span
      >
      <span style="flex:1"></span>
      <span style="font:var(--text-caption);color:var(--ink-muted)">Week 38 · Day 258</span>
    </div>
    <div style="display:grid;grid-template-columns:300px 1fr;gap:28px">
      <div style="position:relative;height:560px">
        @for (hour of hours; track hour.label) {
          <div
            style="position:absolute;left:0;right:0;border-top:1px solid var(--divider)"
            [style.top.px]="hour.top"
          >
            <span style="position:absolute;left:0;top:-7px;font:11px var(--font-calendar);color:var(--ink-muted)">{{
              hour.label
            }}</span>
          </div>
        }
        <div style="position:absolute;left:44px;width:230px" [style.top.px]="dentistTop">
          <db-event-object
            time="14:00"
            title="Dentist"
            color="teal"
            variant="tentative"
            [reminder]="true"
            [expanded]="true"
            meta="Dr. Okada · 20 min walk"
          />
        </div>
        <div style="position:absolute;left:44px;width:230px" [style.top.px]="callTop">
          <db-event-object time="17:30" title="Call Mom" color="coral" />
        </div>
        <div
          style="position:absolute;left:0;right:10px;border-top:1.5px solid var(--accent)"
          [style.top.px]="nowTop"
        >
          <span style="position:absolute;right:0;top:-16px;font:var(--text-caption);color:var(--accent)">now</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <div style="font:600 15px var(--font-calendar);margin-bottom:6px">Tasks</div>
          @for (task of tasks; track task.label) {
            <db-task-object
              [label]="task.label"
              [done]="!!task.done"
              [due]="task.due ?? null"
              [priority]="task.priority ?? null"
              style="margin:0 6px 4px 0"
            />
          }
        </div>
        <div>
          <div style="font:600 15px var(--font-calendar);margin-bottom:6px">Notes</div>
          <div
            style="background-image:repeating-linear-gradient(transparent,transparent 27px,var(--rule-line) 27px,var(--rule-line) 28px);min-height:150px;font-family:var(--font-hand);font-size:19px;line-height:28px;color:var(--ink-primary);padding-top:2px"
          >
            zine spreads are almost done — ask R. about the risograph slot before Friday.<br />kyoto
            packing: camera, film ×6, sketchbook
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <db-file-attachment kind="pdf" name="zine-spreads-v3.pdf" meta="4.8 MB" />
          <db-image-object frame="taped" caption="spread 12–13" [width]="150" [height]="100" />
        </div>
        <div>
          <div
            style="font:var(--text-caption);color:var(--ink-muted);text-transform:uppercase;letter-spacing:var(--tracking-metadata);margin-bottom:5px"
          >
            Related
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            @for (chip of related; track chip) {
              <span
                style="font:var(--text-caption);border:1px solid var(--border);padding:3px 8px;border-radius:3px;background:var(--surface-raised)"
                >{{ chip }}</span
              >
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DayPage {
  /** Hour ruler rows from 08:00 to 19:00. */
  protected readonly hours = Array.from({ length: 12 }, (_, i) => ({
    top: i * HOUR_HEIGHT,
    label: `${FIRST_HOUR + i}:00`,
  }));

  protected readonly tasks = DAY_TASKS;
  protected readonly related = ['Zine deadline · Sep 11', 'Print run · Sep 21–22', 'Kyoto · Sep 17–19'];

  /** Vertical positions derived from the ruler scale. */
  protected readonly dentistTop = (14 - FIRST_HOUR) * HOUR_HEIGHT + 4;
  protected readonly callTop = (17.5 - FIRST_HOUR) * HOUR_HEIGHT;
  protected readonly nowTop = 3.4 * HOUR_HEIGHT;
}
