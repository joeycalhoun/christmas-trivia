import { Link } from 'react-router-dom';
import { useStore, useView } from '../store/store';
import { NutritionSummary } from '../components/NutritionSummary';
import { QuestRow } from '../components/QuestRow';
import { BossCard } from '../components/BossCard';
import { QuickLog } from '../components/QuickLog';
import { Bar, Rewards } from '../components/ui';
import { useClaimAll } from '../components/useClaim';
import { fmt } from '../lib/format';
import { addDays } from '../lib/dates';
import { useSealDay } from '../components/QuestRow';

export function Dashboard() {
  const view = useView();
  const state = useStore((s) => s.state);
  const claimAll = useClaimAll();
  const d = view.todayStats;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const doneDaily = view.daily.filter((q) => q.done).length;
  const seal = useSealDay();
  const yesterday = addDays(view.today, -1);
  const y = view.stats.day(yesterday);
  const nudgeYesterday = yesterday >= state.profile!.createdAt && y.logged && !y.sealed;

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>
            {greeting}, {state.profile!.heroName}
          </h1>
          <p>
            {view.character.zone.name} · {view.stats.currentStreak > 0 ? `🔥 ${view.stats.currentStreak}-day logging streak` : 'Log a meal to start a streak'}
          </p>
        </div>
        <div className="row">
          <Link to="/food" className="btn primary" data-testid="quick-food">
            + Log food
          </Link>
          <Link to="/train" className="btn">
            + Log workout
          </Link>
        </div>
      </div>

      {view.claimable.length > 0 && (
        <div className="panel tight mb row between" style={{ borderColor: '#6b5420', background: 'linear-gradient(90deg,#2a2210,#161b33)' }}>
          <div className="row">
            <span style={{ fontSize: 26 }}>🎁</span>
            <div>
              <b>
                {view.claimable.length} reward{view.claimable.length === 1 ? '' : 's'} ready to claim
              </b>
              <div className="small muted">Quests, achievements, and level-ups pay out coins and card packs.</div>
            </div>
          </div>
          <div className="row">
            <Link to="/rewards" className="btn sm">
              View
            </Link>
            <button className="btn primary sm claim" onClick={claimAll} data-testid="claim-all">
              Claim all
            </button>
          </div>
        </div>
      )}
      {nudgeYesterday && (
        <div className="panel tight mb row between">
          <span>
            🔒 Yesterday isn't sealed yet ({fmt(y.calories)} kcal, {fmt(y.protein)} g protein). Done logging it?
          </span>
          <div className="row">
            <Link to="/quests" className="btn sm ghost">
              Review
            </Link>
            <button className="btn sm good" onClick={() => seal(yesterday)} data-testid="seal-yesterday">
              Seal yesterday
            </button>
          </div>
        </div>
      )}
      {state.packs.length > 0 && (
        <div className="panel tight mb row between">
          <span>
            📦 You have <b>{state.packs.length}</b> unopened pack{state.packs.length === 1 ? '' : 's'}!
          </span>
          <Link to="/store" className="btn sm primary" data-testid="go-open-packs">
            Open packs
          </Link>
        </div>
      )}

      <div className="grid dash">
        <div className="stack" style={{ gap: 18 }}>
          <div className="panel">
            <div className="panel-head">
              <h2>Today's Fuel</h2>
              <Link to="/food" className="small">
                Food log →
              </Link>
            </div>
            <NutritionSummary d={d} today={view.today} />
            <hr className="sep" />
            <QuickLog date={view.today} />
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Daily Quests</h2>
              <span className="sub">
                {doneDaily}/{view.daily.length} complete · resets at midnight
              </span>
            </div>
            <div className="stack">
              {view.daily.map((q) => (
                <QuestRow key={q.id} q={q} />
              ))}
              <QuestRow q={view.dailySweep} />
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <BossCard raid={view.raid} daysLeft={view.daysLeftInWeek} />

          <div className="panel">
            <div className="panel-head">
              <h2>Almost There</h2>
              <Link to="/hero" className="small">
                All goals →
              </Link>
            </div>
            <div className="stack">
              {view.milestones.map((m, i) => (
                <div key={i}>
                  <div className="row between small">
                    <b>
                      {m.icon} {m.title}
                    </b>
                    <span className="muted">{Math.floor(m.ratio * 100)}%</span>
                  </div>
                  <div className="tiny muted" style={{ margin: '2px 0 5px' }}>
                    {m.detail}
                  </div>
                  <Bar value={m.ratio} max={1} tone="xp" />
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Weekly Challenges</h2>
              <Link to="/quests" className="small">
                {view.daysLeftInWeek} days left →
              </Link>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {view.weekly.map((q) => (
                <div key={q.id}>
                  <div className="row between small">
                    <span>
                      {q.icon} {q.title} {q.claimed && <span className="green">✓</span>}
                    </span>
                    <span className="muted">{q.label}</span>
                  </div>
                  <Bar value={q.progress} max={q.goal} tone={q.done ? 'gold' : 'blue'} />
                </div>
              ))}
              <div className="row between small mt">
                <b>👑 Complete all 6:</b>
                <Rewards xp={view.weeklySweep.xp} coins={view.weeklySweep.coins} packs={view.weeklySweep.packs} />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Skills</h2>
              <Link to="/hero" className="small">
                Hero →
              </Link>
            </div>
            <div className="stack">
              {view.skills.map((s) => (
                <div key={s.key} className="skill">
                  <div className="sicon">{s.icon}</div>
                  <div>
                    <div className="row between small">
                      <b>{s.name}</b>
                      <span className="muted">
                        {s.tier} · Lv {s.level}
                      </span>
                    </div>
                    <Bar value={s.into} max={s.needed || 1} tone="green" />
                    <div className="tiny dim" style={{ marginTop: 2 }}>
                      {fmt(s.into)} / {fmt(s.needed)} XP
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
