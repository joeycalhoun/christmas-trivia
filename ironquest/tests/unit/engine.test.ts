import { describe, expect, it } from 'vitest';
import { computeTargets } from '../../src/game/nutrition';
import { charLevel, charXpToNext, skillLevel } from '../../src/game/leveling';
import { computeStats } from '../../src/game/stats';
import { claimReward, computeGame } from '../../src/game/engine';
import { bonusDailyFor } from '../../src/game/quests';
import { bossHp, computeRaids } from '../../src/game/raid';
import { PROFILE, food, freshState, lift } from './helpers';
import { addDays, weekStart } from '../../src/lib/dates';

const TODAY = '2026-10-01'; // Thursday

describe('nutrition targets', () => {
  it('computes a sane deficit and protein target', () => {
    const t = computeTargets(PROFILE, 220);
    expect(t.tdee).toBeGreaterThan(2500);
    expect(t.tdee).toBeLessThan(3200);
    expect(t.calories).toBe(Math.round((t.tdee - 500) / 5) * 5);
    expect(t.calorieMin).toBeLessThan(t.calories);
    expect(t.protein).toBeGreaterThanOrEqual(160);
    expect(t.protein).toBeLessThanOrEqual(220);
  });

  it('never goes below the safety floor and respects overrides', () => {
    const tiny = computeTargets({ ...PROFILE, sex: 'female', age: 60, heightIn: 60, activity: 'sedentary', pace: 'aggressive' }, 120);
    expect(tiny.calories).toBeGreaterThanOrEqual(1200);
    const o = computeTargets({ ...PROFILE, calorieOverride: 2000, proteinOverride: 200 }, 220);
    expect(o.calories).toBe(2000);
    expect(o.protein).toBe(200);
  });

  it('caps the deficit at 25% of TDEE', () => {
    const t = computeTargets({ ...PROFILE, sex: 'female', heightIn: 62, age: 45, activity: 'sedentary', pace: 'aggressive', startWeight: 150 }, 150);
    expect(t.tdee - t.calories).toBeLessThanOrEqual(Math.ceil(t.tdee * 0.25) + 5);
  });
});

describe('leveling', () => {
  it('walks XP into levels', () => {
    expect(charLevel(0).level).toBe(1);
    expect(charLevel(charXpToNext(1)).level).toBe(2);
    expect(charLevel(charXpToNext(1) - 1).level).toBe(1);
    const big = charLevel(10_000_000);
    expect(big.level).toBe(60);
    expect(big.maxed).toBe(true);
    expect(big.paragon).toBeGreaterThan(0);
    expect(skillLevel(0).level).toBe(1);
  });
});

describe('stats', () => {
  it('detects PRs only against earlier sessions', () => {
    const s = freshState({
      sessions: {
        '2026-09-28': { date: '2026-09-28', exercises: [lift('bench', [[185, 5], [185, 5], [185, 4]])], cardio: [] },
        '2026-09-30': { date: '2026-09-30', exercises: [lift('bench', [[195, 5]]), lift('squat', [[225, 5]])], cardio: [] },
      },
    });
    const st = computeStats(s, TODAY);
    expect(st.prs).toHaveLength(1);
    expect(st.prs[0].exerciseId).toBe('bench');
    expect(st.lifts.bench).toBe(195);
    expect(st.lifts.squat).toBe(225);
    expect(st.totals.workouts).toBe(1); // the second day only had 2 sets
    expect(st.day('2026-09-28').strength).toBe(true);
    expect(st.skillXp.iron).toBeGreaterThan(0);
  });

  it('tracks logging streaks', () => {
    const s = freshState({ foods: [food('2026-09-28', 500, 40), food('2026-09-29', 500, 40), food('2026-09-30', 500, 40)] });
    const st = computeStats(s, TODAY);
    expect(st.bestStreak).toBe(3);
    expect(st.currentStreak).toBe(3); // today not logged yet, streak still alive through yesterday
    expect(computeStats(s, '2026-10-03').currentStreak).toBe(0);
  });

  it('uses a weigh-in trend for weight lost', () => {
    const s = freshState({ weighIns: [{ date: '2026-09-28', weight: 218 }, { date: '2026-09-29', weight: 216 }] });
    const st = computeStats(s, TODAY);
    expect(st.lostLb).toBeCloseTo(3);
    expect(st.weightOn('2026-09-27')).toBe(220);
    expect(st.weightOn('2026-09-30')).toBe(216);
  });
});

