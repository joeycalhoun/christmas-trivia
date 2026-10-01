import { useEffect, useRef, useState } from 'react';
import { useStore, useView } from '../store/store';
import { CARD_BY_ID, PACKS, RARITY_INFO } from '../game/cards';
import { Modal } from './ui';
import { TradingCard } from './TradingCard';
import { zoneFor } from '../game/leveling';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? 'info'}`} onClick={() => dismiss(t.id)}>
          <div className="ti">{t.icon}</div>
          <div>
            <div style={{ fontWeight: 700 }}>{t.title}</div>
            {t.detail && <div className="small muted">{t.detail}</div>}
          </div>
          {t.action && (
            <button
              className="btn sm"
              onClick={(e) => {
                e.stopPropagation();
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Watches the derived game view for level-ups and freshly unlocked achievements. */
export function Watchers() {
  const view = useView();
  const setLevelUp = useStore((s) => s.setLevelUp);
  const toast = useStore((s) => s.toast);
  const prevLevel = useRef<number | null>(null);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const lvl = view.character.level;
    if (prevLevel.current !== null && lvl > prevLevel.current) setLevelUp({ level: lvl, rank: view.character.rank });
    prevLevel.current = lvl;
  }, [view.character.level, view.character.rank, setLevelUp]);

  useEffect(() => {
    const ids = new Set(view.claimable.map((r) => r.id));
    if (seen.current) {
      for (const r of view.claimable) {
        if (seen.current.has(r.id)) continue;
        if (r.kind === 'achievement') toast({ icon: r.icon, title: `Achievement: ${r.title}`, detail: r.subtitle, tone: 'gold' });
        else if (r.kind === 'daily' || r.kind === 'weekly') toast({ icon: r.icon, title: `Quest complete: ${r.title}`, detail: 'Claim your reward!', tone: 'good' });
        else if (r.kind === 'skill') toast({ icon: r.icon, title: `${r.title}!`, detail: r.subtitle, tone: 'good' });
        else if (r.kind === 'raid') toast({ icon: r.icon, title: 'Raid boss defeated!', detail: r.title, tone: 'gold' });
      }
    }
    seen.current = ids;
  }, [view.claimable, toast]);
  return null;
}

export function LevelUpModal() {
  const levelUp = useStore((s) => s.levelUp);
  const close = useStore((s) => s.setLevelUp);
  if (!levelUp) return null;
  const zone = zoneFor(levelUp.level);
  const newZone = zone.min === levelUp.level;
  return (
    <Modal onClose={() => close(null)}>
      <div className="levelup rays" data-testid="levelup">
        <div className="small gold" style={{ letterSpacing: '.3em', fontWeight: 800 }}>LEVEL UP</div>
        <div className="big">{levelUp.level}</div>
        <h2 className="mt">{levelUp.rank}</h2>
        {newZone && (
          <p className="muted">
            New zone unlocked: <b className="gold">{zone.name}</b>
            <br />
            <i>{zone.blurb}</i>
          </p>
        )}
        <p className="muted small">A level reward is waiting in your Rewards inbox.</p>
        <button className="btn primary mt" onClick={() => close(null)}>
          Onward!
        </button>
      </div>
    </Modal>
  );
}

export function PackReveal() {
  const reveal = useStore((s) => s.packReveal);
  const close = useStore((s) => s.closeReveal);
  const [open, setOpen] = useState<boolean[]>([]);
  useEffect(() => setOpen(reveal ? reveal.pulls.map(() => false) : []), [reveal]);
  if (!reveal) return null;
  const all = open.length > 0 && open.every(Boolean);
  const essence = reveal.pulls.reduce((s, p) => s + p.essence, 0);
  return (
    <Modal wide onClose={all ? close : undefined}>
      <div className="center" data-testid="pack-reveal">
        <h2 style={{ color: PACKS[reveal.type].color }}>📦 {reveal.count && reveal.count > 1 ? `${reveal.count} packs opened` : PACKS[reveal.type].label}</h2>
        <p className="muted small">{all ? 'Nice pulls!' : 'Tap each card to reveal it.'}</p>
        <div className={`reveal-row mt ${reveal.pulls.length > 8 ? 'many' : ''}`}>
          {reveal.pulls.map((p, i) => {
            const c = CARD_BY_ID[p.cardId];
            return (
              <div key={i} className={`flip ${open[i] ? 'open' : ''}`} onClick={() => setOpen((o) => o.map((v, j) => (j === i ? true : v)))} data-testid={`flip-${i}`}>
                <div className="flip-inner">
                  <div className="flip-face">
                    <div className={`card-back ${['rare', 'epic', 'legendary'].includes(c.rarity) ? `hint-${c.rarity}` : ''}`}>⚔️</div>
                  </div>
                  <div className="flip-face flip-back">
                    <TradingCard id={p.cardId} isNew={p.isNew} />
                  </div>
                </div>
                {open[i] && (
                  <div className="tiny mt" style={{ color: RARITY_INFO[c.rarity].color }}>
                    {p.isNew ? 'New card!' : `Duplicate → +${p.essence} 💎`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="row mt" style={{ justifyContent: 'center' }}>
          {!all ? (
            <button className="btn" onClick={() => setOpen(open.map(() => true))} data-testid="reveal-all">
              Reveal all
            </button>
          ) : (
            <>
              {essence > 0 && <span className="pill purple">+{essence} essence from duplicates</span>}
              <button className="btn primary" onClick={close} data-testid="reveal-done">
                Collect
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
