import React, { useMemo, useState } from 'react';
import { ALL_SLOTS, SECTIONS } from '../bank';
import { buildMatrix } from '../bank/pattern';
import { type Form, freshFormsLeft, slotsFor, type SeenMap } from '../engine/builder';
import { makeRng } from '../engine/rng';
import type { HistoryEntry } from '../engine/storage';
import { FigureView, MatrixView } from './Figures';

interface Props {
  seen: SeenMap;
  history: HistoryEntry[];
  onStart: (form: Form, relaxed: boolean) => void;
  onReset: () => void;
}

const minutes = (form: Form) => {
  const slots = slotsFor(form);
  // Typical pace: about 60% of each answer limit, plus memorize time and subtest intros.
  const s = slots.reduce((t, s) => {
    const q = s.build(0);
    return t + q.timeLimit * 0.6 + (q.memorize?.seconds ?? 0);
  }, 0);
  return Math.round(s / 60 + 2);
};

export function Home({ seen, history, onStart, onReset }: Props) {
  const [form, setForm] = useState<Form>('full');
  const [relaxed, setRelaxed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const demo = useMemo(() => buildMatrix(makeRng(20261006), 2), []);
  const forms: { id: Form; name: string; blurb: string }[] = [
    { id: 'full', name: 'Full battery', blurb: 'All six subtests. The most reliable estimate.' },
    { id: 'quick', name: 'Short form', blurb: 'Two or three items per subtest. A rough estimate.' },
  ];

  return (
    <div className="home">
      <header className="masthead">
        <p className="eyebrow">Cognitive ability battery · 6 subtests · alternate forms</p>
        <h1>Six-Part IQ Test</h1>
        <p className="lede">
          Timed items covering verbal, quantitative, logical, matrix, spatial and working-memory reasoning. Every item has at least six alternate
          versions, so you can retake the test without seeing the same question twice.
        </p>
      </header>

      <div className="home-grid">
        <section className="sheet setup" aria-labelledby="setup-h">
          <h2 id="setup-h" className="sheet-h">
            Choose a form
          </h2>
          <div className="form-options" role="radiogroup" aria-label="Test form">
            {forms.map((f) => {
              const n = slotsFor(f.id).length;
              const fresh = freshFormsLeft(f.id, seen);
              return (
                <button key={f.id} type="button" role="radio" aria-checked={form === f.id} className="form-option" onClick={() => setForm(f.id)}>
                  <span className="bubble" aria-hidden="true" />
                  <span className="form-text">
                    <span className="form-name">{f.name}</span>
                    <span className="form-detail">
                      {n} items · about {minutes(f.id)} min
                    </span>
                    <span className="form-blurb">{f.blurb}</span>
                    <span className={fresh > 0 ? 'pill' : 'pill pill-warn'}>{fresh > 0 ? `${fresh} unseen ${fresh === 1 ? 'form' : 'forms'} left` : 'Some items will repeat'}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <fieldset className="timing">
            <legend>Timing</legend>
            <label className="toggle-row">
              <input id="timing-standard" type="radio" name="timing" checked={!relaxed} onChange={() => setRelaxed(false)} />
              <span>
                <b>Standard</b> — the limits used for scoring
              </span>
            </label>
            <label className="toggle-row">
              <input id="timing-relaxed" type="radio" name="timing" checked={relaxed} onChange={() => setRelaxed(true)} />
              <span>
                <b>Relaxed</b> — 1.5× answer time; the score is marked as untimed
              </span>
            </label>
          </fieldset>

          <button type="button" className="btn btn-primary btn-wide" onClick={() => onStart(form, relaxed)}>
            Start {form === 'full' ? 'full battery' : 'short form'}
          </button>
          <p className="hint">Find a quiet spot. Each item has its own clock, and you cannot go back to earlier items.</p>
        </section>

        <aside className="sheet sample" aria-labelledby="sample-h">
          <h2 id="sample-h" className="sheet-h">
            Sample item <span className="muted">· not scored</span>
          </h2>
          <p className="sample-prompt">Which figure completes the pattern?</p>
          <div className="sample-matrix">
            <MatrixView cells={demo.cells} />
          </div>
          <div className="sample-options">
            {demo.options.slice(0, 4).map((f, i) => (
              <span key={i} className="sample-opt">
                <span className="bubble bubble-small">{'ABCD'[i]}</span>
                <FigureView figure={f} />
              </span>
            ))}
          </div>
          <p className="hint">Answer: A. Each row follows the same rules; work out what changes from left to right and top to bottom.</p>
        </aside>
      </div>

      <section className="sheet subtests" aria-labelledby="sub-h">
        <h2 id="sub-h" className="sheet-h">
          Subtests
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Subtest</th>
                <th scope="col">Measures</th>
                <th scope="col" className="num">
                  Full
                </th>
                <th scope="col" className="num">
                  Short
                </th>
                <th scope="col" className="num">
                  Seconds per item
                </th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((s) => {
                const slots = ALL_SLOTS.filter((x) => x.section === s.id);
                const limits = slots.map((x) => x.build(0).timeLimit);
                return (
                  <tr key={s.id}>
                    <th scope="row">{s.name}</th>
                    <td>{s.measures}</td>
                    <td className="num">{slots.length}</td>
                    <td className="num">{slots.filter((x) => x.quick).length}</td>
                    <td className="num">
                      {Math.min(...limits)}–{Math.max(...limits)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sheet history" aria-labelledby="hist-h">
        <h2 id="hist-h" className="sheet-h">
          Your results
        </h2>
        {history.length === 0 ? (
          <p className="muted">No results yet. Scores and the list of questions you have seen are kept in this browser only.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Form</th>
                  <th scope="col" className="num">
                    Score
                  </th>
                  <th scope="col">Range</th>
                  <th scope="col" className="num">
                    Correct
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.at}>
                    <td>{new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                      {h.form === 'full' ? 'Full' : 'Short'} · {h.formCode}
                      {h.relaxed ? ' · relaxed' : ''}
                    </td>
                    <td className="num score-cell">{h.iq}</td>
                    <td>{h.band}</td>
                    <td className="num">
                      {h.correct}/{h.items}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="reset-row">
          {confirmReset ? (
            <span className="quit-confirm" role="group" aria-label="Confirm reset">
              Erase your results and seen-question history?
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                }}
              >
                Erase
              </button>
              <button type="button" className="btn btn-small" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmReset(true)}>
              Reset history
            </button>
          )}
        </div>
      </section>

      <p className="disclaimer">
        This is an informal estimate, not a clinical assessment. Scores are placed on the familiar IQ scale (mean 100, SD 15) using assumed norms,
        not a standardized sample, and can vary by several points between attempts.
      </p>
    </div>
  );
}
