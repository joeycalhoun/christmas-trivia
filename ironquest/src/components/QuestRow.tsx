import type { QuestView } from '../game/engine';
import { useStore } from '../store/store';
import { Bar, Rewards } from './ui';
import { useClaim } from './useClaim';

export function QuestRow({ q, compact }: { q: QuestView; compact?: boolean }) {
  const claim = useClaim();
  const sealHint = q.needsSeal && !q.done;
  return (
    <div className={`quest ${q.done ? 'done' : ''} ${q.claimed ? 'claimed' : ''}`} data-testid={`quest-${q.id}`}>
      <div className="qicon">{q.icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="qtitle">
          {q.title}
          {q.bonus && <span className="pill purple">Bonus</span>}
          {q.claimed && <span className="pill green">✓ Claimed</span>}
        </div>
        {!compact && <div className="qdesc">{q.desc}</div>}
        <Bar value={q.progress} max={q.goal} tone={q.done ? 'gold' : 'blue'} />
        <div className="row between tiny muted" style={{ marginTop: 4 }}>
          <span>{q.label}</span>
          {sealHint && <span className="gold">🔒 Seal the day to complete</span>}
        </div>
      </div>
      <div className="qside">
        <Rewards xp={q.xp} coins={q.coins} packs={q.packs} />
        {q.done && !q.claimed && (
          <button className="btn primary sm claim" onClick={() => claim(q.id)} data-testid={`claim-${q.id}`}>
            Claim
          </button>
        )}
      </div>
    </div>
  );
}

export function useSealDay() {
  const sealDay = useStore((s) => s.sealDay);
  const toast = useStore((s) => s.toast);
  return (date: string) => {
    sealDay(date);
    toast({ icon: '🔒', title: 'Day sealed', detail: 'Calorie quests for this day are now locked in.', tone: 'good' });
  };
}
