import { describe, expect, it } from 'vitest';

import type { EventRecord } from '@infinite-desk/domain';

import { toEventRecord, toEventWire, type EventWire } from './event-wire';

const series: EventRecord = {
  id: 'seminar',
  title: 'Seminar',
  timeLabel: '14:00',
  color: 'blue',
  date: new Date(2026, 8, 1),
  rrule: 'FREQ=WEEKLY;BYDAY=TU',
};

describe('event wire translation', () => {
  it('writes floating dates as plain calendar text', () => {
    const wire = toEventWire(series);
    // No timestamp, no zone: the desk is laid out by day.
    expect(wire.date).toBe('2026-09-01');
    expect(wire.rrule).toBe('FREQ=WEEKLY;BYDAY=TU');
  });

  it('round-trips a series unchanged', () => {
    expect(toEventRecord(toEventWire(series))).toEqual({
      ...series,
      variant: undefined,
      seriesId: undefined,
      occurrenceDate: undefined,
      deleted: false,
      placed: false,
      x: 0,
      y: 0,
      width: 200,
      height: 24,
      rotation: 0,
    });
  });

  it('round-trips an override, keeping the date it replaces', () => {
    const moved: EventRecord = {
      ...series,
      id: 'moved',
      rrule: undefined,
      seriesId: 'seminar',
      occurrenceDate: new Date(2026, 8, 15),
      placed: true,
      x: 900,
      y: 400,
    };
    const back = toEventRecord(toEventWire(moved));
    expect(back.seriesId).toBe('seminar');
    expect(back.occurrenceDate).toEqual(new Date(2026, 8, 15));
    expect(back.placed).toBe(true);
    expect(back.x).toBe(900);
  });

  it('reads nulls back as absent rather than null', () => {
    const wire: EventWire = {
      id: 'plain',
      title: 'Dentist',
      timeLabel: null,
      color: 'teal',
      variant: null,
      date: '2026-09-15',
      rrule: null,
      seriesId: null,
      occurrenceDate: null,
      deleted: false,
      placed: false,
      x: 0,
      y: 0,
      width: 200,
      height: 24,
      rotation: 0,
    };
    const record = toEventRecord(wire);
    expect(record.timeLabel).toBeUndefined();
    expect(record.rrule).toBeUndefined();
    expect(record.occurrenceDate).toBeUndefined();
    expect(record.date).toEqual(new Date(2026, 8, 15));
  });
});
