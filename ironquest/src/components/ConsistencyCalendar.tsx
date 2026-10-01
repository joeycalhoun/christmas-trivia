import type { DayStats } from '../game/stats';
import { addDays, prettyDate, weekStart } from '../lib/dates';
import { fmt } from '../lib/format';

type Status = 'perfect' | 'target' | 'protein' | 'over' | 'logged' | 'none' | 'future';

const STATUS: Record<Exclude<Status, 'future'>, { label: string; cls: string }> = {
  perfect: { label: 'On target + protein', cls: 'cal-perfect' },
  target: { label: 'On target', cls: 'cal-target' },
  protein: { label: 'Protein hit', cls: 'cal-protein' },
  over: { label: 'Over target', cls: 'cal-over' },
  logged: { label: 'Logged', cls: 'cal-logged' },
  none: { label: 'Nothing logged', cls: 'cal-none' },
};

function statusOf(d: DayStats): Status {
  if (d.onTarget && d.proteinHit) return 'perfect';
  if (d.onTarget) return 'target';
  if (d.proteinHit) return 'protein';
  if (d.sealed && d.calorieStatus === 'over') return 'over';
  if (d.logged) return 'logged';
  return 'none';
}

/** GitHub-style grid: one column per week, Monday at the top. A dot marks strength sessions. */
export function ConsistencyCalendar({ day, today, weeks = 16 }: { day: (d: string) => DayStats; today: string; weeks?: number }) {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const cells: { date: string; status: Status; d: DayStats | null }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    if (date > today) cells.push({ date, status: 'future', d: null });
    else {
      const d = day(date);
      cells.push({ date, status: statusOf(d), d });
    }
  }
  const counts = cells.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {});
  return (
    <div>
      <div className="cal" style={{ gridTemplateColumns: `22px repeat(${weeks}, 1fr)` }}>
        {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => (
          <div key={`l${i}`} className="cal-label" style={{ gridColumn: 1, gridRow: i + 1 }}>
            {l}
          </div>
        ))}
        {cells.map((c, i) => (
          <div
            key={c.date}
            className={`cal-cell ${c.status === 'future' ? 'cal-future' : STATUS[c.status].cls} ${c.date === today ? 'cal-today' : ''}`}
            style={{ gridColumn: Math.floor(i / 7) + 2, gridRow: (i % 7) + 1 }}
            title={
              c.d
                ? `${prettyDate(c.date)} — ${STATUS[c.status as Exclude<Status, 'future'>].label}${c.d.logged ? ` · ${fmt(c.d.calories)} kcal · ${fmt(c.d.protein)} g protein` : ''}${c.d.strength ? ' · 🏋️ lifted' : ''}`
                : prettyDate(c.date)
            }
          >
            {c.d?.strength && <span className="cal-dot" />}
          </div>
        ))}
      </div>
      <div className="row small muted mt" style={{ gap: 14 }}>
        {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((k) => (
          <span key={k} className="row" style={{ gap: 6 }}>
            <span className={`cal-cell ${STATUS[k].cls}`} style={{ width: 12, height: 12, display: 'inline-block' }} />
            {STATUS[k].label} <b className="num">{counts[k] ?? 0}</b>
          </span>
        ))}
        <span className="row" style={{ gap: 6 }}>
          <span className="cal-cell cal-logged" style={{ width: 12, height: 12, display: 'inline-grid', placeItems: 'center' }}>
            <span className="cal-dot" />
          </span>
          Strength session
        </span>
      </div>
    </div>
  );
}
