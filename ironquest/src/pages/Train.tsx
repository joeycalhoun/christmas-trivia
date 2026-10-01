import { useMemo, useState } from 'react';
import { useStore, useView } from '../store/store';
import { CARDIO_TYPES, EXERCISES, EXERCISE_BY_ID, exerciseName, type MuscleGroup } from '../data/exercises';
import type { ExerciseEntry, SetEntry } from '../game/types';
import { DateNav } from '../components/DateNav';
import { QuickLog } from '../components/QuickLog';
import { NumberField, Tile } from '../components/ui';
import { prettyDate } from '../lib/dates';
import { fmt } from '../lib/format';
import { MIN_STRENGTH_SETS } from '../game/stats';

const GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full'];

export function Train() {
  const view = useView();
  const state = useStore((s) => s.state);
  const updateSession = useStore((s) => s.updateSession);
  const addExercise = useStore((s) => s.addExercise);
  const addCardio = useStore((s) => s.addCardio);
  const toast = useStore((s) => s.toast);
  const [date, setDate] = useState(view.today);
  const [exPick, setExPick] = useState('');
  const [cardioType, setCardioType] = useState(CARDIO_TYPES[0]);
  const [cardioMin, setCardioMin] = useState<number | ''>('');

  const session = state.sessions[date];
  const d = view.stats.day(date);
  const prsToday = view.stats.prs.filter((p) => p.date === date);

  /** Most recent earlier session containing each exercise — "last time you did…" */
  const lastTime = useMemo(() => {
    const out: Record<string, { date: string; sets: SetEntry[] }> = {};
    for (const k of Object.keys(state.sessions).sort()) {
      if (k >= date) break;
      for (const ex of state.sessions[k].exercises) {
        const valid = ex.sets.filter((s) => s.reps > 0);
        if (valid.length) out[ex.exerciseId] = { date: k, sets: valid };
      }
    }
    return out;
  }, [state.sessions, date]);

  const pastSessions = useMemo(
    () =>
      Object.keys(state.sessions)
        .filter((k) => k < date && state.sessions[k].exercises.length > 0)
        .sort()
        .reverse()
        .slice(0, 12),
    [state.sessions, date],
  );

  const patchExercise = (exId: string, fn: (e: ExerciseEntry) => ExerciseEntry | null) =>
    updateSession(date, (s) => ({
      ...s,
      exercises: s.exercises.map((e) => (e.id === exId ? fn(e) : e)).filter((e): e is ExerciseEntry => !!e),
    }));

  const doAddExercise = () => {
    if (!exPick) return;
    const prev = lastTime[exPick];
    // Pre-fill with last time's weight so you only need to type reps.
    addExercise(date, exPick, prev ? [{ weight: prev.sets[0].weight, reps: 0 }] : undefined);
    setExPick('');
  };

  const repeatWorkout = (from: string) => {
    const src = state.sessions[from];
    for (const ex of src.exercises) {
      const valid = ex.sets.filter((s) => s.reps > 0);
      addExercise(date, ex.exerciseId, valid.length ? valid.map((s) => ({ weight: s.weight, reps: 0 })) : undefined);
    }
    toast({ icon: '🔁', title: `Loaded workout from ${prettyDate(from)}`, detail: 'Weights pre-filled — enter your reps.', tone: 'good' });
  };

  const doAddCardio = () => {
    const m = Number(cardioMin);
    if (!m) return;
    addCardio(date, { type: cardioType, minutes: m });
    toast({ icon: '🫀', title: `${m} min ${cardioType.toLowerCase()} logged`, tone: 'good' });
    setCardioMin('');
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>🏋️ Training</h1>
          <p>Every working set feeds Ironworking. Beat last time to set a PR.</p>
        </div>
        <DateNav date={date} today={view.today} onChange={setDate} />
      </div>

      <div className="tiles mb">
        <Tile k="Working sets" v={d.sets} sub={d.strength ? '✅ Strength session' : `${MIN_STRENGTH_SETS} sets = a session`} />
        <Tile k="Volume" v={<>{fmt(d.volume)} <small>lb</small></>} />
        <Tile k="Cardio" v={<>{d.cardioMinutes} <small>min</small></>} />
        <Tile k="PRs" v={<span className={prsToday.length ? 'gold' : ''}>{prsToday.length} 🏆</span>} />
      </div>

      <div className="grid dash">
        <div className="stack" style={{ gap: 14 }}>
          <div className="panel">
            <div className="panel-head">
              <h2>Strength</h2>
              {pastSessions.length > 0 && (
                <select style={{ width: 'auto' }} value="" onChange={(e) => e.target.value && repeatWorkout(e.target.value)} data-testid="repeat-workout">
                  <option value="">🔁 Repeat a past workout…</option>
                  {pastSessions.map((k) => (
                    <option key={k} value={k}>
                      {prettyDate(k)} — {state.sessions[k].exercises.map((e) => exerciseName(e.exerciseId)).slice(0, 3).join(', ')}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="stack">
              {(session?.exercises ?? []).map((ex) => {
                const def = EXERCISE_BY_ID[ex.exerciseId];
                const prev = lastTime[ex.exerciseId];
                const pr = prsToday.find((p) => p.exerciseId === ex.exerciseId);
                const best = view.stats.bestE1rm[ex.exerciseId];
                return (
                  <div key={ex.id} className="exercise" data-testid="exercise">
                    <div className="row between">
                      <b>
                        {def?.name ?? ex.exerciseId} {pr && <span className="pill gold">🏆 PR!</span>}
                      </b>
                      <button className="btn xs ghost" onClick={() => patchExercise(ex.id, () => null)} aria-label="Remove exercise">
                        ✕
                      </button>
                    </div>
                    <div className="tiny muted">
                      {prev ? `Last time (${prettyDate(prev.date)}): ${prev.sets.map((s) => `${s.weight || 'BW'}×${s.reps}`).join(', ')}` : 'First time — set your baseline!'}
                      {best && !def?.bodyweight ? ` · Best e1RM ${fmt(best)} lb` : ''}
                    </div>
                    <div className="set-row tiny dim" style={{ marginTop: 8 }}>
                      <span className="center">Set</span>
                      <span>{def?.bodyweight ? 'Added lb' : 'Weight (lb)'}</span>
                      <span>Reps</span>
                      <span />
                    </div>
                    {ex.sets.map((s, i) => (
                      <div key={i} className="set-row">
                        <span className="set-idx">{i + 1}</span>
                        <NumberField
                          value={s.weight || ''}
                          placeholder={def?.bodyweight ? 'BW' : 'lb'}
                          onChange={(v) => patchExercise(ex.id, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === i ? { ...x, weight: Number(v) || 0 } : x)) }))}
                          testId="set-weight"
                        />
                        <NumberField
                          value={s.reps || ''}
                          placeholder="reps"
                          onChange={(v) => patchExercise(ex.id, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === i ? { ...x, reps: Math.max(0, Math.round(Number(v) || 0)) } : x)) }))}
                          testId="set-reps"
                        />
                        <button className="btn xs ghost" onClick={() => patchExercise(ex.id, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== i) }))} aria-label="Remove set">
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      className="btn sm mt"
                      onClick={() => patchExercise(ex.id, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] ?? { weight: 0, reps: 0 }) }] }))}
                      data-testid="add-set"
                    >
                      + Add set
                    </button>
                  </div>
                );
              })}
              {!session?.exercises.length && <div className="empty">No lifts logged {date === view.today ? 'today' : 'this day'}. Add an exercise below.</div>}
              <div className="row nowrap">
                <select value={exPick} onChange={(e) => setExPick(e.target.value)} data-testid="exercise-pick">
                  <option value="">Choose an exercise…</option>
                  {GROUPS.map((g) => (
                    <optgroup key={g} label={g[0].toUpperCase() + g.slice(1)}>
                      {EXERCISES.filter((e) => e.group === g).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button className="btn primary" onClick={doAddExercise} disabled={!exPick} data-testid="add-exercise">
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="panel">
            <div className="panel-head">
              <h2>Cardio</h2>
            </div>
            <div className="stack">
              {(session?.cardio ?? []).map((c) => (
                <div key={c.id} className="row between">
                  <span>
                    🫀 {c.type} — <b>{c.minutes} min</b>
                  </span>
                  <button className="btn xs ghost" onClick={() => updateSession(date, (s) => ({ ...s, cardio: s.cardio.filter((x) => x.id !== c.id) }))}>
                    ✕
                  </button>
                </div>
              ))}
              <div className="fields">
                <label className="field">
                  Type
                  <select value={cardioType} onChange={(e) => setCardioType(e.target.value)}>
                    {CARDIO_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <NumberField label="Minutes" value={cardioMin} onChange={setCardioMin} testId="cardio-min" />
              </div>
              <button className="btn" onClick={doAddCardio} disabled={!cardioMin} data-testid="add-cardio">
                + Log cardio
              </button>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Body & steps</h2>
            </div>
            <QuickLog date={date} />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>How XP works</h2>
            </div>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Each working set: 10 XP + up to 20 more for volume</li>
              <li>{MIN_STRENGTH_SETS}+ sets in a day = a strength session (+50 XP, quest credit)</li>
              <li>Beat your best estimated 1RM on any lift = PR (+75 XP, +300 raid damage)</li>
              <li>Cardio: 5 Endurance XP/min · Steps: 1 XP per 200</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
