/**
 * Renders one month (header band + fixed 7×6 day grid) into a PixiJS
 * container, with progressive detail per zoom tier:
 *
 * - `year`  — title, weekend/outside tints, density dots for days with content
 * - `month` — numerals, today stamp, event/task chips, ranges, handwriting, photos
 * - `week`  — month detail + event metadata lines
 * - `day`   — same as week (glyph emphasis is a later refinement)
 */

import { Container, Graphics, Text } from 'pixi.js';

import {
  daysInMonth,
  isSameDay,
  mondayIndex,
  type EventItem,
  type RangeSegment,
  type TaskItem,
} from '@infinite-desk/domain';

import {
  CELL_H,
  CELL_W,
  MONTH_COLS,
  MONTH_H,
  MONTH_HEADER_H,
  MONTH_ROWS,
  MONTH_W,
  monthOrigin,
  type WorldRect,
} from '../month-layout';
import type { ZoomTier } from '../viewport';
import { eventChipId, type DayContentProvider } from './scene-types';
import { mixColors, type ThemeTokens } from './theme';

/** An event chip's hit rect, registered with the spatial index. */
export interface ChipRegistration {
  readonly id: string;
  readonly rect: WorldRect;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Inner padding of a day cell, world units. */
const PAD = 12;
/** Y offset where cell content starts (below the numeral). */
const CONTENT_TOP = 56;
const PRIORITY_KEY = { high: 'danger', med: 'warning', low: 'info' } as const;

/** Result of building a month: its display container plus chip hit rects. */
export interface MonthViewResult {
  readonly container: Container;
  readonly chips: readonly ChipRegistration[];
}

/**
 * Builds the display container for a month at the given detail tier.
 * The container is positioned at the month's world origin.
 */
export function buildMonthView(
  year: number,
  monthIndex: number,
  tier: ZoomTier,
  theme: ThemeTokens,
  dayContent: DayContentProvider,
  today: Date,
): MonthViewResult {
  const origin = monthOrigin(year, monthIndex);
  const container = new Container();
  container.position.set(origin.x, origin.y);
  const chips: ChipRegistration[] = [];

  const lead = mondayIndex(new Date(year, monthIndex, 1));
  const days = daysInMonth(year, monthIndex);

  // ---- Sheet background, cell tints, grid lines -------------------------
  const bg = new Graphics();
  bg.rect(0, 0, MONTH_W, MONTH_H).fill(theme.surfacePaper);
  for (let slot = 0; slot < MONTH_COLS * MONTH_ROWS; slot++) {
    const col = slot % MONTH_COLS;
    const outside = slot < lead || slot >= lead + days;
    if (outside || col > 4) {
      bg.rect(col * CELL_W, MONTH_HEADER_H + Math.floor(slot / MONTH_COLS) * CELL_H, CELL_W, CELL_H)
        .fill(theme.surfaceCanvas);
    }
  }
  for (let col = 0; col <= MONTH_COLS; col++) {
    bg.moveTo(col * CELL_W, MONTH_HEADER_H).lineTo(col * CELL_W, MONTH_H);
  }
  for (let row = 0; row <= MONTH_ROWS; row++) {
    bg.moveTo(0, MONTH_HEADER_H + row * CELL_H).lineTo(MONTH_W, MONTH_HEADER_H + row * CELL_H);
  }
  bg.stroke({ width: 1.5, color: theme.divider });
  bg.rect(0, 0, MONTH_W, MONTH_H).stroke({ width: 2, color: theme.border });
  container.addChild(bg);

  // ---- Header band ------------------------------------------------------
  const title = new Text({
    text: MONTH_NAMES[monthIndex],
    style: { fontFamily: theme.fontCalendar, fontSize: 72, fontWeight: '600', fill: theme.inkPrimary },
  });
  title.position.set(28, 26);
  container.addChild(title);
  const yearText = new Text({
    text: String(year),
    style: { fontFamily: theme.fontCalendar, fontSize: 72, fontWeight: '400', fill: theme.inkMuted },
  });
  yearText.position.set(title.x + title.width + 24, 26);
  container.addChild(yearText);

  if (tier !== 'year') {
    for (let col = 0; col < MONTH_COLS; col++) {
      const label = new Text({
        text: WEEKDAYS[col],
        style: {
          fontFamily: theme.fontUI,
          fontSize: 18,
          fontWeight: '500',
          letterSpacing: 1.2,
          fill: col > 4 ? theme.inkDisabled : theme.inkMuted,
        },
      });
      label.position.set(col * CELL_W + PAD, MONTH_HEADER_H - 32);
      container.addChild(label);
    }
  }

  // ---- Day cells ---------------------------------------------------------
  for (let slot = 0; slot < MONTH_COLS * MONTH_ROWS; slot++) {
    const day = slot - lead + 1;
    const outside = day < 1 || day > days;
    const cellX = (slot % MONTH_COLS) * CELL_W;
    const cellY = MONTH_HEADER_H + Math.floor(slot / MONTH_COLS) * CELL_H;
    const date = new Date(year, monthIndex, day);
    const content = outside ? null : dayContent(date);

    if (tier === 'year') {
      if (!outside && content && hasAnyContent(content)) {
        const dot = new Graphics();
        const color = content.events?.[0]
          ? theme.stationery[content.events[0].color].fill
          : theme.accent;
        dot.circle(cellX + CELL_W / 2, cellY + CELL_H / 2, 16).fill(color);
        container.addChild(dot);
      }
      continue;
    }

    // Numeral (with today stamp).
    const isToday = !outside && isSameDay(date, today);
    const numeral = new Text({
      text: String(outside ? date.getDate() : day),
      style: {
        fontFamily: theme.fontCalendar,
        fontSize: 30,
        fontWeight: '500',
        fill: outside ? theme.inkDisabled : isToday ? theme.inkInverse : theme.inkSecondary,
      },
    });
    numeral.position.set(cellX + PAD + 6, cellY + PAD);
    if (isToday) {
      const stamp = new Graphics();
      stamp
        .roundRect(cellX + PAD - 2, cellY + PAD - 5, numeral.width + 18, numeral.height + 10, 8)
        .fill(theme.accent);
      container.addChild(stamp);
      numeral.x = cellX + PAD + 7;
    }
    container.addChild(numeral);

    if (!content) continue;

    // Content stack: events → tasks → range → handwriting → photo.
    let y = cellY + CONTENT_TOP;
    const bottom = cellY + CELL_H - 8;
    const showMeta = tier === 'week' || tier === 'day';

    (content.events ?? []).forEach((event, index) => {
      const height = showMeta && event.meta ? 60 : 36;
      if (y + height > bottom) return;
      drawEventChip(container, theme, event, cellX + PAD, y, CELL_W - 2 * PAD, height, showMeta);
      chips.push({
        id: eventChipId(date, index),
        rect: { x: origin.x + cellX + PAD, y: origin.y + y, width: CELL_W - 2 * PAD, height },
      });
      y += height + 6;
    });

    for (const task of content.tasks ?? []) {
      if (y + 36 > bottom) break;
      drawTaskChip(container, theme, task, cellX + PAD, y, CELL_W - 2 * PAD, 36);
      y += 42;
    }

    if (content.range && y + 32 <= bottom) {
      drawRangeBar(container, theme, content.range, cellX, y, 32);
      y += 38;
    }

    if (content.hand && y + 30 <= bottom) {
      const hand = new Text({
        text: content.hand,
        style: {
          fontFamily: theme.fontHand,
          fontSize: 26,
          fill: theme.inkSecondary,
          wordWrap: true,
          wordWrapWidth: CELL_W - 2 * PAD,
          lineHeight: 30,
        },
      });
      hand.position.set(cellX + PAD, y);
      container.addChild(hand);
      y += hand.height + 6;
    }

    if (content.img && y + 70 <= bottom) {
      const photo = new Graphics();
      photo
        .roundRect(cellX + PAD, y, CELL_W - 2 * PAD, 66, 4)
        .fill(mixColors(theme.stationery.teal.soft, theme.stationery.blue.soft, 0.5));
      container.addChild(photo);
      const caption = new Text({
        text: content.img,
        style: { fontFamily: theme.fontUI, fontSize: 16, fill: theme.inkSecondary },
      });
      caption.position.set(cellX + CELL_W / 2 - caption.width / 2, y + 68);
      container.addChild(caption);
    }
  }

  return { container, chips };
}

/** `true` when a day has anything worth a density dot at year tier. */
function hasAnyContent(content: {
  events?: readonly unknown[];
  tasks?: readonly unknown[];
  range?: unknown;
  hand?: string;
  img?: string;
}): boolean {
  return !!(content.events?.length || content.tasks?.length || content.range || content.hand || content.img);
}

/** Truncates text to roughly fit a pixel width (Pixi has no ellipsis). */
function truncate(text: string, maxWidth: number, approxCharWidth: number): string {
  const maxChars = Math.max(3, Math.floor(maxWidth / approxCharWidth));
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

/**
 * Circular-arrow marker showing a chip belongs to a repeating series.
 *
 * Drawn rather than typeset: a glyph character would depend on font coverage,
 * and the desk has already been bitten by missing glyphs rendering as tofu.
 * Without this a series is indistinguishable from unrelated events sharing a
 * name — which matters most right before someone edits one and changes them all.
 */
function drawRepeatMarker(
  parent: Container,
  x: number,
  y: number,
  size: number,
  color: number,
  alpha: number,
): void {
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;
  const gapStart = -Math.PI / 3;
  const marker = new Graphics();
  marker
    .arc(cx, cy, radius * 0.8, gapStart, Math.PI * 1.55)
    .stroke({ width: 1.8, color, alpha, cap: 'round' });
  // Arrowhead closing the loop, pointing along the arc at its open end.
  const tipX = cx + Math.cos(gapStart) * radius * 0.8;
  const tipY = cy + Math.sin(gapStart) * radius * 0.8;
  const head = radius * 0.62;
  marker
    .moveTo(tipX + head * 0.1, tipY - head)
    .lineTo(tipX + head, tipY + head * 0.15)
    .lineTo(tipX - head * 0.65, tipY + head * 0.3)
    .fill({ color, alpha });
  parent.addChild(marker);
}

/** Draws one event chip (timed / all-day / tentative / completed). */
function drawEventChip(
  parent: Container,
  theme: ThemeTokens,
  event: EventItem,
  x: number,
  y: number,
  width: number,
  height: number,
  showMeta: boolean,
): void {
  const palette = theme.stationery[event.color];
  const variant = event.variant ?? 'timed';
  const chip = new Graphics();
  const alpha = variant === 'completed' ? 0.55 : 1;

  if (variant === 'allday') {
    chip.roundRect(x, y, width, height, 5).fill({ color: palette.fill, alpha });
  } else if (variant === 'tentative') {
    chip
      .roundRect(x, y, width, height, 5)
      .fill({ color: palette.soft, alpha: 0.6 })
      .stroke({ width: 2, color: palette.fill });
  } else {
    chip
      .roundRect(x, y, width, height, 5)
      .fill({ color: mixColors(theme.surfaceRaised, palette.fill, 0.28), alpha });
    chip.rect(x, y + 3, 5, height - 6).fill({ color: palette.fill, alpha });
  }
  parent.addChild(chip);

  const ink = variant === 'allday' ? palette.ink : theme.inkPrimary;
  // Trailing markers are reserved before the title is measured, so a long
  // title truncates around them rather than running underneath.
  const markerSize = 14;
  const markerSpace = event.recurring ? markerSize + 6 : 0;
  let textX = x + 14;
  if (event.time) {
    const time = new Text({
      text: event.time,
      style: { fontFamily: theme.fontCalendar, fontSize: 18, fontWeight: '500', fill: theme.inkSecondary },
    });
    time.position.set(textX, y + 8);
    time.alpha = alpha;
    parent.addChild(time);
    textX += time.width + 10;
  }
  const title = new Text({
    text: truncate(event.title, x + width - textX - 8 - markerSpace, 10),
    style: {
      fontFamily: theme.fontUI,
      fontSize: 20,
      fontWeight: variant === 'allday' ? '500' : '400',
      fill: ink,
    },
  });
  title.position.set(textX, y + 7);
  title.alpha = alpha;
  parent.addChild(title);
  if (variant === 'completed') {
    const strike = new Graphics();
    strike
      .moveTo(title.x, y + height / 2)
      .lineTo(title.x + title.width, y + height / 2)
      .stroke({ width: 1.5, color: ink, alpha: 0.7 });
    parent.addChild(strike);
  }

  if (event.recurring) {
    drawRepeatMarker(
      parent,
      x + width - markerSize - 8,
      y + (height - markerSize) / 2,
      markerSize,
      ink,
      alpha * 0.75,
    );
  }

  if (showMeta && event.meta) {
    const meta = new Text({
      text: truncate(event.meta, width - 22, 8),
      style: { fontFamily: theme.fontUI, fontSize: 16, fill: theme.inkMuted },
    });
    meta.position.set(x + 14, y + 34);
    parent.addChild(meta);
  }
}

/** Draws one task chip with checkbox, label, due hint, and priority dot. */
function drawTaskChip(
  parent: Container,
  theme: ThemeTokens,
  task: TaskItem,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const chip = new Graphics();
  chip
    .roundRect(x, y, width, height, 6)
    .fill(theme.surfaceRaised)
    .stroke({ width: 1.5, color: theme.border });

  const boxY = y + height / 2 - 9;
  if (task.done) {
    chip.roundRect(x + 10, boxY, 18, 18, 4).fill(theme.accent);
    chip
      .moveTo(x + 14, boxY + 9)
      .lineTo(x + 18, boxY + 13)
      .lineTo(x + 24, boxY + 5)
      .stroke({ width: 2, color: theme.inkInverse });
  } else {
    chip.roundRect(x + 10, boxY, 18, 18, 4).stroke({ width: 1.5, color: theme.inkMuted });
  }
  parent.addChild(chip);

  const label = new Text({
    text: truncate(task.label, width - 90, 9),
    style: {
      fontFamily: theme.fontUI,
      fontSize: 19,
      fill: task.done ? theme.inkMuted : theme.inkPrimary,
    },
  });
  label.position.set(x + 36, y + 8);
  parent.addChild(label);
  if (task.done) {
    const strike = new Graphics();
    strike
      .moveTo(label.x, y + height / 2)
      .lineTo(label.x + label.width, y + height / 2)
      .stroke({ width: 1.5, color: theme.inkMuted });
    parent.addChild(strike);
  }

  let rightX = x + width - 12;
  if (task.priority) {
    const dot = new Graphics();
    dot
      .circle(rightX - 5, y + height / 2, 5)
      .fill(theme[PRIORITY_KEY[task.priority]]);
    parent.addChild(dot);
    rightX -= 18;
  }
  if (task.due) {
    const due = new Text({
      text: task.due,
      style: { fontFamily: theme.fontUI, fontSize: 15, fill: theme.inkMuted },
    });
    due.position.set(rightX - due.width, y + 10);
    parent.addChild(due);
  }
}

/** Range colors per kind, matching the Deskbound RangeBar component. */
const RANGE_COLOR = { vacation: 'mint', project: 'indigo', travel: 'coral', deadline: 'red' } as const;

/** Draws one segment of a multi-day range bar, shaped by its edge. */
function drawRangeBar(
  parent: Container,
  theme: ThemeTokens,
  range: RangeSegment,
  cellX: number,
  y: number,
  height: number,
): void {
  const palette = theme.stationery[RANGE_COLOR[range.kind]];
  const x0 = range.edge === 'start' ? cellX + PAD : cellX;
  const x1 = range.edge === 'end' ? cellX + CELL_W - PAD : cellX + CELL_W;
  const radius = range.edge === 'middle' ? 0 : 8;
  const bar = new Graphics();
  bar
    .roundRect(x0, y, x1 - x0, height, radius)
    .fill(mixColors(theme.surfaceRaised, palette.fill, 0.45));
  // Square off the side that continues into the neighboring cell.
  if (range.edge === 'start') bar.rect(x1 - radius, y, radius, height).fill(mixColors(theme.surfaceRaised, palette.fill, 0.45));
  if (range.edge === 'end') bar.rect(x0, y, radius, height).fill(mixColors(theme.surfaceRaised, palette.fill, 0.45));
  parent.addChild(bar);

  if (range.label) {
    const label = new Text({
      text: range.label,
      style: { fontFamily: theme.fontUI, fontSize: 18, fontWeight: '500', fill: palette.ink },
    });
    label.position.set(x0 + 12, y + height / 2 - label.height / 2);
    parent.addChild(label);
  }
}
