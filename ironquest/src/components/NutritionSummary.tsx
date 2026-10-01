import type { DayStats } from '../game/stats';
import { useStore } from '../store/store';
import { Bar } from './ui';
import { useSealDay } from './QuestRow';
import { fmt } from '../lib/format';
import { DAILY_GRACE_DAYS } from '../game/engine';
import { diffDays } from '../lib/dates';

export function NutritionSummary({ d, today }: { d: DayStats; today: string }) {
  const seal = useSealDay();
  const unseal = useStore((s) => s.unsealDay);
  const t = d.targets;
  const max = Math.max(t.calories * 1.15, d.calories);
  const calTone = d.calorieStatus === 'over' ? 'red' : d.calorieStatus === 'on' ? 'green' : 'gold';
  const remainingCal = t.calories - d.calories;
  const remainingP = t.protein - d.protein;
  const canSeal = diffDays(d.date, today) <= DAILY_GRACE_DAYS;

  return (
    <div className="stack" data-testid="nutrition-summary">
      <div>
        <div className="row between small" style={{ marginBottom: 6 }}>
          <b>🔥 Calories</b>
          <span className="num">
            <span data-testid="cal-total">{fmt(d.calories)}</span> <span className="muted">/ {fmt(t.calories)}</span>
          </span>
        </div>
        <Bar value={d.calories} max={max} tone={calTone} size="lg" zone={[t.calorieMin, t.calories]} />
        <div className="row between tiny muted" style={{ marginTop: 4 }}>
          <span>
            Window: {fmt(t.calorieMin)}–{fmt(t.calories)}
          </span>
          <span className={remainingCal < 0 ? 'red' : ''}>{remainingCal >= 0 ? `${fmt(remainingCal)} left` : `${fmt(-remainingCal)} over`}</span>
        </div>
      </div>
      <div>
        <div className="row between small" style={{ marginBottom: 6 }}>
          <b>🥩 Protein</b>
          <span className="num">
            <span data-testid="protein-total">{fmt(d.protein)}</span> <span className="muted">/ {t.protein} g</span>
          </span>
        </div>
        <Bar value={d.protein} max={t.protein} tone={d.proteinHit ? 'gold' : 'blue'} size="lg" />
        <div className="row between tiny muted" style={{ marginTop: 4 }}>
          <span>{d.proteinHit ? '✅ Target hit!' : `${fmt(remainingP)} g to go`}</span>
          <span>{d.entries} foods logged</span>
        </div>
      </div>
      {d.sealed ? (
        <div className="row between">
          <span className="pill green">🔒 Day sealed</span>
          {canSeal && (
            <button className="btn xs ghost" onClick={() => unseal(d.date)}>
              Unseal
            </button>
          )}
        </div>
      ) : (
        canSeal &&
        d.logged && (
          <button className="btn good block" onClick={() => seal(d.date)} data-testid="seal-day">
            🔒 Seal the day — I'm done eating
          </button>
        )
      )}
    </div>
  );
}
