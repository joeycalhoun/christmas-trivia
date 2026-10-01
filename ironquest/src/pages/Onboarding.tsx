import { useState } from 'react';
import type { ActivityLevel, HeroClass, Pace, Profile, Sex } from '../game/types';
import { ACTIVITY_FACTORS, PACES, computeTargets } from '../game/nutrition';
import { useStore, STARTER_GIFT } from '../store/store';
import { NumberField } from '../components/ui';
import { fmt } from '../lib/format';

export const HERO_CLASSES: Record<HeroClass, { name: string; icon: string; blurb: string }> = {
  warrior: { name: 'Warrior', icon: '⚔️', blurb: 'Lives for heavy compound lifts.' },
  paladin: { name: 'Paladin', icon: '🛡️', blurb: 'Disciplined, balanced, never misses a log.' },
  ranger: { name: 'Ranger', icon: '🏹', blurb: 'Walks for miles. Cardio is a lifestyle.' },
  monk: { name: 'Monk', icon: '🥋', blurb: 'Bodyweight mastery and inner calm.' },
};

export function Onboarding() {
  const createHero = useStore((s) => s.createHero);
  const toast = useStore((s) => s.toast);
  const [step, setStep] = useState(0);
  const [heroName, setHeroName] = useState('');
  const [heroClass, setHeroClass] = useState<HeroClass>('warrior');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<number | ''>('');
  const [ft, setFt] = useState<number | ''>('');
  const [inch, setInch] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [goal, setGoal] = useState<number | ''>('');
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [pace, setPace] = useState<Pace>('steady');

  const heightIn = (Number(ft) || 0) * 12 + (Number(inch) || 0);
  const bodyOk = Number(age) >= 14 && heightIn >= 48 && Number(weight) >= 80 && Number(goal) >= 80;
  const profile: Omit<Profile, 'createdAt'> = {
    heroName: heroName.trim() || 'Hero',
    heroClass,
    sex,
    age: Number(age) || 30,
    heightIn: heightIn || 70,
    startWeight: Number(weight) || 200,
    goalWeight: Number(goal) || Number(weight) || 180,
    activity,
    pace,
  };
  const targets = computeTargets({ ...profile, createdAt: '' }, profile.startWeight);

  const finish = () => {
    createHero(profile);
    toast({ icon: '🎁', title: 'Starter gift received!', detail: `${STARTER_GIFT.coins} coins + 3 card packs. Open them in Packs.`, tone: 'gold' });
  };

  return (
    <div className="onboard">
      <div className="center mb">
        <img src="/icon.svg" alt="" width={64} height={64} />
        <h1 className="gold mt">IronQuest</h1>
        <p className="muted">Your body is the character. Every meal, every rep, every step is XP.</p>
      </div>

      {step === 0 && (
        <div className="panel stack">
          <h2>Create your hero</h2>
          <label className="field">
            Hero name
            <input type="text" value={heroName} onChange={(e) => setHeroName(e.target.value)} placeholder="e.g. Joey the Relentless" data-testid="hero-name" autoFocus />
          </label>
          <div className="field">
            <span className="small muted" style={{ fontWeight: 600 }}>
              Class (cosmetic)
            </span>
            <div className="class-pick">
              {(Object.keys(HERO_CLASSES) as HeroClass[]).map((k) => (
                <div key={k} className={`class-opt ${heroClass === k ? 'sel' : ''}`} onClick={() => setHeroClass(k)}>
                  <div className="ci">{HERO_CLASSES[k].icon}</div>
                  <b>{HERO_CLASSES[k].name}</b>
                  <div className="tiny muted">{HERO_CLASSES[k].blurb}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={() => setStep(1)} data-testid="next">
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="panel stack">
          <h2>Your stats</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Used to calculate a healthy calorie target and protein goal. Stays on your machine.
          </p>
          <div className="fields">
            <label className="field">
              Sex
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <NumberField label="Age" value={age} onChange={setAge} testId="age" />
            <NumberField label="Height" suffix="ft" value={ft} onChange={setFt} testId="ft" />
            <NumberField label="Height" suffix="in" value={inch} onChange={setInch} testId="in" />
            <NumberField label="Current weight" suffix="lb" value={weight} onChange={setWeight} testId="weight" />
            <NumberField label="Goal weight" suffix="lb" value={goal} onChange={setGoal} testId="goal" />
          </div>
          <div className="row between">
            <button className="btn ghost" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button className="btn primary" disabled={!bodyOk} onClick={() => setStep(2)} data-testid="next">
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="panel stack">
          <h2>Your campaign</h2>
          <label className="field">
            Activity level (outside of logged workouts)
            <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
              {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_FACTORS[k].label} — {ACTIVITY_FACTORS[k].hint}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Fat-loss pace
            <select value={pace} onChange={(e) => setPace(e.target.value as Pace)}>
              {(Object.keys(PACES) as Pace[]).map((k) => (
                <option key={k} value={k}>
                  {PACES[k].label} — {PACES[k].hint}
                </option>
              ))}
            </select>
          </label>
          <div className="tiles">
            <div className="tile">
              <div className="k">Maintenance</div>
              <div className="v">
                {fmt(targets.tdee)} <small>kcal</small>
              </div>
            </div>
            <div className="tile">
              <div className="k">Daily calories</div>
              <div className="v gold" data-testid="target-cal">
                {fmt(targets.calorieMin)}–{fmt(targets.calories)}
              </div>
            </div>
            <div className="tile">
              <div className="k">Daily protein</div>
              <div className="v green">
                {targets.protein} <small>g</small>
              </div>
            </div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Staying inside your calorie <b>window</b> completes quests — eating too little doesn't count, because crash diets eat muscle. Targets
            re-calculate automatically as your weight drops, and you can override them any time in Settings.
          </p>
          <div className="row between">
            <button className="btn ghost" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button className="btn primary" onClick={finish} data-testid="begin">
              Begin the quest ⚔️
            </button>
          </div>
        </div>
      )}
      <p className="center tiny dim mt">Step {step + 1} of 3</p>
    </div>
  );
}
