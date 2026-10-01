import { describe, expect, it } from 'vitest';
import { pickState } from '../../src/store/persistence';
import { emptyState } from '../../src/game/types';
import { freshState } from './helpers';

describe('save selection', () => {
  const real = { ...freshState(), updatedAt: 1000 };

  it('prefers whichever copy exists', () => {
    expect(pickState(null, real)).toBe(real);
    expect(pickState(real, null)).toBe(real);
    expect(pickState(null, null)).toBeNull();
  });

  it('never lets a throwaway hero on another device overwrite the server save', () => {
    const stray = { ...freshState(), profile: { ...real.profile!, heroName: 'Oops', createdAt: '2026-10-05' }, updatedAt: 9999 };
    expect(pickState(real, stray)).toBe(real);
  });

  it('uses the server when the local copy has no hero', () => {
    expect(pickState(real, { ...emptyState(), updatedAt: 5000 })).toBe(real);
  });

  it('treats a renamed hero as the same hero (offline logs are not dropped)', () => {
    const renamedOnServer = { ...real, profile: { ...real.profile!, heroName: 'New Name' }, updatedAt: 1500 };
    const offlineLocal = { ...real, foods: [{ id: 'x', date: '2026-10-01', meal: 'lunch' as const, name: 'x', calories: 1, protein: 1, loggedAt: 0 }], updatedAt: 3000 };
    expect(pickState(renamedOnServer, offlineLocal)).toBe(offlineLocal);
    const withId = { ...real, profile: { ...real.profile!, heroId: 'abc' }, updatedAt: 10 };
    const otherId = { ...real, profile: { ...real.profile!, heroId: 'def' }, updatedAt: 99 };
    expect(pickState(withId, otherId)).toBe(withId);
  });

  it('picks the newest copy of the same hero', () => {
    const newer = { ...real, updatedAt: 2000 };
    expect(pickState(real, newer)).toBe(newer);
    expect(pickState(newer, real)).toBe(newer);
  });
});
