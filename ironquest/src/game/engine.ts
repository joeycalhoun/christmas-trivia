import type { GameState, PackType, SkillKey } from './types';
import { computeStats, type DayStats, type Stats } from './stats';
import { charLevel, rankFor, skillLevel, skillTier, zoneFor, type LevelInfo, type Zone, CHAR_MAX_LEVEL } from './leveling';
import { DAILY_SWEEP, WEEKLIES, WEEKLY_SWEEP, dailiesFor, type QuestCategory, type QuestDef, type WeekCtx } from './quests';
import { computeRaids, type RaidWeek } from './raid';
import { TRACKS, tierReward, type Track } from './achievements';
import { CARDS, SETS, squadBonus, type SquadBonus } from './cards';
import { addDays, daysLeftInWeek, weekDays, weekStart } from '../lib/dates';

export type RewardKind = 'daily' | 'weekly' | 'raid' | 'achievement' | 'level' | 'skill' | 'set';
export type RewardCategory = QuestCategory | 'raid';

export interface Reward {
  id: string;
  kind: RewardKind;
  title: string;
  subtitle: string;
  icon: string;
  category: RewardCategory;
  xp: number;
  coins: number;
  packs: PackType[];
}

export interface QuestView extends Reward {
  desc: string;
  progress: number;
  goal: number;
  label: string;
  done: boolean;
  claimed: boolean;
  /** Waiting on the day being sealed. */
  needsSeal: boolean;
  bonus?: boolean;
}

export interface SkillView extends LevelInfo {
  key: SkillKey;
  name: string;
  icon: string;
  tier: string;
  blurb: string;
}

export interface AchievementView {
  track: Track;
  value: number;
  /** Index of highest earned tier, -1 if none. */
  earned: number;
  next: Track['tiers'][number] | null;
  ratio: number; // progress toward next tier, 0..1
}

export interface Milestone {
  icon: string;
  title: string;
  detail: string;
  ratio: number;
}

export interface SetView {
  id: string;
  name: string;
  emblem: string;
  owned: number;
  total: number;
  complete: boolean;
}

export interface GameView {
  today: string;
  stats: Stats;
  todayStats: DayStats;
  character: LevelInfo & { rank: string; zone: Zone };
  skills: SkillView[];
  daily: QuestView[];
  dailySweep: QuestView;
  weekly: QuestView[];
  weeklySweep: QuestView;
  weekStart: string;
  daysLeftInWeek: number;
  raid: RaidWeek;
  raids: RaidWeek[];
  raidKills: number;
  achievements: AchievementView[];
  achievementPoints: number;
  claimable: Reward[];
  bonus: SquadBonus;
  titles: { id: string; title: string }[];
  milestones: Milestone[];
  sets: SetView[];
}

export const SKILL_INFO: Record<SkillKey, { name: string; icon: string; blurb: string }> = {
  iron: { name: 'Ironworking', icon: '🏋️', blurb: 'Lifting. Every working set, session, and PR.' },
  provision: { name: 'Provisioning', icon: '🥩', blurb: 'Protein. Every gram counts, bonus for hitting target.' },
  discipline: { name: 'Discipline', icon: '🛡️', blurb: 'Logging, sealing days, staying in your calorie window.' },
  endurance: { name: 'Endurance', icon: '🫀', blurb: 'Cardio minutes and daily steps.' },
};

export const DAILY_GRACE_DAYS = 2;

function questView<T>(
  def: QuestDef<T>,
  ctx: T,
  id: string,
  kind: RewardKind,
  claims: GameState['claims'],
  sealed: boolean,
  subtitle: string,
  bonus = false,
): QuestView {
  const p = def.eval(ctx);
  return {
    id,
    kind,
    title: def.title,
    subtitle,
    icon: def.icon,
    category: def.category,
    xp: def.xp,
    coins: def.coins,
    packs: def.packs ?? [],
    desc: def.desc(ctx),
    progress: p.progress,
    goal: p.goal,
    label: p.label,
    done: p.done,
    claimed: !!claims[id],
    needsSeal: !!def.needsSeal && !sealed,
    bonus,
  };
}

function sweepView(id: string, kind: RewardKind, def: typeof DAILY_SWEEP, parts: QuestView[], claims: GameState['claims'], subtitle: string, desc: string): QuestView {
  const done = parts.filter((q) => q.done).length;
  return {
    id,
    kind,
    title: def.title,
    subtitle,
    icon: def.icon,
    category: 'general',
    xp: def.xp,
    coins: def.coins,
    packs: def.packs,
    desc,
    progress: done,
    goal: parts.length,
    label: `${done} / ${parts.length}`,
    done: done === parts.length,
    claimed: !!claims[id],
    needsSeal: false,
  };
}

