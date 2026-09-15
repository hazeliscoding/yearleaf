import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('renders the shell with toolbar brand, tool rail, and workspace', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Deskbound');
    expect(element.querySelector('app-tool-rail')).toBeTruthy();
    expect(element.querySelector('app-workspace')).toBeTruthy();
  });

  it('renders the September 2026 month sheet by default', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('September');
    expect(element.querySelector('app-month-sheet')).toBeTruthy();
  });
});
