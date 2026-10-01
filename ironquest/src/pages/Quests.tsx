import { useState } from 'react';
import { useStore, useView } from '../store/store';
import { QuestRow } from '../components/QuestRow';
import { BossCard } from '../components/BossCard';
import { NutritionSummary } from '../components/NutritionSummary';
import { dailyQuests } from '../game/engine';
import { addDays, prettyDate } from '../lib/dates';
import { fmt } from '../lib/format';

export function Quests() {
  const view = useView();
  const state = useStore((s) => s.state);
  const [tab, setTab] = useState<'daily' | 'weekly' | 'raid'>('daily');
  const yesterday = addDays(view.today, -1);
  const showYesterday = yesterday >= state.profile!.createdAt;
  const y = showYesterday ? dailyQuests(state, view.stats.day(yesterday)) : null;

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>📜 Quest Log</h1>
          <p>Dailies reset at midnight (2-day grace to claim). Weeklies and raids run Monday–Sunday.</p>
        </div>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>
          Daily
        </button>
        <button className={`tab ${tab === 'weekly' ? 'active' : ''}`} onClick={() => setTab('weekly')}>
          Weekly
        </button>
        <button className={`tab ${tab === 'raid' ? 'active' : ''}`} onClick={() => setTab('raid')} data-testid="raid-tab">
          Raid
        </button>
      </div>

      {tab === 'daily' && (
        <div className="grid two">
          <div className="panel">
            <div className="panel-head">
              <h2>Today</h2>
              <span className="sub">{prettyDate(view.today)}</span>
            </div>
            <div className="stack">
              {view.daily.map((q) => (
                <QuestRow key={q.id} q={q} />
              ))}
              <QuestRow q={view.dailySweep} />
            </div>
          </div>
          {y && (
            <div className="panel">
              <div className="panel-head">
                <h2>Yesterday — catch up</h2>
                <span className="sub">Forgot to log or seal? You still can.</span>
              </div>
              <div className="mb">
                <NutritionSummary d={view.stats.day(yesterday)} today={view.today} />
              </div>
              <div className="stack">
                {y.quests.map((q) => (
                  <QuestRow key={q.id} q={q} compact />
                ))}
                <QuestRow q={y.sweep} compact />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'weekly' && (
        <div className="panel">
          <div className="panel-head">
            <h2>This week's challenges</h2>
            <span className="sub">{view.daysLeftInWeek} days left</span>
          </div>
          <div className="stack">
            {view.weekly.map((q) => (
              <QuestRow key={q.id} q={q} />
            ))}
            <QuestRow q={view.weeklySweep} />
          </div>
        </div>
      )}

      {tab === 'raid' && (
        <div className="grid dash">
          <BossCard raid={view.raid} daysLeft={view.daysLeftInWeek} detailed />
          <div className="panel">
            <div className="panel-head">
              <h2>Raid history</h2>
              <span className="sub">{view.raidKills} bosses slain</span>
            </div>
            <div className="stack">
              {[...view.raids].reverse().map((r) => (
                <div key={r.weekStart} className="row between small" style={{ padding: '8px 10px', background: '#12162c', borderRadius: 10 }}>
                  <span>
                    {r.boss.icon} <b>{r.boss.name}</b>
                    <div className="tiny muted">
                      Week of {prettyDate(r.weekStart)} · {fmt(r.damage)} / {fmt(r.hp)} dmg
                    </div>
                  </span>
                  {r.defeated ? <span className="pill gold">Defeated</span> : r.weekStart === view.raid.weekStart ? <span className="pill blue">In progress</span> : <span className="pill red">Escaped</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
