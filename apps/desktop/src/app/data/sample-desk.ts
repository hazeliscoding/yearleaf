/**
 * The lived-in September 2026 sample desk from the design reference.
 *
 * This seeds the first milestone (there is no SQLite adapter yet); it is
 * deliberately dense so canvas work is exercised against realistic content,
 * per the testing strategy's "lived-in desks" requirement.
 */

import { MONTH_STRIDE_X, monthOrigin, type DayContent } from '@infinite-desk/canvas';
import type { DeskObject } from '@infinite-desk/domain';
import type { DbPaletteGroup } from '@infinite-desk/deskbound';

export type { DayContent };

/** World origin of the sample month (September 2026). */
const SEPT = monthOrigin(2026, 8);
/** Open desk space east of the calendar columns where the floats live. */
const DESK_X = 3 * MONTH_STRIDE_X + 80;

/**
 * Day-content provider for the scene: the lived-in September 2026 sample.
 * Every other month renders as empty paper.
 */
export function sampleDayContent(date: Date): DayContent | null {
  if (date.getFullYear() !== 2026 || date.getMonth() !== 8) return null;
  return MONTH_CONTENT[date.getDate()] ?? null;
}

/** Day-of-month → cell content for September 2026. */
export const MONTH_CONTENT: Readonly<Record<number, DayContent>> = {
  1: { tasks: [{ label: 'Pay electric bill', due: '1st' }] },
  2: { events: [{ time: '10:00', title: 'Studio day', color: 'violet' }] },
  3: { hand: 'call Mom' },
  4: {
    tasks: [{ label: 'Send invoice', due: '4th', priority: 'high' }],
    hand: 'start zine spreads',
  },
  5: { img: 'trail run' },
  8: {
    events: [
      { time: '09:30', title: 'Client review', color: 'blue', recurring: true, meta: '45 min · video' },
      { time: '18:00', title: 'Ceramics class', color: 'olive', meta: 'Studio B' },
    ],
  },
  10: { events: [{ time: '20:00', title: 'Nils Frahm', color: 'rose' }] },
  11: { events: [{ title: 'Zine deadline', color: 'red', variant: 'allday' }] },
  12: { img: 'ref shot' },
  14: { events: [{ time: '09:30', title: 'Client review', color: 'blue', recurring: true }] },
  15: {
    events: [
      {
        time: '14:00',
        title: 'Dentist',
        color: 'teal',
        variant: 'tentative',
        reminder: true,
        meta: 'Dr. Okada · 20 min walk',
      },
    ],
    tasks: [{ label: 'Order paper stock' }],
  },
  17: { range: { kind: 'travel', label: 'Kyoto →', edge: 'start' } },
  18: {
    range: { kind: 'travel', label: '', edge: 'middle' },
    events: [{ title: 'Anniversary', color: 'coral', variant: 'allday' }],
  },
  19: { range: { kind: 'travel', label: '', edge: 'end' } },
  20: { events: [{ time: '19:00', title: 'Game night', color: 'indigo' }] },
  21: { range: { kind: 'deadline', label: 'Print run', edge: 'start' } },
  22: {
    range: { kind: 'deadline', label: '', edge: 'end' },
    events: [{ time: '09:30', title: 'Client review', color: 'blue', recurring: true }],
  },
  23: { hand: 'don’t schedule anything here' },
  25: { events: [{ time: '19:30', title: 'Print fair opening', color: 'rose' }] },
  26: { events: [{ title: 'Hike — Mt. Tam', color: 'green', variant: 'allday' }] },
  28: { events: [{ time: '09:00', title: 'Deploy website', color: 'teal' }] },
  29: { events: [{ time: '08:00', title: 'Morning pages', color: 'olive', variant: 'completed' }] },
  30: { tasks: [{ label: 'Finish book', due: '30th' }] },
};

