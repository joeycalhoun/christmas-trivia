import React from 'react';
import { SECTION_BY_ID } from '../bank';
import type { TestSummary } from '../engine/scoring';
import type { ItemResult, Question, Response } from '../engine/types';
import { LETTERS } from './Answers';
import { GridView, VisualView } from './Figures';
import type { Session } from './Runner';

/** Bell curve of IQ scores from 55 to 145 with the result and its range marked. */
function BellCurve({ iq, low, high }: { iq: number; low: number; high: number }) {
  const W = 600;
  const H = 170;
  const top = 18;
  const base = 130;
  const x = (v: number) => ((v - 55) / 90) * W;
  const y = (v: number) => base - (base - top) * Math.exp(-(((v - 100) / 15) ** 2) / 2);
  const path = (from: number, to: number) => {
    const pts: string[] = [];
    for (let v = from; v <= to + 0.001; v += 0.5) pts.push(`${x(v).toFixed(1)},${y(v).toFixed(1)}`);
    return pts;
  };
  const curve = path(55, 145);
  const band = path(low, high);
  const ticks = [55, 70, 85, 100, 115, 130, 145];
  return (
    <svg viewBox={`-10 0 ${W + 20} ${H}`} className="bell" role="img" aria-label={`Your score of ${iq} on the normal distribution of IQ scores`}>
      <path d={`M${x(low)},${base} L${band.join(' L')} L${x(high)},${base} Z`} className="bell-band" />
      <path d={`M${curve.join(' L')}`} className="bell-line" />
      <line x1={0} x2={W} y1={base} y2={base} className="bell-axis" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={base} y2={base + 5} className="bell-axis" />
          <text x={x(t)} y={base + 20} textAnchor="middle" className="bell-tick">
            {t}
          </text>
        </g>
      ))}
      <line x1={x(iq)} x2={x(iq)} y1={y(iq) - 10} y2={base} className="bell-marker" />
      <circle cx={x(iq)} cy={y(iq) - 10} r={5} className="bell-dot" />
      <text x={x(115)} y={base + 36} textAnchor="middle" className="bell-note">
        1 SD
      </text>
      <text x={x(130)} y={base + 36} textAnchor="middle" className="bell-note">
        2 SD
      </text>
    </svg>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatResponse(q: Question, r: Response): React.ReactNode {
  const a = q.answer;
  if (a.kind === 'choice' && r.kind === 'choice') {
    if (r.index === null) return <em className="muted">No answer</em>;
    const o = a.options[r.index];
    return o.visual ? <OptionThumb letter={LETTERS[r.index]} q={q} index={r.index} /> : `${LETTERS[r.index]}. ${o.label}`;
  }
  if (r.kind === 'text') return r.value.trim() ? r.value : <em className="muted">No answer</em>;
  if (a.kind === 'multi' && r.kind === 'multi') return r.indices.length ? r.indices.map((i) => a.options[i]).join(', ') : <em className="muted">No answer</em>;
  if (a.kind === 'grid' && r.kind === 'grid')
    return (
      <span className="review-grid">
        <GridView size={a.size} lit={[]} marks={{ correct: a.cells, picked: r.cells }} label="Your squares compared with the lit squares" />
        <span className="hint">Filled: correct pick · ring: missed · cross-hatch: wrong pick</span>
      </span>
    );
  return null;
}

function OptionThumb({ q, index, letter }: { q: Question; index: number; letter: string }) {
  const a = q.answer;
  if (a.kind !== 'choice') return null;
  const o = a.options[index];
  return (
    <span className="thumb">
      <span className="bubble bubble-small">{letter}</span>
      {o.visual && <VisualView visual={o.visual} label={o.label} />}
    </span>
  );
}

function formatKey(q: Question): React.ReactNode {
  const a = q.answer;
  switch (a.kind) {
    case 'choice': {
      const o = a.options[a.correct];
      return o.visual ? <OptionThumb q={q} index={a.correct} letter={LETTERS[a.correct]} /> : `${LETTERS[a.correct]}. ${o.label}`;
    }
    case 'text':
      return a.mode === 'word' || a.mode === 'sequence' ? a.accept[0].toUpperCase() : a.accept[0];
    case 'multi':
      return a.correct.map((i) => a.options[i]).join(', ');
    case 'grid':
      return null;
  }
}

function status(r: ItemResult) {
  if (r.credit >= 1) return { text: 'Correct', cls: 'st-good' };
  if (r.timedOut && !hasContent(r.response)) return { text: 'Time ran out', cls: 'st-bad' };
  if (r.credit > 0) return { text: `Partial (${Math.round(r.credit * 100)}%)`, cls: 'st-warn' };
  return { text: hasContent(r.response) ? 'Incorrect' : 'Skipped', cls: 'st-bad' };
}

