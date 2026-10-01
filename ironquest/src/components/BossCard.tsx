import type { RaidWeek } from '../game/raid';
import { DAMAGE_RULES } from '../game/raid';
import { addDays, prettyDate } from '../lib/dates';
import { fmt } from '../lib/format';
import { Bar } from './ui';

export function BossCard({ raid, daysLeft, detailed }: { raid: RaidWeek; daysLeft: number; detailed?: boolean }) {
  const remaining = Math.max(0, raid.hp - raid.damage);
  return (
    <div className={`panel boss ${raid.defeated ? 'defeated' : ''}`} data-testid="boss">
      <div className="panel-head">
        <h2>⚔️ Weekly Raid</h2>
        <span className="sub">
          {prettyDate(raid.weekStart)} – {prettyDate(addDays(raid.weekStart, 6))} · Tier {raid.tier + 1}
        </span>
      </div>
      <div className="row nowrap" style={{ gap: 16, alignItems: 'center' }}>
        <div className="boss-face">{raid.boss.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="boss-name">{raid.boss.name}</div>
          <div className="boss-taunt">“{raid.boss.taunt}”</div>
          <div className="mt">
            <Bar value={remaining} max={raid.hp} tone="boss" size="xl" label={raid.defeated ? 'DEFEATED' : `${fmt(remaining)} / ${fmt(raid.hp)} HP`} />
          </div>
          <div className="row between small muted" style={{ marginTop: 6 }}>
            <span>
              Damage dealt: <b className="red">{fmt(raid.damage)}</b>
            </span>
            <span>{raid.defeated ? '🏆 Loot ready in Rewards' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</span>
          </div>
        </div>
      </div>
      {detailed ? (
        <div className="mt">
          <div className="small muted mb">Every healthy action hits the boss:</div>
          <div className="grid two" style={{ gap: 8 }}>
            {DAMAGE_RULES.map((r) => (
              <div key={r.key} className="row between small" style={{ padding: '6px 10px', background: '#12162c', borderRadius: 8 }}>
                <span>
                  {r.label} <span className="dim">({r.per}/ea)</span>
                </span>
                <b className={raid.breakdown[r.key] ? 'red' : 'dim'}>{fmt(raid.breakdown[r.key])}</b>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="tiny dim mt">Protein days 1,000 · On-target days 1,200 · Workouts 600 + 25/set · Cardio 15/min · PRs 300</div>
      )}
    </div>
  );
}
