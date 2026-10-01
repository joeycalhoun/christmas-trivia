import { NavLink, Link, Outlet } from 'react-router-dom';
import { useStore, useView } from '../store/store';
import { Bar } from './ui';
import { fmt } from '../lib/format';
import { HERO_CLASSES } from '../pages/Onboarding';

const NAV = [
  { to: '/', label: 'Home', ico: '🏰', mobile: true },
  { to: '/food', label: 'Food', ico: '🍽️', mobile: true },
  { to: '/train', label: 'Train', ico: '🏋️', mobile: true },
  { to: '/quests', label: 'Quests', ico: '📜', mobile: false },
  { to: '/rewards', label: 'Rewards', ico: '🎁', mobile: true },
  { to: '/cards', label: 'Cards', ico: '🃏', mobile: true },
  { to: '/store', label: 'Packs', ico: '📦', mobile: false },
  { to: '/hero', label: 'Hero', ico: '🛡️', mobile: true },
  { to: '/progress', label: 'Progress', ico: '📈', mobile: false },
  { to: '/settings', label: 'Settings', ico: '⚙️', mobile: false },
];

export function Layout() {
  const view = useView();
  const state = useStore((s) => s.state);
  const sync = useStore((s) => s.sync);
  const p = state.profile!;
  const c = view.character;
  const unclaimed = view.claimable.length;
  const unopened = state.packs.length;
  const title = view.titles.find((t) => t.id === p.title)?.title;
  const badgeFor = (to: string) => (to === '/rewards' ? unclaimed : to === '/store' ? unopened : 0);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.svg" alt="" /> IronQuest
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
            {badgeFor(n.to) > 0 && <span className={`badge ${n.to === '/store' ? 'gold' : ''}`}>{badgeFor(n.to)}</span>}
          </NavLink>
        ))}
        <div className="grow" />
        <div className={`sync ${sync}`} title="Where your progress is saved">
          <span className="dot" />
          {sync === 'server' ? 'Saved to server' : sync === 'saving' ? 'Saving…' : sync === 'local' ? 'Saved in this browser' : sync === 'error' ? 'Server unreachable — saved locally' : 'Loading…'}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Link to="/hero" className="hero-chip">
            <div className="avatar">{HERO_CLASSES[p.heroClass].icon}</div>
            <div className="meta">
              <div className="row nowrap" style={{ gap: 8 }}>
                <span className="lvl" data-testid="char-level">
                  Lv {c.level}
                  {c.paragon > 0 && `·P${c.paragon}`}
                </span>
                <span className="name">
                  {p.heroName}
                  {title && <span className="gold small"> {title}</span>}
                </span>
              </div>
              <Bar value={c.into} max={c.needed} tone="xp" />
            </div>
          </Link>
          <div className="wallet">
            <span title="Coins" data-testid="coins">
              🪙 {fmt(state.wallet.coins)}
            </span>
            <span title="Essence (from duplicate cards)">💎 {fmt(state.wallet.essence)}</span>
            {unclaimed > 0 && (
              <Link to="/rewards" className="btn primary sm claim" data-testid="rewards-btn">
                🎁 {unclaimed}
              </Link>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      <nav className="mobile-nav">
        {NAV.filter((n) => n.mobile).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{n.ico}</span>
            {n.label}
            {badgeFor(n.to) > 0 && <span className="badge">{badgeFor(n.to)}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