function hasContent(r: Response) {
  return r.kind === 'choice' ? r.index !== null : r.kind === 'text' ? r.value.trim() !== '' : r.kind === 'multi' ? r.indices.length > 0 : r.cells.length > 0;
}

interface Props {
  session: Session;
  summary: TestSummary;
  onRetake: () => void;
  onHome: () => void;
}

export function Results({ session, summary, onRetake, onHome }: Props) {
  const pct = Math.round(summary.percentile);
  const mins = Math.floor(summary.seconds / 60);
  const secs = Math.round(summary.seconds % 60);
  return (
    <div className="results">
      <header className="masthead">
        <p className="eyebrow">
          Score report · Form {session.formCode} · {session.form === 'full' ? 'Full battery' : 'Short form'}
          {session.relaxed ? ' · relaxed timing' : ''}
        </p>
        <h1>Your results</h1>
      </header>

      <section className="sheet score-card" aria-labelledby="score-h">
        <div className="score-main">
          <p className="eyebrow" id="score-h">
            Estimated IQ
          </p>
          <p className="score-big" data-testid="iq-score">
            {summary.iq}
          </p>
          <p className="score-band">{summary.band}</p>
          <p className="score-range">
            Likely range <b className="tnum">{summary.low}–{summary.high}</b>
          </p>
          <p className="score-pct">
            {pct >= 99 ? 'Higher than about 99% of people' : pct <= 1 ? 'Lower than about 99% of people' : `${ordinal(pct)} percentile: higher than about ${pct}% of people`}
          </p>
          {session.relaxed && <p className="pill pill-warn">Taken with relaxed timing, so this likely overstates a timed score.</p>}
        </div>
        <div className="score-chart">
          <BellCurve iq={summary.iq} low={summary.low} high={summary.high} />
          <dl className="stats">
            <div>
              <dt>Fully correct</dt>
              <dd className="tnum">
                {summary.correct} / {summary.items}
              </dd>
            </div>
            <div>
              <dt>Ran out of time</dt>
              <dd className="tnum">{summary.timedOut}</dd>
            </div>
            <div>
              <dt>Time spent answering</dt>
              <dd className="tnum">
                {mins}:{String(secs).padStart(2, '0')}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="sheet" aria-labelledby="sec-h">
        <h2 id="sec-h" className="sheet-h">
          Subtest profile
        </h2>
        <ul className="profile">
          {summary.sections.map((s) => {
            const p = Math.round(s.fraction * 100);
            return (
              <li key={s.section}>
                <span className="profile-name">{SECTION_BY_ID[s.section].name}</span>
                <span className="profile-bar" aria-hidden="true">
                  <span style={{ width: `${p}%` }} />
                  <i style={{ left: '52%' }} />
                </span>
                <span className="profile-val tnum">{p}%</span>
              </li>
            );
          })}
        </ul>
        <p className="hint">Weighted by item difficulty. The tick marks the assumed population average.</p>
      </section>

      <div className="results-actions">
        <button type="button" className="btn btn-primary" onClick={onRetake}>
          Take a new form
        </button>
        <button type="button" className="btn" onClick={onHome}>
          Back to start
        </button>
      </div>

      <section className="sheet" aria-labelledby="rev-h">
        <h2 id="rev-h" className="sheet-h">
          Item review
        </h2>
        <ol className="review">
          {session.results.map((r, i) => {
            const q = session.questions[i];
            const st = status(r);
            return (
              <li key={q.id} className="review-item">
                <details>
                  <summary>
                    <span className="review-num tnum">{i + 1}</span>
                    <span className="review-title">
                      {q.title}
                      <span className="muted"> · {SECTION_BY_ID[q.section].name}</span>
                    </span>
                    <span className={`review-status ${st.cls}`}>{st.text}</span>
                  </summary>
                  <div className="review-body">
                    {q.memorize && q.memorize.stimulus.kind !== 'grid' && (
                      <p className="review-stim">
                        <span className="muted">Shown: </span>
                        {q.memorize.stimulus.kind === 'words' ? q.memorize.stimulus.words.join(', ') : q.memorize.stimulus.text}
                      </p>
                    )}
                    <p className="review-prompt">{q.prompt}</p>
                    {q.visual && q.visual.kind !== 'figure' && (
                      <div className="review-visual">
                        <VisualView visual={q.visual} />
                      </div>
                    )}
                    <div className="review-answers">
                      <div>
                        <span className="eyebrow">Your answer</span>
                        <div>{formatResponse(q, r.response)}</div>
                      </div>
                      {q.answer.kind !== 'grid' && (
                        <div>
                          <span className="eyebrow">Correct answer</span>
                          <div>{formatKey(q)}</div>
                        </div>
                      )}
                    </div>
                    <p className="review-expl">{q.explanation}</p>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="disclaimer">
        This is an informal estimate, not a clinical assessment. A licensed psychologist using a standardized test such as the WAIS is the only
        way to get a formal IQ score.
      </p>
    </div>
  );
}
