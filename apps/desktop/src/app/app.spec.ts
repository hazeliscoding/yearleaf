import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('renders the shell with toolbar brand, tool rail, and workspace canvas', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Deskbound');
    expect(element.querySelector('app-tool-rail')).toBeTruthy();
    expect(element.querySelector('app-workspace canvas')).toBeTruthy();
  });

  it('shows the derived tier and navigation label in the toolbar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    // Default viewport starts at the month preset over the focused month.
    expect(element.querySelector('db-date-navigator')?.textContent).toContain('20');
    expect(element.querySelector('db-segmented')).toBeTruthy();
  });
});