describe('daily quests and claiming', () => {
  it('requires a seal before the calorie quest completes', () => {
    const base = freshState();
    const t = computeTargets(PROFILE, 220);
    const foods = [food(TODAY, t.calories - 100, t.protein, 'dinner')];
    let view = computeGame({ ...base, foods }, TODAY);
    const cal = view.daily.find((q) => q.id.endsWith(':calories'))!;
    expect(cal.done).toBe(false);
    expect(cal.needsSeal).toBe(true);
    expect(view.daily.find((q) => q.id.endsWith(':protein'))!.done).toBe(true);

    view = computeGame({ ...base, foods, sealed: { [TODAY]: 1 } }, TODAY);
    expect(view.daily.find((q) => q.id.endsWith(':calories'))!.done).toBe(true);
  });

  it('does not reward eating dangerously little', () => {
    const view = computeGame(freshState({ foods: [food(TODAY, 600, 50)], sealed: { [TODAY]: 1 } }), TODAY);
    const cal = view.daily.find((q) => q.id.endsWith(':calories'))!;
    expect(cal.done).toBe(false);
    expect(cal.label).toMatch(/below/);
  });

  it('claims a reward once and credits coins, xp and packs', () => {
    const t = computeTargets(PROFILE, 220);
    const state = freshState({ foods: [food(TODAY, 1000, t.protein)] });
    const view = computeGame(state, TODAY);
    const id = `daily:${TODAY}:protein`;
    expect(view.claimable.some((r) => r.id === id)).toBe(true);
    const res = claimReward(state, view, id)!;
    expect(res.state.wallet.coins).toBe(60);
    expect(res.state.wallet.bonusXp).toBe(60);
    const again = computeGame(res.state, TODAY);
    expect(again.claimable.some((r) => r.id === id)).toBe(false);
    expect(claimReward(res.state, again, id)).toBeNull();
  });

  it('lets you claim yesterday but not last week', () => {
    const t = computeTargets(PROFILE, 220);
    const y = addDays(TODAY, -1);
    const view = computeGame(freshState({ foods: [food(y, 1000, t.protein), food('2026-09-28', 1000, t.protein)] }), TODAY);
    expect(view.claimable.some((r) => r.id === `daily:${y}:protein`)).toBe(true);
    expect(view.claimable.some((r) => r.id === `daily:2026-09-28:protein`)).toBe(false);
  });

  it('rotates a deterministic bonus daily', () => {
    expect(bonusDailyFor('2026-10-01').key).toBe(bonusDailyFor('2026-10-01').key);
    const keys = new Set(Array.from({ length: 30 }, (_, i) => bonusDailyFor(addDays('2026-10-01', i)).key));
    expect(keys.size).toBeGreaterThan(3);
  });

  it('applies squad bonuses to claimed rewards', () => {
    const t = computeTargets(PROFILE, 220);
    const state = freshState({ foods: [food(TODAY, 1000, t.protein)], squad: ['hearth_12', 'ember_12', 'verdant_12', 'tide_12', 'storm_12'] });
    const view = computeGame(state, TODAY);
    expect(view.bonus.xpPct).toBeGreaterThan(0);
    const res = claimReward(state, view, `daily:${TODAY}:protein`)!;
    expect(res.applied.xp).toBeGreaterThan(60);
  });
});

describe('raids', () => {
  it('a strong week defeats the boss and scales the next one', () => {
    const t = computeTargets(PROFILE, 220);
    const ws = weekStart('2026-09-28');
    const foods = [];
    const sealed: Record<string, number> = {};
    const sessions: Record<string, ReturnType<typeof freshState>['sessions'][string]> = {};
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      foods.push(food(d, t.calories - 100, t.protein + 5));
      sealed[d] = 1;
      if (i % 2 === 0) sessions[d] = { date: d, exercises: [lift('squat', Array.from({ length: 12 }, () => [135, 8] as [number, number]))], cardio: [] };
    }
    const state = freshState({ foods, sealed, sessions });
    const st = computeStats(state, '2026-10-06');
    const raids = computeRaids(st.day, PROFILE.createdAt, '2026-10-06');
    expect(raids).toHaveLength(2);
    expect(raids[0].defeated).toBe(true);
    expect(raids[1].hp).toBe(bossHp(1));
    expect(raids[1].hp).toBeGreaterThan(raids[0].hp);
    const view = computeGame(state, '2026-10-06');
    expect(view.claimable.some((r) => r.id === `raid:${ws}`)).toBe(true);
    // weekly challenges from last week are still claimable
    expect(view.claimable.some((r) => r.id === `weekly:${ws}:protein5`)).toBe(true);
  });
});

describe('achievements and level rewards', () => {
  it('unlocks strength milestones and level rewards', () => {
    const state = freshState({
      sessions: { [TODAY]: { date: TODAY, exercises: [lift('bench', [[225, 1], [135, 10], [135, 10]])], cardio: [] } },
    });
    const view = computeGame(state, TODAY);
    const ids = view.claimable.map((r) => r.id);
    expect(ids).toContain('ach:bench:225');
    expect(ids).toContain('ach:bench:135');
    expect(ids).toContain('ach:workouts:1');
    expect(view.titles.some((t) => t.title === 'Two-Plate')).toBe(true);
    expect(view.milestones.length).toBeGreaterThan(0);
  });
});
