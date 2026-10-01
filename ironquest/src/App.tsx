import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store/store';
import { Layout } from './components/Layout';
import { LevelUpModal, PackReveal, Toasts, Watchers } from './components/Overlays';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Food } from './pages/Food';
import { Train } from './pages/Train';
import { Quests } from './pages/Quests';
import { RewardsPage } from './pages/Rewards';
import { Cards } from './pages/Cards';
import { Store } from './pages/Store';
import { Hero } from './pages/Hero';
import { Settings } from './pages/Settings';
import { Guide } from './pages/Guide';

// Charts are the heaviest dependency; load them only when the Progress page opens.
const Progress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Progress })));

export function App() {
  const loaded = useStore((s) => s.loaded);
  const hasHero = useStore((s) => !!s.state.profile);
  const init = useStore((s) => s.init);
  const refreshToday = useStore((s) => s.refreshToday);
  const syncFromServer = useStore((s) => s.syncFromServer);

  useEffect(() => {
    init();
  }, [init]);

  // Roll over to a new day if the app is left open past midnight, and pick up changes made on
  // another device (e.g. logged on your phone, now looking at the laptop).
  useEffect(() => {
    const tick = () => {
      refreshToday();
      if (document.visibilityState === 'visible') syncFromServer();
    };
    const id = setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshToday, syncFromServer]);

  if (!loaded) {
    return (
      <div className="onboard center muted" style={{ paddingTop: 80 }}>
        <div style={{ fontSize: 48 }}>⚔️</div>
        Loading your saga…
      </div>
    );
  }

  if (!hasHero) {
    return (
      <>
        <Onboarding />
        <Toasts />
        <PackReveal />
      </>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="food" element={<Food />} />
          <Route path="train" element={<Train />} />
          <Route path="quests" element={<Quests />} />
          <Route path="rewards" element={<RewardsPage />} />
          <Route path="cards" element={<Cards />} />
          <Route path="store" element={<Store />} />
          <Route path="hero" element={<Hero />} />
          <Route path="progress" element={<Suspense fallback={<div className="muted">Loading charts…</div>}><Progress /></Suspense>} />
          <Route path="settings" element={<Settings />} />
          <Route path="guide" element={<Guide />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Watchers />
      <Toasts />
      <LevelUpModal />
      <PackReveal />
    </BrowserRouter>
  );
}
