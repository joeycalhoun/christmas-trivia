import { Link } from 'react-router-dom';
import { useStore, useView } from '../store/store';
import { HERO_CLASSES } from './Onboarding';
import { Bar } from '../components/ui';
import { ZONES, CHAR_MAX_LEVEL } from '../game/leveling';
import { tierReward } from '../game/achievements';
import { fmt } from '../lib/format';

const GROUPS = ['Body', 'Nutrition', 'Training', 'Strength', 'Glory'] as const;

export function Hero() {
  const view = useView();
  const state = useStore((s) => s.state);
  const updateProfile = useStore((s) => s.updateProfile);
  const p = state.profile!;
  const c = view.character;
  const title = view.titles.find((t) => t.id === p.title)?.title;

  return (
    <div>
      <div className="row mb mobile-links">
        <Link to="/quests" className="btn sm">📜 Quests</Link>
        <Link to="/store" className="btn sm">📦 Packs</Link>
        <Link to="/progress" className="btn sm">📈 Progress</Link>
        <Link to="/settings" className="btn sm">⚙️ Settings</Link>
        <Link to="/guide" className="btn sm">❓ Guide</Link>
      </div>
      <div className="panel mb">
        <div className="row nowrap" style={{ gap: 18, alignItems: 'center' }}>
          <div className="avatar lg">{HERO_CLASSES[p.heroClass].icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>
              {p.heroName} {title && <span className="gold" style={{ fontSize: '1rem' }}>{title}</span>}
            </h1>
            <div className="muted">
              Level <b className="gold">{c.level}</b>
              {c.paragon > 0 && <> · Paragon {c.paragon}</>} {HERO_CLASSES[p.heroClass].name} · {c.rank} · {fmt(view.achievementPoints)} achievement points
            </div>
            <div className="mt">
              <Bar value={c.into} max={c.needed} tone="xp" size="lg" label={`${fmt(c.into)} / ${fmt(c.needed)} XP${c.maxed ? ' (Paragon)' : ''}`} />
            </div>
          </div>
        </div>
        <div className="row mt">
          <label className="row small muted" style={{ gap: 8 }}>
            Title:
            <select value={p.title ?? ''} onChange={(e) => updateProfile({ title: e.target.value || null })} style={{ width: 'auto' }}>
              <option value="">(none)</option>
              {view.titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <span className="tiny dim">Unlock titles from achievements. Total XP: {fmt(c.total)}</span>
        </div>
      </div>

      <div className="grid two mb">
        <div className="panel">
          <div className="panel-head">
            <h2>Professions</h2>
            <span className="sub">Level 1–100 · new tier every 25</span>
          </div>
          <div className="stack" style={{ gap: 16 }}>
            {view.skills.map((s) => (
              <div key={s.key} className="skill">
                <div className="sicon">{s.icon}</div>
                <div>
                  <div className="row between">
                    <b>{s.name}</b>
                    <span className="small">
                      <span className="pill green">{s.tier}</span> Lv <b>{s.level}</b>
                    </span>
                  </div>
                  <div className="tiny muted" style={{ margin: '2px 0 6px' }}>
                    {s.blurb}
                  </div>
                  <Bar value={s.into} max={s.needed || 1} tone="green" label={s.maxed ? 'MAX' : `${fmt(s.into)} / ${fmt(s.needed)}`} size="lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>The Road to Level {CHAR_MAX_LEVEL}</h2>
            <span className="sub">You are in {c.zone.name}</span>
          </div>
          <div className="zones">
            {ZONES.map((z) => {
              const cur = z.name === c.zone.name;
              const locked = c.level < z.min;
              return (
                <div key={z.name} className={`zone ${cur ? 'current' : ''} ${locked ? 'locked' : ''}`}>
                  <div className="zr">
                    Lv {z.min}–{z.max} {cur && '· YOU ARE HERE'}
                  </div>
                  <b className="small">{locked ? '🔒 ' : ''}{z.name}</b>
                  <div className="tiny muted">{z.blurb}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Achievements</h2>
          <span className="sub">{fmt(view.achievementPoints)} points</span>
        </div>
        {GROUPS.map((g) => (
          <div key={g} className="mb">
            <h3 className="muted mb">{g}</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {view.achievements
                .filter((a) => a.track.group === g)
                .map((a) => (
                  <div key={a.track.key} className="tile">
                    <div className="row between">
                      <b>
                        {a.track.icon} {a.track.name}
                      </b>
                      <span className="small muted">
                        {a.earned + 1}/{a.track.tiers.length}
                      </span>
                    </div>
                    {a.next ? (
                      <>
                        <div className="tiny muted" style={{ margin: '4px 0' }}>
                          Next: <b>{a.next.name}</b> — {a.track.describe(a.next.n)}
                          {a.next.title && <span className="gold"> · Title “{a.next.title}”</span>}
                        </div>
                        <Bar value={a.ratio} max={1} tone="xp" />
                        <div className="tiny dim" style={{ marginTop: 3 }}>
                          {fmt(a.value, 1)} / {fmt(a.next.n)} {a.track.unit} · reward{' '}
                          {(() => {
                            const r = tierReward(a.earned + 1, a.track.tiers.length);
                            return `${r.xp} XP, ${r.coins} coins${r.packs.length ? `, ${r.packs[0]} pack` : ''}`;
                          })()}
                        </div>
                      </>
                    ) : (
                      <div className="tiny gold" style={{ margin: '4px 0' }}>
                        ✨ Track complete!
                      </div>
                    )}
                    <div className="ach-tiers">
                      {a.track.tiers.map((t, i) => (
                        <span key={t.n} className={`ach-tier ${i <= a.earned ? 'got' : ''}`} title={`${t.name}: ${a.track.describe(t.n)}`}>
                          {fmt(t.n)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
