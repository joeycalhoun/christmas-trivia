import { Link } from 'react-router-dom';
import { useStore, useView } from '../store/store';
import { Rewards } from '../components/ui';
import { useClaim, useClaimAll } from '../components/useClaim';
import { applyBonus, type RewardKind } from '../game/engine';
import { fmt } from '../lib/format';

const KIND_LABEL: Record<RewardKind, string> = {
  daily: 'Daily quests',
  weekly: 'Weekly challenges',
  raid: 'Raid loot',
  achievement: 'Achievements',
  level: 'Level-ups',
  skill: 'Skill milestones',
  set: 'Set completion',
};

export function RewardsPage() {
  const view = useView();
  const state = useStore((s) => s.state);
  const claim = useClaim();
  const claimAll = useClaimAll();
  const kinds = Object.keys(KIND_LABEL) as RewardKind[];
  const history = Object.values(state.claims)
    .sort((a, b) => b.at - a.at)
    .slice(0, 25);

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>🎁 Rewards</h1>
          <p>
            Your squad boosts every claim:{' '}
            <b className="gold">
              +{fmt(view.bonus.xpPct, 1)}% XP · +{fmt(view.bonus.coinPct, 1)}% coins
            </b>{' '}
            <Link to="/cards">(improve it)</Link>
          </p>
        </div>
        {view.claimable.length > 0 && (
          <button className="btn primary claim" onClick={claimAll} data-testid="claim-all">
            Claim all ({view.claimable.length})
          </button>
        )}
      </div>

      {view.claimable.length === 0 ? (
        <div className="panel empty">
          <div style={{ fontSize: 40 }}>🎁</div>
          Nothing to claim right now. Complete quests, hit milestones, and slay the weekly boss to earn more.
        </div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          {kinds.map((k) => {
            const items = view.claimable.filter((r) => r.kind === k);
            if (!items.length) return null;
            return (
              <div key={k} className="panel">
                <div className="panel-head">
                  <h2>{KIND_LABEL[k]}</h2>
                </div>
                <div className="stack">
                  {items.map((r) => {
                    const b = applyBonus(r, view.bonus);
                    return (
                      <div key={r.id} className="quest done" data-testid={`reward-${r.id}`}>
                        <div className="qicon">{r.icon}</div>
                        <div>
                          <div className="qtitle">{r.title}</div>
                          <div className="qdesc" style={{ marginBottom: 0 }}>
                            {r.subtitle}
                          </div>
                        </div>
                        <div className="qside">
                          <Rewards xp={b.xp} coins={b.coins} packs={r.packs} />
                          <button className="btn primary sm" onClick={() => claim(r.id)}>
                            Claim
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="panel mt">
          <div className="panel-head">
            <h2>Recently claimed</h2>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {history.map((c) => (
              <div key={c.id} className="row between small">
                <span>{c.title}</span>
                <Rewards xp={c.xp} coins={c.coins} packs={c.packs} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
