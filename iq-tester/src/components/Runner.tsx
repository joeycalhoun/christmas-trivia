import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SECTION_BY_ID, SECTIONS } from '../bank';
import type { Form } from '../engine/builder';
import type { ItemResult, Question, Response, Stimulus } from '../engine/types';
import { AnswerInput, emptyResponse, hasAnswer } from './Answers';
import { GridView, VisualView } from './Figures';
import { formatClock, useCountdown } from './useCountdown';

export interface Session {
  form: Form;
  relaxed: boolean;
  formCode: string;
  questions: Question[];
  index: number;
  phase: 'intro' | 'memorize' | 'answer';
  /** Epoch ms when the current phase began. */
  phaseStart: number;
  results: ItemResult[];
  startedAt: number;
}

export const answerSeconds = (q: Question, relaxed: boolean) => Math.round(q.timeLimit * (relaxed ? 1.5 : 1));

interface Props {
  session: Session;
  onBegin: () => void;
  onMemorized: () => void;
  onSubmit: (response: Response, timedOut: boolean) => void;
  onQuit: () => void;
}

export function Runner({ session, onBegin, onMemorized, onSubmit, onQuit }: Props) {
  const q = session.questions[session.index];
  const section = SECTION_BY_ID[q.section];
  const sectionItems = session.questions.filter((x) => x.section === q.section);
  const sectionNumber = SECTIONS.filter((s) => session.questions.some((x) => x.section === s.id)).findIndex((s) => s.id === q.section) + 1;
  const sectionCount = new Set(session.questions.map((x) => x.section)).size;
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <div className="runner">
      <header className="run-head">
        <div className="run-meta">
          <span className="eyebrow">
            Subtest {sectionNumber} of {sectionCount} · {section.name}
          </span>
          <span className="run-count">
            Item <b>{session.index + 1}</b> / {session.questions.length}
          </span>
        </div>
        <div className="progress" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${(session.index / session.questions.length) * 100}%` }} />
        </div>
      </header>

      {session.phase === 'intro' && (
        <section className="sheet intro-card">
          <p className="eyebrow">Subtest {sectionNumber}</p>
          <h2>{section.name}</h2>
          <p className="lede">{section.measures}</p>
          <ul className="intro-facts">
            <li>
              <b>{sectionItems.length}</b> items
            </li>
            <li>
              <b>
                {Math.min(...sectionItems.map((x) => answerSeconds(x, session.relaxed)))}–{Math.max(...sectionItems.map((x) => answerSeconds(x, session.relaxed)))} s
              </b>{' '}
              per item
            </li>
            {sectionItems.some((x) => x.memorize) && <li>Items are shown briefly, then hidden</li>}
          </ul>
          <p className="hint">The clock starts when you press Begin. Unanswered items count as wrong when time runs out.</p>
          <button type="button" className="btn btn-primary" onClick={onBegin} autoFocus>
            Begin subtest
          </button>
        </section>
      )}

      {session.phase === 'memorize' && q.memorize && (
        <MemorizePhase key={q.id + ':m'} question={q} deadline={session.phaseStart + q.memorize.seconds * 1000} onDone={onMemorized} />
      )}

      {session.phase === 'answer' && (
        <AnswerPhase key={q.id} question={q} deadline={session.phaseStart + answerSeconds(q, session.relaxed) * 1000} total={answerSeconds(q, session.relaxed)} onSubmit={onSubmit} />
      )}

      <footer className="run-foot">
        <span className="form-code">
          Form {session.formCode}
          {session.relaxed ? ' · relaxed timing' : ''}
        </span>
        {confirmQuit ? (
          <span className="quit-confirm" role="group" aria-label="Confirm quit">
            Quit and discard this attempt?
            <button type="button" className="btn btn-small btn-danger" onClick={onQuit}>
              Quit
            </button>
            <button type="button" className="btn btn-small" onClick={() => setConfirmQuit(false)}>
              Keep going
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmQuit(true)}>
            Quit test
          </button>
        )}
      </footer>
    </div>
  );
}

function Clock({ remaining, total, label }: { remaining: number; total: number; label: string }) {
  const frac = Math.max(0, Math.min(1, remaining / (total * 1000)));
  const low = remaining <= Math.min(10_000, total * 250);
  return (
    <div className={low ? 'clock clock-low' : 'clock'} role="timer" aria-label={`${label}: ${Math.ceil(remaining / 1000)} seconds left`}>
      <span className="clock-label">{label}</span>
      <span className="clock-time">{formatClock(remaining)}</span>
      <span className="clock-bar" aria-hidden="true">
        <span style={{ width: `${frac * 100}%` }} />
      </span>
    </div>
  );
}

function StimulusView({ stimulus }: { stimulus: Stimulus }) {
  switch (stimulus.kind) {
    case 'text':
      return <p className={`stim stim-${stimulus.style}`}>{stimulus.text}</p>;
    case 'words':
      return (
        <ol className="stim-words">
          {stimulus.words.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ol>
      );
    case 'grid':
      return <GridView size={stimulus.size} lit={stimulus.cells} label="Squares to memorize" />;
  }
}

function MemorizePhase({ question, deadline, onDone }: { question: Question; deadline: number; onDone: () => void }) {
  const m = question.memorize!;
  const remaining = useCountdown(deadline, onDone);
  return (
    <section className="sheet q-card memorize" aria-live="polite" data-qid={question.id}>
      <div className="q-top">
        <span className="q-type">{question.title} · memorize</span>
        <Clock remaining={remaining} total={m.seconds} label="Hidden in" />
      </div>
      <p className="q-instruction">{m.instruction}</p>
      <div className="stim-box" data-testid="stimulus">
        <StimulusView stimulus={m.stimulus} />
      </div>
      <div className="q-actions">
        <button type="button" className="btn" onClick={onDone}>
          I'm ready, hide it
        </button>
      </div>
    </section>
  );
}

function AnswerPhase({ question, deadline, total, onSubmit }: { question: Question; deadline: number; total: number; onSubmit: (r: Response, timedOut: boolean) => void }) {
  const [draft, setDraft] = useState<Response>(() => emptyResponse(question.answer));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const done = useRef(false);

  const submit = useCallback(
    (timedOut: boolean) => {
      if (done.current) return;
      done.current = true;
      onSubmit(draftRef.current, timedOut);
    },
    [onSubmit],
  );
  const remaining = useCountdown(deadline, () => submit(true));
  const submitNow = useCallback(() => submit(false), [submit]);

  // Bring the item into view on small screens.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [question.id]);

  // Development-only hook so end-to-end tests can read the current item. Stripped from production builds.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __iqDebug?: unknown }).__iqDebug = { question };
  }, [question]);

  return (
    <section className="sheet q-card" data-qid={question.id}>
      <div className="q-top">
        <span className="q-type">{question.title}</span>
        <Clock remaining={remaining} total={total} label="Time left" />
      </div>
      <p className="q-prompt">{question.prompt}</p>
      {question.visual && (
        <div className={`q-visual q-visual-${question.visual.kind}`}>
          <VisualView visual={question.visual} />
        </div>
      )}
      <AnswerInput answer={question.answer} value={draft} onChange={setDraft} onSubmit={submitNow} />
      <div className="q-actions">
        <button type="button" className="btn btn-primary" onClick={submitNow} disabled={!hasAnswer(draft)}>
          Submit answer
        </button>
        <button type="button" className="btn btn-ghost" onClick={submitNow}>
          Skip
        </button>
      </div>
    </section>
  );
}