/** Freely positioned objects parked on the open desk beside September 2026. */
export const INITIAL_FLOATS: readonly DeskObject[] = [
  {
    id: 's1',
    x: DESK_X,
    y: SEPT.y + 40,
    width: 260,
    height: 190,
    rotation: 0,
    payload: {
      kind: 'sticky',
      text: 'call the framer about the print — thu?',
      color: 'yellow',
      hand: true,
      pinned: true,
    },
  },
  {
    id: 's2',
    x: DESK_X + 40,
    y: SEPT.y + 290,
    width: 260,
    height: 140,
    rotation: -1.5,
    payload: {
      kind: 'sticky',
      text: '',
      color: 'mint',
      items: [
        { label: 'Water plants', done: true },
        { label: 'Book flights' },
        { label: 'Renew passport' },
      ],
    },
  },
  {
    id: 's3',
    x: DESK_X + 10,
    y: SEPT.y + 490,
    width: 190,
    height: 130,
    rotation: 1,
    payload: {
      kind: 'sticky',
      text: 'order flowers before the 18th',
      color: 'coral',
      hand: true,
      compact: true,
    },
  },
  {
    id: 'img1',
    x: DESK_X + 20,
    y: SEPT.y + 680,
    width: 220,
    height: 178,
    rotation: 0,
    payload: { kind: 'image', frame: 'taped', caption: 'moodboard' },
  },
  {
    id: 'f1',
    x: DESK_X + 20,
    y: SEPT.y + 920,
    width: 300,
    height: 64,
    rotation: 0,
    payload: { kind: 'file', fileKind: 'pdf', name: 'Fair-floorplan.pdf', meta: '1.2 MB' },
  },
  {
    id: 't1',
    x: DESK_X,
    y: SEPT.y + 1050,
    width: 470,
    height: 90,
    rotation: 0,
    payload: { kind: 'text', text: 'don’t forget: fair setup starts the 24th' },
  },
];

/** One row of the universal search index. */
export interface SearchEntry {
  /** Result label. */
  readonly label: string;
  /** Secondary metadata (date, size, source). */
  readonly meta: string;
  /** Color-dot CSS value. */
  readonly dot: string;
  /** Day of September 2026 the result jumps to. */
  readonly day: number;
  /** Extra keywords matched besides the label. */
  readonly kw: string;
}

/** Static search index over the sample desk (events, notes, OCR, files). */
export const SEARCH_INDEX: readonly SearchEntry[] = [
  { label: 'Dentist — Dr. Okada', meta: 'Tue Sep 15 · 14:00', dot: 'var(--stationery-teal)', day: 15, kw: 'dentist okada appointment' },
  { label: 'Zine deadline', meta: 'Fri Sep 11 · all day', dot: 'var(--stationery-red)', day: 11, kw: 'zine deadline print' },
  { label: 'Kyoto trip', meta: 'Sep 17–19', dot: 'var(--stationery-teal)', day: 17, kw: 'kyoto trip travel japan' },
  { label: 'Print fair opening', meta: 'Fri Sep 25 · 19:30', dot: 'var(--stationery-rose)', day: 25, kw: 'print fair opening' },
  { label: '“call the framer about the print — thu?”', meta: 'Sticky note · OCR', dot: 'var(--stationery-yellow)', day: 24, kw: 'framer print sticky call' },
  { label: '“don’t schedule anything here”', meta: 'Handwriting · Sep 23', dot: 'var(--stationery-olive)', day: 23, kw: 'schedule handwriting note dont' },
  { label: 'Fair-floorplan.pdf', meta: 'Attachment · 1.2 MB', dot: 'var(--stationery-indigo)', day: 25, kw: 'fair floorplan pdf file' },
  { label: 'Anniversary', meta: 'Fri Sep 18', dot: 'var(--stationery-coral)', day: 18, kw: 'anniversary flowers' },
  { label: 'Concert — Nils Frahm', meta: 'Thu Sep 10 · 20:00', dot: 'var(--stationery-rose)', day: 10, kw: 'concert music nils frahm' },
  { label: 'Deploy website', meta: 'Mon Sep 28 · 09:00', dot: 'var(--stationery-teal)', day: 28, kw: 'deploy website launch' },
];

/** Command palette content. */
export const PALETTE_GROUPS: readonly DbPaletteGroup[] = [
  {
    label: 'Go to',
    items: [
      { icon: 'calendar', label: 'Next Friday', meta: 'Sep 18, 2026', selected: true },
      { icon: 'calendar', label: 'Today', meta: 'Sep 15, 2026', shortcut: ['⇧', 'T'] },
      { icon: 'calendar', label: 'October 2026' },
    ],
  },
  {
    label: 'Commands',
    items: [
      { icon: 'sticky-note', label: 'New sticky note', shortcut: ['N'] },
      { icon: 'calendar-plus', label: 'New event', shortcut: ['E'] },
      { icon: 'zoom-in', label: 'Fit month', shortcut: ['⇧', '1'] },
    ],
  },
  {
    label: 'Recent',
    items: [{ icon: 'history', label: 'Jump to Kyoto trip', meta: 'Sep 17–19' }],
  },
];

