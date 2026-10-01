import { useStore } from '../store/store';
import { PACKS } from '../game/cards';
import { fmt } from '../lib/format';

export function useClaim() {
  const claim = useStore((s) => s.claim);
  const toast = useStore((s) => s.toast);
  return (id: string) => {
    const a = claim(id);
    if (!a) return;
    const bits = [a.xp ? `+${fmt(a.xp)} XP` : '', a.coins ? `+${fmt(a.coins)} coins` : '', ...a.packs.map((p) => PACKS[p].label)].filter(Boolean);
    toast({ icon: a.reward.icon, title: a.reward.title, detail: bits.join(' · '), tone: 'gold' });
  };
}

export function useClaimAll() {
  const claimAll = useStore((s) => s.claimAll);
  const toast = useStore((s) => s.toast);
  return () => {
    const all = claimAll();
    if (!all.length) return;
    const xp = all.reduce((s, a) => s + a.xp, 0);
    const coins = all.reduce((s, a) => s + a.coins, 0);
    const packs = all.reduce((s, a) => s + a.packs.length, 0);
    toast({
      icon: '🎁',
      title: `Claimed ${all.length} reward${all.length === 1 ? '' : 's'}`,
      detail: [`+${fmt(xp)} XP`, `+${fmt(coins)} coins`, packs ? `${packs} pack${packs === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '),
      tone: 'gold',
    });
  };
}
