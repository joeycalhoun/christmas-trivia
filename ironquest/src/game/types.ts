export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Pace = 'gentle' | 'steady' | 'aggressive';
export type HeroClass = 'warrior' | 'paladin' | 'ranger' | 'monk';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type PackType = 'bronze' | 'silver' | 'gold' | 'elite';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type SkillKey = 'iron' | 'endurance' | 'provision' | 'discipline';

export interface Profile {
  heroName: string;
  heroClass: HeroClass;
  sex: Sex;
  age: number;
  heightIn: number;
  startWeight: number; // lb
  goalWeight: number; // lb
  activity: ActivityLevel;
  pace: Pace;
  calorieOverride?: number | null;
  proteinOverride?: number | null;
  createdAt: string; // date key
  title?: string | null; // equipped title (achievement id)
}

export interface FoodItem {
  id: string;
  name: string;
  serving: string;
  calories: number;
  protein: number;
  category?: string;
  custom?: boolean;
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: MealSlot;
  name: string;
  calories: number;
  protein: number;
  servings?: number;
  foodId?: string;
  loggedAt: number;
}

export interface SetEntry {
  weight: number;
  reps: number;
}

export interface ExerciseEntry {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
}

export interface CardioEntry {
  id: string;
  type: string;
  minutes: number;
}

export interface Session {
  date: string;
  exercises: ExerciseEntry[];
  cardio: CardioEntry[];
  notes?: string;
}

export interface WeighIn {
  date: string;
  weight: number;
}

export interface ClaimRecord {
  id: string;
  at: number;
  title: string;
  xp: number;
  coins: number;
  packs: PackType[];
}

export interface GameState {
  version: number;
  profile: Profile | null;
  foods: FoodEntry[];
  customFoods: FoodItem[];
  sessions: Record<string, Session>;
  weighIns: WeighIn[];
  steps: Record<string, number>;
  sealed: Record<string, number>;
  claims: Record<string, ClaimRecord>;
  wallet: { coins: number; essence: number; bonusXp: number };
  packs: PackType[];
  cards: Record<string, number>;
  squad: (string | null)[];
  packsOpened: number;
  pity: number;
  updatedAt: number;
}

export const STATE_VERSION = 1;

export function emptyState(): GameState {
  return {
    version: STATE_VERSION,
    profile: null,
    foods: [],
    customFoods: [],
    sessions: {},
    weighIns: [],
    steps: {},
    sealed: {},
    claims: {},
    wallet: { coins: 0, essence: 0, bonusXp: 0 },
    packs: [],
    cards: {},
    squad: [null, null, null, null, null],
    packsOpened: 0,
    pity: 0,
    updatedAt: 0,
  };
}

/** Fill in any fields missing from an older/partial save so the rest of the app can trust the shape. */
export function normalizeState(raw: unknown): GameState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<GameState>;
  const squad = Array.isArray(r.squad) ? r.squad.slice(0, 5) : base.squad;
  while (squad.length < 5) squad.push(null);
  return {
    ...base,
    ...r,
    version: STATE_VERSION,
    foods: Array.isArray(r.foods) ? r.foods : [],
    customFoods: Array.isArray(r.customFoods) ? r.customFoods : [],
    sessions: r.sessions && typeof r.sessions === 'object' ? r.sessions : {},
    weighIns: Array.isArray(r.weighIns) ? r.weighIns : [],
    steps: r.steps && typeof r.steps === 'object' ? r.steps : {},
    sealed: r.sealed && typeof r.sealed === 'object' ? r.sealed : {},
    claims: r.claims && typeof r.claims === 'object' ? r.claims : {},
    wallet: { ...base.wallet, ...(r.wallet ?? {}) },
    packs: Array.isArray(r.packs) ? r.packs : [],
    cards: r.cards && typeof r.cards === 'object' ? r.cards : {},
    squad,
    packsOpened: r.packsOpened ?? 0,
    pity: r.pity ?? 0,
    updatedAt: r.updatedAt ?? 0,
  };
}
