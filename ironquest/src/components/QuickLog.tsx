import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { NumberField } from './ui';

/** Inline weigh-in + steps inputs that commit on blur/enter. */
export function QuickLog({ date }: { date: string }) {
  const state = useStore((s) => s.state);
  const logWeight = useStore((s) => s.logWeight);
  const setSteps = useStore((s) => s.setSteps);
  const toast = useStore((s) => s.toast);
  const savedW = state.weighIns.find((w) => w.date === date)?.weight ?? '';
  const savedS = state.steps[date] ?? '';
  const [w, setW] = useState<number | ''>(savedW);
  const [s, setS] = useState<number | ''>(savedS);
  useEffect(() => setW(savedW), [savedW, date]);
  useEffect(() => setS(savedS), [savedS, date]);

  const commitW = () => {
    if (w === savedW) return;
    logWeight(date, w === '' ? null : w);
    if (w !== '') toast({ icon: '⚖️', title: `Weigh-in logged: ${w} lb`, tone: 'good' });
  };
  const commitS = () => {
    if (s === savedS) return;
    setSteps(date, s === '' ? 0 : s);
  };
  return (
    <div className="fields" onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}>
      <div onBlur={commitW}>
        <NumberField label="⚖️ Weigh-in" suffix="lb" value={w} onChange={setW} placeholder="e.g. 214.6" testId="weigh-input" />
      </div>
      <div onBlur={commitS}>
        <NumberField label="🚶 Steps" value={s} onChange={setS} placeholder="e.g. 8000" testId="steps-input" />
      </div>
    </div>
  );
}