export function dailyQuests(state: GameState, d: DayStats): { quests: QuestView[]; sweep: QuestView } {
  const defs = dailiesFor(d.date);
  const quests = defs.map((def, i) =>
    questView(def, d, `daily:${d.date}:${def.key}`, 'daily', state.claims, d.sealed, 'Daily quest', i === defs.length - 1),
  );
  const sweep = sweepView(`daily:${d.date}:sweep`, 'daily', DAILY_SWEEP, quests, state.claims, 'Daily bonus', 'Complete every daily quest.');
  return { quests, sweep };
}

export function weeklyQuests(state: GameState, stats: Stats, ws: string): { quests: QuestView[]; sweep: QuestView } {
  const ctx: WeekCtx = { days: weekDays(ws).map((d) => stats.day(d)) };
  const quests = WEEKLIES.map((def) => questView(def, ctx, `weekly:${ws}:${def.key}`, 'weekly', state.claims, true, 'Weekly challenge'));
  const sweep = sweepView(`weekly:${ws}:sweep`, 'weekly', WEEKLY_SWEEP, quests, state.claims, 'Weekly bonus', 'Complete every weekly challenge.');
  return { quests, sweep };
}

export function computeGame(state: GameState, today: string): GameView {
  const profile = state.profile!;
  const stats = computeStats(state, today);
  const todayStats = stats.day(today);
  const claimable: Reward[] = [];
  const pushIfReady = (q: QuestView) => {
    if (q.done && !q.claimed) claimable.push(q);
  };

  // --- Skills & character
  const skills: SkillView[] = (Object.keys(SKILL_INFO) as SkillKey[]).map((key) => {
    const info = skillLevel(stats.skillXp[key]);
    return { ...info, key, ...SKILL_INFO[key], tier: skillTier(info.level) };
  });
  const totalXp = skills.reduce((s, k) => s + k.total, 0) + state.wallet.bonusXp;
  const lvl = charLevel(totalXp);
  const character = { ...lvl, rank: rankFor(lvl.level), zone: zoneFor(lvl.level) };

  // --- Daily quests (today + a short grace window for late logging)
  const created = profile.createdAt;
  let daily: QuestView[] = [];
  let dailySweep!: QuestView;
  for (let i = DAILY_GRACE_DAYS; i >= 0; i--) {
    const date = addDays(today, -i);
    if (date < created) continue;
    const { quests, sweep } = dailyQuests(state, stats.day(date));
    quests.forEach(pushIfReady);
    pushIfReady(sweep);
    if (i === 0) {
      daily = quests;
      dailySweep = sweep;
    }
  }
  if (!dailySweep) ({ quests: daily, sweep: dailySweep } = dailyQuests(state, todayStats));

  // --- Weekly (this week + last week)
  const ws = weekStart(today);
  const prevWs = addDays(ws, -7);
  if (prevWs >= weekStart(created)) {
    const prev = weeklyQuests(state, stats, prevWs);
    prev.quests.forEach(pushIfReady);
    pushIfReady(prev.sweep);
  }
  const { quests: weekly, sweep: weeklySweep } = weeklyQuests(state, stats, ws);
  weekly.forEach(pushIfReady);
  pushIfReady(weeklySweep);

  // --- Raids
  const raids = computeRaids(stats.day, created, today);
  const raid = raids[raids.length - 1];
  const raidKills = raids.filter((r) => r.defeated).length;
  for (const r of raids.slice(-2)) {
    const id = `raid:${r.weekStart}`;
    if (r.defeated && !state.claims[id]) {
      claimable.push({
        id,
        kind: 'raid',
        title: `${r.boss.name} defeated`,
        subtitle: 'Raid loot',
        icon: r.boss.icon,
        category: 'raid',
        xp: 500 + 50 * r.tier,
        coins: 750 + 75 * r.tier,
        packs: (r.tier + 1) % 4 === 0 ? ['gold', 'elite'] : ['gold'],
      });
    }
  }

  // --- Collection
  const uniqueCards = CARDS.filter((c) => (state.cards[c.id] ?? 0) > 0).length;
  const sets: SetView[] = SETS.map((s) => {
    const inSet = CARDS.filter((c) => c.set === s.id);
    const owned = inSet.filter((c) => (state.cards[c.id] ?? 0) > 0).length;
    return { id: s.id, name: s.name, emblem: s.emblem, owned, total: inSet.length, complete: owned === inSet.length };
  });
  for (const s of sets) {
    const id = `set:${s.id}`;
    if (s.complete && !state.claims[id]) {
      claimable.push({ id, kind: 'set', title: `${s.name} complete`, subtitle: 'Set reward', icon: s.emblem, category: 'general', xp: 1000, coins: 2500, packs: ['elite'] });
    }
  }

  // --- Achievements
  const ctx = {
    stats,
    goalLoss: Math.max(0, profile.startWeight - profile.goalWeight),
    raidKills,
    uniqueCards,
    totalCards: CARDS.length,
    packsOpened: state.packsOpened,
    completedSets: sets.filter((s) => s.complete).length,
  };
  let achievementPoints = 0;
  const titles: { id: string; title: string }[] = [];
  const achievements: AchievementView[] = TRACKS.map((track) => {
    const value = track.metric(ctx);
    let earned = -1;
    track.tiers.forEach((tier, i) => {
      if (value >= tier.n) {
        earned = i;
        const id = `ach:${track.key}:${tier.n}`;
        const r = tierReward(i, track.tiers.length);
        achievementPoints += r.points;
        if (tier.title) titles.push({ id, title: tier.title });
        if (!state.claims[id]) {
          claimable.push({ id, kind: 'achievement', title: tier.name, subtitle: track.describe(tier.n), icon: track.icon, category: 'general', xp: r.xp, coins: r.coins, packs: r.packs });
        }
      }
    });
    const next = track.tiers[earned + 1] ?? null;
    const ratio = next ? Math.max(0, Math.min(1, value / next.n)) : 1;
    return { track, value, earned, next, ratio };
  });

  // --- Level & skill milestone rewards
  for (let n = 2; n <= character.level; n++) {
    const id = `level:${n}`;
    if (state.claims[id]) continue;
    const packs: PackType[] = n === CHAR_MAX_LEVEL ? ['elite'] : n % 10 === 0 ? ['gold'] : n % 5 === 0 ? ['silver'] : [];
    claimable.push({ id, kind: 'level', title: `Reached level ${n}`, subtitle: rankFor(n), icon: '⬆️', category: 'general', xp: 0, coins: 100 + 15 * n, packs });
  }
  for (let n = 1; n <= character.paragon; n++) {
    const id = `paragon:${n}`;
    if (!state.claims[id]) claimable.push({ id, kind: 'level', title: `Paragon ${n}`, subtitle: 'Beyond the cap', icon: '💠', category: 'general', xp: 0, coins: 1000, packs: ['gold'] });
  }
  for (const s of skills) {
    for (let n = 5; n <= s.level; n += 5) {
      const id = `skill:${s.key}:${n}`;
      if (state.claims[id]) continue;
      claimable.push({
        id,
        kind: 'skill',
        title: `${s.name} ${n}`,
        subtitle: n % 25 === 0 ? `Promoted to ${skillTier(n)}` : 'Skill milestone',
        icon: s.icon,
        category: 'general',
        xp: 50 + 5 * n,
        coins: 25 * n,
        packs: n % 25 === 0 ? ['gold'] : [],
      });
    }
  }

  // --- "Almost there" milestones — the little goals that keep you coming back
  const milestones: Milestone[] = [];
  if (!character.maxed) {
    milestones.push({ icon: '⬆️', title: `Level ${character.level + 1}`, detail: `${character.needed - character.into} XP to go`, ratio: character.into / character.needed });
  }
  for (const s of skills) {
    const nextMs = Math.min(100, Math.floor(s.level / 5) * 5 + 5);
    if (s.maxed) continue;
    milestones.push({ icon: s.icon, title: `${s.name} ${nextMs}`, detail: `Level ${s.level} → ${nextMs}`, ratio: (s.level - (nextMs - 5) + s.into / s.needed) / 5 });
  }
  for (const a of achievements) {
    if (!a.next) continue;
    milestones.push({ icon: a.track.icon, title: a.next.name, detail: `${a.track.describe(a.next.n)} — ${Math.floor(a.value).toLocaleString()} / ${a.next.n.toLocaleString()}`, ratio: a.ratio });
  }
  milestones.sort((a, b) => b.ratio - a.ratio);

  return {
    today,
    stats,
    todayStats,
    character,
    skills,
    daily,
    dailySweep,
    weekly,
    weeklySweep,
    weekStart: ws,
    daysLeftInWeek: daysLeftInWeek(today),
    raid,
    raids,
    raidKills,
    achievements,
    achievementPoints,
    claimable,
    bonus: squadBonus(state.squad),
    titles,
    milestones: milestones.slice(0, 6),
    sets,
  };
}

export interface AppliedReward {
  reward: Reward;
  xp: number;
  coins: number;
  packs: PackType[];
}

export function applyBonus(reward: Reward, bonus: SquadBonus): { xp: number; coins: number } {
  const cat = reward.category === 'general' ? 0 : bonus.categoryPct[reward.category];
  return {
    xp: Math.round(reward.xp * (1 + bonus.xpPct / 100)),
    coins: Math.round(reward.coins * (1 + (bonus.coinPct + cat) / 100)),
  };
}

export function claimReward(state: GameState, view: GameView, id: string): { state: GameState; applied: AppliedReward } | null {
  const reward = view.claimable.find((r) => r.id === id);
  if (!reward || state.claims[id]) return null;
  const { xp, coins } = applyBonus(reward, view.bonus);
  return {
    state: {
      ...state,
      claims: { ...state.claims, [id]: { id, at: Date.now(), title: reward.title, xp, coins, packs: reward.packs } },
      wallet: { ...state.wallet, coins: state.wallet.coins + coins, bonusXp: state.wallet.bonusXp + xp },
      packs: [...state.packs, ...reward.packs],
    },
    applied: { reward, xp, coins, packs: reward.packs },
  };
}
