import { Link } from 'react-router-dom';
import { useStore, useView } from '../store/store';
import { weeklyQuests } from '../game/engine';
import { addDays, prettyDate, weekDays } from '../lib/dates';
import { fmt } from '../lib/format';

/** Summary of a finished week — raid result, challenges, and the numbers that matter. */
export function WeeklyRecap({ ws, compact }: { ws: string; compact?: boolean }) {
  const view = useView();
  const state = useStore((s) => s.state);
  const days = weekDays(ws).map((d) => view.stats.day(d));
  const prevDays = weekDays(addDays(ws, -7)).map((d) => view.stats.day(d));
  const raid = view.raids.find((r) => r.weekStart === ws);
  const { quests } = weeklyQuests(state, view.stats, ws);
  const done = quests.filter((q) => q.done).length;
  const logged = days.filter((d) => d.logged);
  const avgCal = logged.length ? logged.reduce((s, d) => s + d.calories, 0) / logged.length : 0;
  const avgW = (ds: typeof days) => {
    const w = ds.filter((d) => d.weighIn !== null).map((d) => d.weighIn!);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
  };
  const wNow = avgW(days);
  const wPrev = avgW(prevDays);
  const delta = wNow !== null && wPrev !== null ? wNow - wPrev : null;
  const score = done + (raid?.defeated ? 2 : 0);
  const verdict = score >= 7 ? '🏆 Legendary week!' : score >= 5 ? '💪 Strong week.' : score >= 3 ? '👍 Solid foundation.' : '🌱 Every week is a new raid. Reset and go again.';

  return (
    <div className="panel" data-testid="weekly-recap">
      <div className="panel-head">
        <h2>📊 Week in review</h2>
        <span className="sub">
          {prettyDate(ws)} – {prettyDate(addDays(ws, 6))}
        </span>
      </div>
      <p style={{ marginTop: 0 }}>
        <b>{verdict}</b>{' '}
        {raid && (
          <span className="muted">
            {raid.boss.icon} {raid.boss.name} {raid.defeated ? 'was defeated' : 'escaped'} ({fmt(raid.damage)} / {fmt(raid.hp)} damage).
          </span>
        )}
      </p>
      <div className="tiles">
        <div className="tile">
          <div className="k">Challenges</div>
          <div className="v">{done}/6</div>
        </div>
        <div className="tile">
          <div className="k">Protein days</div>
          <div className="v">{days.filter((d) => d.proteinHit).length}/7</div>
        </div>
        <div className="tile">
          <div className="k">On-target days</div>
          <div className="v">{days.filter((d) => d.onTarget).length}/7</div>
        </div>
        <div className="tile">
          <div className="k">Lifts · cardio</div>
          <div className="v">
            {days.filter((d) => d.strength).length} <small>· {days.reduce((s, d) => s + d.cardioMinutes, 0)} min</small>
          </div>
        </div>
        {!compact && (
          <>
            <div className="tile">
              <div className="k">Avg calories</div>
              <div className="v">{logged.length ? fmt(avgCal) : '—'}</div>
            </div>
            <div className="tile">
              <div className="k">Weight vs prior week</div>
              <div className={`v ${delta !== null && delta < 0 ? 'green' : ''}`}>{delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta, 1)} lb`}</div>
            </div>
          </>
        )}
      </div>
      {compact && (
        <div className="row mt" style={{ justifyContent: 'flex-end' }}>
          <Link to="/quests" className="small">
            Details →
          </Link>
        </div>
      )}
    </div>
  );
}
