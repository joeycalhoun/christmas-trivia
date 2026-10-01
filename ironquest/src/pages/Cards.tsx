import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, useView } from '../store/store';
import { CARDS, CARD_BY_ID, PERK_LABEL, RARITIES, RARITY_INFO, SETS } from '../game/cards';
import type { Rarity } from '../game/types';
import { TradingCard } from '../components/TradingCard';
import { Bar, Modal } from '../components/ui';
import { fmt } from '../lib/format';

export function Cards() {
  const view = useView();
  const state = useStore((s) => s.state);
  const setSlot = useStore((s) => s.setSquadSlot);
  const autoSquad = useStore((s) => s.autoSquad);
  const craft = useStore((s) => s.craft);
  const toast = useStore((s) => s.toast);
  const [picking, setPicking] = useState<number | null>(null);
  const [filterSet, setFilterSet] = useState<string>('all');
  const [filterRarity, setFilterRarity] = useState<Rarity | 'all'>('all');
  const [inspect, setInspect] = useState<string | null>(null);

  const owned = CARDS.filter((c) => state.cards[c.id]);
  const shown = CARDS.filter((c) => (filterSet === 'all' || c.set === filterSet) && (filterRarity === 'all' || c.rarity === filterRarity));
  const b = view.bonus;

  const doCraft = (id: string) => {
    if (craft(id)) toast({ icon: '✨', title: `Crafted ${CARD_BY_ID[id].name}!`, tone: 'gold' });
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>🃏 Squad & Collection</h1>
          <p>
            {owned.length} / {CARDS.length} cards collected · 💎 {fmt(state.wallet.essence)} essence
          </p>
        </div>
        <Link to="/store" className="btn primary">
          📦 Get packs
        </Link>
      </div>

      <div className="panel mb">
        <div className="panel-head">
          <h2>Active Squad</h2>
          <button
            className="btn sm"
            onClick={() => {
              autoSquad();
              toast({ icon: '🧠', title: 'Squad optimized', detail: 'Picked the cards that maximize your reward bonuses.', tone: 'good' });
            }}
            disabled={owned.length === 0}
            data-testid="auto-squad"
          >
            🧠 Auto-pick best
          </button>
          <span className="sub" style={{ flexBasis: '100%' }}>
            Team rating <b className="gold">{b.ovr}</b>
            {state.squad.some((x) => !x) && ' (empty slots count as 0 — fill all 5!)'} · Bonuses apply to every reward you claim
          </span>
        </div>
        <div className="squad">
          {state.squad.map((id, i) =>
            id ? (
              <TradingCard key={i} id={id} onClick={() => setPicking(i)} />
            ) : (
              <div key={i} className="slot" onClick={() => setPicking(i)} data-testid={`slot-${i}`}>
                + Add card
              </div>
            ),
          )}
        </div>
        <div className="row mt">
          <span className="pill purple">+{fmt(b.xpPct, 1)}% XP</span>
          <span className="pill gold">+{fmt(b.coinPct, 1)}% coins</span>
          {b.categoryPct.protein > 0 && <span className="pill green">+{b.categoryPct.protein}% protein quest coins</span>}
          {b.categoryPct.discipline > 0 && <span className="pill blue">+{b.categoryPct.discipline}% discipline quest coins</span>}
          {b.categoryPct.training > 0 && <span className="pill red">+{b.categoryPct.training}% training quest coins</span>}
          {b.categoryPct.raid > 0 && <span className="pill red">+{b.categoryPct.raid}% raid coins</span>}
        </div>
        <div className="tiny dim mt">
          Team rating above 60 gives +0.5% XP per point. Uncommon+ cards carry perks. 3 cards from the same set = chemistry (+5% coins); all 5 = +10% coins & +5% XP.
          {b.lines.length > 0 && <> Active: {b.lines.join(' · ')}</>}
        </div>
      </div>

      <div className="panel mb">
        <div className="panel-head">
          <h2>Sets</h2>
          <span className="sub">Complete a set for 2,500 coins + an Elite pack</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {view.sets.map((s) => (
            <div key={s.id} className="tile" style={{ cursor: 'pointer', borderColor: filterSet === s.id ? 'var(--gold2)' : undefined }} onClick={() => setFilterSet(filterSet === s.id ? 'all' : s.id)}>
              <div className="row between">
                <b>
                  {s.emblem} {s.name}
                </b>
                {s.complete && <span className="pill gold">✓</span>}
              </div>
              <div className="tiny muted" style={{ margin: '4px 0' }}>
                {s.owned} / {s.total}
              </div>
              <Bar value={s.owned} max={s.total} tone={s.complete ? 'gold' : 'green'} />
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Collection</h2>
          <div className="row">
            <select value={filterSet} onChange={(e) => setFilterSet(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">All sets</option>
              {SETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emblem} {s.name}
                </option>
              ))}
            </select>
            <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value as Rarity | 'all')} style={{ width: 'auto' }}>
              <option value="all">All rarities</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {RARITY_INFO[r].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filterSet !== 'all' && <p className="small muted" style={{ marginTop: 0 }}>{SETS.find((s) => s.id === filterSet)?.lore}</p>}
        <div className="card-grid">
          {shown.map((c) => {
            const have = !!state.cards[c.id];
            const cost = RARITY_INFO[c.rarity].craftCost;
            return (
              <div key={c.id}>
                <TradingCard id={c.id} locked={!have} onClick={() => setInspect(c.id)} />
                {!have && (
                  <button className="btn xs block mt" disabled={state.wallet.essence < cost} onClick={() => doCraft(c.id)} title="Craft with essence">
                    ✨ Craft · {fmt(cost)} 💎
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {picking !== null && (
        <Modal wide onClose={() => setPicking(null)}>
          <div className="panel-head">
            <h2>Choose a card for slot {picking + 1}</h2>
            <div className="row">
              {state.squad[picking] && (
                <button
                  className="btn sm danger"
                  onClick={() => {
                    setSlot(picking, null);
                    setPicking(null);
                  }}
                >
                  Remove
                </button>
              )}
              <button className="btn sm" onClick={() => setPicking(null)}>
                Close
              </button>
            </div>
          </div>
          {owned.length === 0 ? (
            <div className="empty">
              You don't own any cards yet. <Link to="/store">Open some packs!</Link>
            </div>
          ) : (
            <div className="card-grid">
              {[...owned]
                .sort((a, b) => b.ovr - a.ovr)
                .map((c) => (
                  <div key={c.id} style={{ opacity: state.squad.includes(c.id) && state.squad[picking] !== c.id ? 0.5 : 1 }}>
                    <TradingCard
                      id={c.id}
                      onClick={() => {
                        setSlot(picking, c.id);
                        setPicking(null);
                      }}
                    />
                    {state.squad.includes(c.id) && <div className="tiny center muted">In squad</div>}
                  </div>
                ))}
            </div>
          )}
        </Modal>
      )}

      {inspect && (
        <Modal onClose={() => setInspect(null)}>
          {(() => {
            const c = CARD_BY_ID[inspect];
            const have = !!state.cards[c.id];
            const set = SETS.find((s) => s.id === c.set)!;
            return (
              <div className="row nowrap" style={{ alignItems: 'flex-start', gap: 18 }}>
                <div style={{ width: 180, flex: 'none' }}>
                  <TradingCard id={c.id} locked={!have} />
                </div>
                <div className="stack">
                  <h2>{have ? c.name : 'Undiscovered card'}</h2>
                  <div className="small" style={{ color: RARITY_INFO[c.rarity].color }}>
                    {RARITY_INFO[c.rarity].label} {c.heroClass} · OVR {c.ovr}
                  </div>
                  <div className="small muted">
                    {set.emblem} {set.name} — {set.lore}
                  </div>
                  <div className="small">{c.perk ? `Perk: +${c.perk.value}% ${PERK_LABEL[c.perk.type]}` : 'No perk (commons add team rating).'}</div>
                  {!have && <div className="small muted">Pull it from a pack, or craft it for {fmt(RARITY_INFO[c.rarity].craftCost)} 💎.</div>}
                  <button className="btn sm" onClick={() => setInspect(null)}>
                    Close
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
