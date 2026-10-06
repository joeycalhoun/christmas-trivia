import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SECTIONS } from './bank';
import { buildTest, type Form } from './engine/builder';
import { scoreResponse, summarize, type TestSummary } from './engine/scoring';
import { addHistory, clearAll, loadHistory, loadSeen, saveSeen } from './engine/storage';
import type { Response } from './engine/types';
import { Home } from './components/Home';
import { Results } from './components/Results';
import { answerSeconds, Runner, type Session } from './components/Runner';

export type AppState =
  | { screen: 'home' }
  | { screen: 'run'; session: Session }
  | { screen: 'results'; session: Session; summary: TestSummary };

interface HotApi {
  snapshot?: (fn: () => unknown) => void;
}
const hot = (): HotApi | undefined => (window as unknown as { claude?: { hot?: HotApi } }).claude?.hot;

export function App({ initial }: { initial?: AppState }) {
  const [state, setState] = useState<AppState>(initial ?? { screen: 'home' });
  const [seen, setSeen] = useState(loadSeen);
  const [history, setHistory] = useState(loadHistory);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Keep an in-progress test across live page updates.
  useEffect(() => {
    hot()?.snapshot?.(() => ({ state: stateRef.current }));
  }, []);

  const start = useCallback(
    (form: Form, relaxed: boolean) => {
      const built = buildTest(form, loadSeen(), (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
      // Record the items as seen now, so quitting or reloading does not let them come back fresh.
      saveSeen(built.seen);
      setSeen(built.seen);
      const now = Date.now();
      setState({
        screen: 'run',
        session: { form, relaxed, formCode: built.formCode, questions: built.questions, index: 0, phase: 'intro', phaseStart: now, results: [], startedAt: now },
      });
      window.scrollTo({ top: 0 });
    },
    [],
  );

  const update = (fn: (s: Session) => Session) =>
    setState((st) => (st.screen === 'run' ? { screen: 'run', session: fn(st.session) } : st));

  const onBegin = useCallback(() => {
    update((s) => ({ ...s, phase: s.questions[s.index].memorize ? 'memorize' : 'answer', phaseStart: Date.now() }));
  }, []);

  const onMemorized = useCallback(() => {
    update((s) => (s.phase === 'memorize' ? { ...s, phase: 'answer', phaseStart: Date.now() } : s));
  }, []);

  const onSubmit = useCallback((response: Response, timedOut: boolean) => {
    setState((st) => {
      if (st.screen !== 'run' || st.session.phase !== 'answer') return st;
      const s = st.session;
      const q = s.questions[s.index];
      const now = Date.now();
      const limit = answerSeconds(q, s.relaxed);
      const results = [
        ...s.results,
        {
          questionId: q.id,
          slotId: q.slotId,
          section: q.section,
          difficulty: q.difficulty,
          response,
          credit: scoreResponse(q, response),
          seconds: Math.min(limit, (now - s.phaseStart) / 1000),
          timedOut,
        },
      ];
      const nextIndex = s.index + 1;
      if (nextIndex >= s.questions.length) {
        const done = { ...s, results, index: s.questions.length - 1 };
        return { screen: 'results', session: done, summary: summarize(results, SECTIONS.map((x) => x.id)) };
      }
      const next = s.questions[nextIndex];
      const phase = next.section !== q.section ? 'intro' : next.memorize ? 'memorize' : 'answer';
      return { screen: 'run', session: { ...s, results, index: nextIndex, phase, phaseStart: now } };
    });
  }, []);

  // Save each finished test once.
  const savedFor = useRef<number | null>(null);
  useEffect(() => {
    if (state.screen !== 'results' || savedFor.current === state.session.startedAt) return;
    savedFor.current = state.session.startedAt;
    const { session, summary } = state;
    addHistory({
      at: Date.now(),
      form: session.form,
      formCode: session.formCode,
      relaxed: session.relaxed,
      iq: summary.iq,
      band: summary.band,
      correct: summary.correct,
      items: summary.items,
    });
    setHistory(loadHistory());
    window.scrollTo({ top: 0 });
  }, [state]);

  const goHome = useCallback(() => {
    setState({ screen: 'home' });
    setSeen(loadSeen());
    setHistory(loadHistory());
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <main className="page">
      {state.screen === 'home' && (
        <Home
          seen={seen}
          history={history}
          onStart={start}
          onReset={() => {
            clearAll();
            setSeen({});
            setHistory([]);
          }}
        />
      )}
      {state.screen === 'run' && <Runner session={state.session} onBegin={onBegin} onMemorized={onMemorized} onSubmit={onSubmit} onQuit={goHome} />}
      {state.screen === 'results' && (
        <Results session={state.session} summary={state.summary} onRetake={() => start(state.session.form, state.session.relaxed)} onHome={goHome} />
      )}
    </main>
  );
}
