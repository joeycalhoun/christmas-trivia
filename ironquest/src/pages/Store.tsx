import { useStore } from '../store/store';
import { PACKS, PITY_LIMIT, RARITIES, RARITY_INFO } from '../game/cards';
import type { PackType } from '../game/types';
import { fmt } from '../lib/format';

const TYPES: PackType[] = ['bronze', 'silver', 'gold', 'elite'];
const PACK_ICON: Record<PackType, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', elite: '💜' };

export function Store() {
  const state = useStore((s) => s.state);
  const buy = useStore((s) => s.buy);
  const open = useStore((s) => s.open);
  const openAll = useStore((s) => s.openAll);
  const toast = useStore((s) => s.toast);
  const counts = TYPES.map((t) => state.packs.filter((p) => p === t).length);

  const doBuy = (t: PackType) => {
    if (buy(t)) toast({ icon: '📦', title: `Bought a ${PACKS[t].label}`, detail: 'Open it below!', tone: 'gold' });
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>📦 Pack Store</h1>
          <p>
            Coins come from quests, achievements, level-ups, and raids. You have <b className="gold">🪙 {fmt(state.wallet.coins)}</b>.
          </p>
        </div>
      </div>

      <div className="panel mb">
        <div className="panel-head">
          <h2>Your unopened packs</h2>
          <div className="row">
            <span className="sub">Legendary guaranteed within {PITY_LIMIT - state.pity} packs</span>
            {state.packs.length > 1 && (
              <button className="btn primary sm" onClick={openAll} data-testid="open-all">
                Open all ({state.packs.length})
              </button>
            )}
          </div>
        </div>
        {state.packs.length === 0 ? (
          <div className="empty">No unopened packs. Earn them from rewards or buy one below.</div>
        ) : (
          <div className="row" style={{ gap: 14 }}>
            {TYPES.map((t, i) =>
              counts[i] ? (
                <div key={t} className="pack" style={{ ['--pc' as string]: PACKS[t].color, width: 170 }}>
                  <div className="pack-art">{PACK_ICON[t]}</div>
                  <b>{PACKS[t].label}</b>
                  <span className="pill gold">× {counts[i]}</span>
                  <button className="btn primary block claim" onClick={() => open(t)} data-testid={`open-${t}`}>
                    Open
                  </button>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {TYPES.map((t) => {
          const p = PACKS[t];
          return (
            <div key={t} className="pack" style={{ ['--pc' as string]: p.color }}>
              <div className="pack-art">{PACK_ICON[t]}</div>
              <h3>{p.label}</h3>
              <div className="small muted">{p.blurb}</div>
              <div className="tiny" style={{ width: '100%' }}>
                {RARITIES.map((r) => (
                  <div key={r} className="row between">
                    <span style={{ color: RARITY_INFO[r].color }}>{RARITY_INFO[r].label}</span>
                    <span className="muted">{p.odds[r]}%</span>
                  </div>
                ))}
              </div>
              <button className="btn primary block" disabled={state.wallet.coins < p.cost} onClick={() => doBuy(t)} data-testid={`buy-${t}`}>
                Buy · 🪙 {fmt(p.cost)}
              </button>
            </div>
          );
        })}
      </div>
      <p className="tiny dim mt">
        Duplicates automatically melt into 💎 essence (Common {RARITY_INFO.common.dupeEssence} · Uncommon {RARITY_INFO.uncommon.dupeEssence} · Rare{' '}
        {RARITY_INFO.rare.dupeEssence} · Epic {RARITY_INFO.epic.dupeEssence} · Legendary {RARITY_INFO.legendary.dupeEssence}), which crafts any card you're missing.
      </p>
    </div>
  );
}
