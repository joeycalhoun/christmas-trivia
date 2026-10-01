import { CARD_BY_ID, PERK_LABEL, RARITY_INFO, SETS } from '../game/cards';

export function TradingCard({ id, locked, isNew, onClick, footer }: { id: string; locked?: boolean; isNew?: boolean; onClick?: () => void; footer?: React.ReactNode }) {
  const c = CARD_BY_ID[id];
  if (!c) return null;
  const r = RARITY_INFO[c.rarity];
  const set = SETS.find((s) => s.id === c.set);
  return (
    <div
      className={`tcg ${c.rarity} ${locked ? 'locked' : ''} ${onClick ? 'clickable' : ''}`}
      style={{ ['--rc' as string]: r.color }}
      onClick={onClick}
      title={`${c.name} — ${r.label} ${c.heroClass} (${set?.name})`}
      data-testid={`card-${id}`}
    >
      {isNew && <span className="newtag">NEW</span>}
      <div className="setmark">{set?.emblem}</div>
      <div className="ovr">{c.ovr}</div>
      <div className="cls">{c.heroClass}</div>
      <div className="portrait">{locked ? '❔' : c.icon}</div>
      <div className="cname">{locked ? '???' : c.name}</div>
      <div className="rarity">{r.label}</div>
      <div className="perk">{c.perk ? `+${c.perk.value}% ${PERK_LABEL[c.perk.type]}` : ''}</div>
      {footer}
    </div>
  );
}
