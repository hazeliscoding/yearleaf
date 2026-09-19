import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Occurrence } from '@infinite-desk/domain';

import { SelectionStore } from './selection-store';

function occurrenceOf(id: string): Occurrence {
  return {
    id,
    date: new Date(2026, 8, 15),
    event: { id, title: 'Dentist', color: 'teal', date: new Date(2026, 8, 15) },
    virtual: false,
  };
}

describe('SelectionStore', () => {
  let store: SelectionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(SelectionStore);
  });

  it('drops the occurrence when the selection moves to another event', () => {
    store.select('event', 'seeded');
    store.occurrence.set(occurrenceOf('seeded'));

    store.select('event', 'freshly-created');

    // The occurrence is what the inspector edits through, and it used to
    // survive a change of selection because only non-event kinds cleared it.
    // A selection naming one event while the occurrence named another is not
    // an inspector showing nothing — it is an inspector writing somewhere.
    expect(store.occurrence()).toBeNull();
  });

  it('drops it for a desk object too, as it always did', () => {
    store.select('event', 'seeded');
    store.occurrence.set(occurrenceOf('seeded'));

    store.select('sticky', 's1');

    expect(store.occurrence()).toBeNull();
  });
});
