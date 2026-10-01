import { useMemo, useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Line, ComposedChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore, useView } from '../store/store';
import { Tile } from '../components/ui';
import { addDays, rangeKeys, shortDate, weekStart, prettyDate } from '../lib/dates';
import { fmt } from '../lib/format';
import { exerciseName } from '../data/exercises';

const AXIS = { stroke: '#6b739b', fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = { stroke: '#232a4d', strokeDasharray: '0', vertical: false } as const;
const TOOLTIP = {
  contentStyle: { background: '#1c2240', border: '1px solid #2a3158', borderRadius: 10, color: '#e8eaf6', fontSize: 12 },
  labelStyle: { color: '#9aa3c7' },
  cursor: { fill: 'rgba(255,255,255,0.04)', stroke: '#6b739b' },
};

export function Progress() {
  const view = useView();
  const state = useStore((s) => s.state);
  const [range, setRange] = useState(30);
  const p = state.profile!;
  const st = view.stats;
  const from = addDays(view.today, -(range - 1));
  const days = rangeKeys(from < p.createdAt ? p.createdAt : from, view.today);

  const daily = days.map((k) => {
    const d = st.day(k);
    return { date: shortDate(k), calories: d.calories || null, protein: d.protein || null, target: d.targets.calories, ptarget: d.targets.protein };
  });

  const weightData = useMemo(() => {
    const sorted = [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date));
    return sorted
      .map((w, i) => {
        const win = sorted.slice(Math.max(0, i - 6), i + 1);
        return { key: w.date, date: shortDate(w.date), weight: w.weight, trend: Math.round((win.reduce((s, x) => s + x.weight, 0) / win.length) * 10) / 10 };
      })
      .filter((w) => w.key >= from);
  }, [state.weighIns, from]);

  const weekly = useMemo(() => {
    const map = new Map<string, number>();
    for (const k of Object.keys(state.sessions)) {
      const ws = weekStart(k);
      map.set(ws, (map.get(ws) ?? 0) + st.day(k).volume);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([ws, v]) => ({ week: shortDate(ws), volume: v }));
  }, [state.sessions, st]);

  const logged = days.map((k) => st.day(k)).filter((d) => d.logged);
  const avgCal = logged.length ? logged.reduce((s, d) => s + d.calories, 0) / logged.length : 0;
  const avgP = logged.length ? logged.reduce((s, d) => s + d.protein, 0) / logged.length : 0;
  const toGoal = Math.max(0, st.trendWeight - p.goalWeight);

  const keyLifts = Object.entries(st.bestE1rm)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12);

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>📈 Progress</h1>
          <p>The long game. Trends matter more than any single day.</p>
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          {[14, 30, 90, 365].map((n) => (
            <button key={n} className={`tab ${range === n ? 'active' : ''}`} onClick={() => setRange(n)}>
              {n}d
            </button>
          ))}
        </div>
      </div>

      <div className="tiles mb">
        <Tile k="Trend weight" v={<>{fmt(st.trendWeight, 1)} <small>lb</small></>} sub={`Started at ${fmt(p.startWeight, 1)}`} />
        <Tile k="Lost so far" v={<span className="green">{fmt(st.lostLb, 1)} <small>lb</small></span>} sub={`${fmt(toGoal, 1)} lb to goal (${p.goalWeight})`} />
        <Tile k={`Avg calories (${range}d)`} v={fmt(avgCal)} sub={`${logged.length} logged days`} />
        <Tile k={`Avg protein (${range}d)`} v={<>{fmt(avgP)} <small>g</small></>} />
        <Tile k="Strength sessions" v={st.totals.workouts} sub={`${fmt(st.totals.volume)} lb moved`} />
        <Tile k="Best streak" v={<>{st.bestStreak} <small>days</small></>} sub={`Current: ${st.currentStreak}`} />
      </div>

      <div className="grid two">
        <div className="panel">
          <div className="panel-head">
            <h2>Body weight</h2>
            <span className="sub">Dots = weigh-ins · line = 7-weigh-in trend · dashed = goal</span>
          </div>
          {weightData.length < 2 ? (
            <div className="empty">Log at least two weigh-ins to see your trend.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={weightData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="date" {...AXIS} minTickGap={20} />
                <YAxis {...AXIS} domain={[(min: number) => Math.floor(Math.min(min, p.goalWeight) - 2), (max: number) => Math.ceil(max + 2)]} />
                <Tooltip {...TOOLTIP} />
                <ReferenceLine y={p.goalWeight} stroke="#34d399" strokeDasharray="5 5" label={{ value: 'Goal', fill: '#9aa3c7', fontSize: 11, position: 'insideBottomRight' }} />
                <Scatter isAnimationActive={false} dataKey="weight" name="Weigh-in" fill="#9aa3c7" />
                <Line isAnimationActive={false} dataKey="trend" name="Trend" stroke="#f5c451" strokeWidth={2} dot={false} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Calories</h2>
            <span className="sub">Dashed = your daily ceiling</span>
          </div>
          {logged.length === 0 ? (
            <div className="empty">No food logged in this range yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="date" {...AXIS} minTickGap={20} />
                <YAxis {...AXIS} />
                <Tooltip {...TOOLTIP} />
                <RBar isAnimationActive={false} dataKey="calories" name="Calories" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Line isAnimationActive={false} dataKey="target" name="Target" stroke="#f5c451" strokeWidth={2} strokeDasharray="5 5" dot={false} type="stepAfter" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Protein</h2>
            <span className="sub">Dashed = your daily target</span>
          </div>
          {logged.length === 0 ? (
            <div className="empty">No food logged in this range yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="date" {...AXIS} minTickGap={20} />
                <YAxis {...AXIS} />
                <Tooltip {...TOOLTIP} />
                <RBar isAnimationActive={false} dataKey="protein" name="Protein (g)" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Line isAnimationActive={false} dataKey="ptarget" name="Target (g)" stroke="#f5c451" strokeWidth={2} strokeDasharray="5 5" dot={false} type="stepAfter" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Weekly training volume</h2>
            <span className="sub">Total lb lifted per week</span>
          </div>
          {weekly.length === 0 ? (
            <div className="empty">Log a workout to start tracking volume.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="week" {...AXIS} />
                <YAxis {...AXIS} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip {...TOOLTIP} formatter={(v) => `${fmt(Number(v))} lb`} />
                <RBar isAnimationActive={false} dataKey="volume" name="Volume" fill="#c084fc" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid two mt">
        <div className="panel">
          <div className="panel-head">
            <h2>Strength — best estimated 1RM</h2>
          </div>
          {keyLifts.length === 0 ? (
            <div className="empty">No lifts logged yet.</div>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {keyLifts.map(([id, v]) => (
                <div key={id} className="row between small">
                  <span>{exerciseName(id)}</span>
                  <b className="num">{fmt(v)} lb</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Personal records</h2>
            <span className="sub">{st.prs.length} total</span>
          </div>
          {st.prs.length === 0 ? (
            <div className="empty">Beat a previous best on any lift to set a PR.</div>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {[...st.prs]
                .reverse()
                .slice(0, 12)
                .map((pr, i) => (
                  <div key={i} className="row between small">
                    <span>
                      🏆 {exerciseName(pr.exerciseId)} <span className="dim">· {prettyDate(pr.date)}</span>
                    </span>
                    <b className="num">
                      {pr.weight || 'BW'} × {pr.reps}
                    </b>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
