import { useRef, useState } from 'react';
import { useStore, useView } from '../store/store';
import type { ActivityLevel, HeroClass, Pace, Sex } from '../game/types';
import { ACTIVITY_FACTORS, PACES, computeTargets } from '../game/nutrition';
import { NumberField, Tile } from '../components/ui';
import { HERO_CLASSES } from './Onboarding';
import { fmt } from '../lib/format';

export function Settings() {
  const view = useView();
  const state = useStore((s) => s.state);
  const sync = useStore((s) => s.sync);
  const updateProfile = useStore((s) => s.updateProfile);
  const importSave = useStore((s) => s.importSave);
  const resetAll = useStore((s) => s.resetAll);
  const toast = useStore((s) => s.toast);
  const p = state.profile!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState('');
  const auto = computeTargets({ ...p, calorieOverride: null, proteinOverride: null }, view.stats.latestWeight);
  const t = view.todayStats.targets;

  const exportSave = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ironquest-save-${view.today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !('profile' in data)) throw new Error('Not an IronQuest save');
      importSave(data);
      toast({ icon: '📥', title: 'Save imported', tone: 'good' });
    } catch (e) {
      toast({ icon: '⚠️', title: 'Import failed', detail: String((e as Error).message), tone: 'bad' });
    }
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>⚙️ Settings</h1>
          <p>Targets recalculate from your latest weigh-in ({fmt(view.stats.latestWeight, 1)} lb).</p>
        </div>
      </div>

      <div className="grid two">
        <div className="panel stack">
          <h2>Hero & body</h2>
          <div className="fields">
            <label className="field">
              Hero name
              <input type="text" value={p.heroName} onChange={(e) => updateProfile({ heroName: e.target.value })} />
            </label>
            <label className="field">
              Class
              <select value={p.heroClass} onChange={(e) => updateProfile({ heroClass: e.target.value as HeroClass })}>
                {(Object.keys(HERO_CLASSES) as HeroClass[]).map((k) => (
                  <option key={k} value={k}>
                    {HERO_CLASSES[k].icon} {HERO_CLASSES[k].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Sex
              <select value={p.sex} onChange={(e) => updateProfile({ sex: e.target.value as Sex })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <NumberField label="Age" value={p.age} onChange={(v) => v && updateProfile({ age: v })} />
            <NumberField label="Height" suffix="in" value={p.heightIn} onChange={(v) => v && updateProfile({ heightIn: v })} />
            <NumberField label="Starting weight" suffix="lb" value={p.startWeight} onChange={(v) => v && updateProfile({ startWeight: v })} />
            <NumberField label="Goal weight" suffix="lb" value={p.goalWeight} onChange={(v) => v && updateProfile({ goalWeight: v })} />
          </div>
          <label className="field">
            Activity level
            <select value={p.activity} onChange={(e) => updateProfile({ activity: e.target.value as ActivityLevel })}>
              {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_FACTORS[k].label} — {ACTIVITY_FACTORS[k].hint}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Fat-loss pace
            <select value={p.pace} onChange={(e) => updateProfile({ pace: e.target.value as Pace })}>
              {(Object.keys(PACES) as Pace[]).map((k) => (
                <option key={k} value={k}>
                  {PACES[k].label} — {PACES[k].hint}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="panel stack">
            <h2>Daily targets</h2>
            <div className="tiles">
              <Tile k="Maintenance (TDEE)" v={fmt(t.tdee)} />
              <Tile k="Calorie window" v={`${fmt(t.calorieMin)}–${fmt(t.calories)}`} />
              <Tile k="Protein" v={`${t.protein} g`} />
            </div>
            <div className="fields">
              <NumberField
                label="Override calories"
                value={p.calorieOverride ?? ''}
                placeholder={`auto: ${fmt(auto.calories)}`}
                onChange={(v) => updateProfile({ calorieOverride: v === '' ? null : v })}
              />
              <NumberField
                label="Override protein"
                suffix="g"
                value={p.proteinOverride ?? ''}
                placeholder={`auto: ${auto.protein}`}
                onChange={(v) => updateProfile({ proteinOverride: v === '' ? null : v })}
              />
            </div>
            <p className="tiny dim" style={{ margin: 0 }}>
              Leave blank to auto-calculate (Mifflin-St Jeor × activity − deficit, never more than 25% below maintenance and never under{' '}
              {fmt(t.floor)} kcal). Protein defaults to ~0.9 g per lb of goal weight.
            </p>
          </div>

          <div className="panel stack">
            <h2>Save data</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Status:{' '}
              <b>
                {sync === 'server'
                  ? 'Saved to the IronQuest server (data/save.json, with daily backups)'
                  : sync === 'local' || sync === 'error'
                    ? 'Saved in this browser only — run the IronQuest server to keep a file backup'
                    : 'Saving…'}
              </b>
            </p>
            <div className="row">
              <button className="btn" onClick={exportSave}>
                📤 Export save
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                📥 Import save
              </button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            </div>
            <hr className="sep" />
            <div className="small muted">Danger zone: type RESET to wipe everything and start over.</div>
            <div className="row nowrap">
              <input type="text" value={confirmReset} onChange={(e) => setConfirmReset(e.target.value)} placeholder="RESET" />
              <button className="btn danger" disabled={confirmReset !== 'RESET'} onClick={() => resetAll()}>
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
