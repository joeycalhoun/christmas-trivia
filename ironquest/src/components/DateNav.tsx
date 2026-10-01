import { addDays, prettyDate } from '../lib/dates';

export function DateNav({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  return (
    <div className="row nowrap" style={{ gap: 6 }}>
      <button className="btn sm" onClick={() => onChange(addDays(date, -1))} aria-label="Previous day">
        ◀
      </button>
      <div style={{ minWidth: 120, textAlign: 'center', fontWeight: 700 }} data-testid="date-label">
        {prettyDate(date, today)}
      </div>
      <button className="btn sm" onClick={() => onChange(addDays(date, 1))} disabled={date >= today} aria-label="Next day">
        ▶
      </button>
      {date !== today && (
        <button className="btn sm ghost" onClick={() => onChange(today)}>
          Today
        </button>
      )}
    </div>
  );
}
