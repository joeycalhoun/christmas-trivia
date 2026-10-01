import { useMemo, useState } from 'react';
import { useStore, useView } from '../store/store';
import type { FoodItem, MealSlot } from '../game/types';
import { FOOD_DB } from '../data/foods';
import { DateNav } from '../components/DateNav';
import { NutritionSummary } from '../components/NutritionSummary';
import { NumberField } from '../components/ui';
import { CustomFoodEditor, FoodEntryEditor, SaveMealModal } from '../components/FoodEditors';
import type { FoodEntry } from '../game/types';
import { addDays } from '../lib/dates';
import { fmt } from '../lib/format';

const MEALS: { key: MealSlot; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: '🍳' },
  { key: 'lunch', label: 'Lunch', icon: '🥪' },
  { key: 'dinner', label: 'Dinner', icon: '🍲' },
  { key: 'snack', label: 'Snacks', icon: '🍎' },
];

function defaultMeal(): MealSlot {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}

interface Pickable extends FoodItem {
  source: 'recent' | 'mine' | 'db';
}

export function Food() {
  const view = useView();
  const state = useStore((s) => s.state);
  const addFood = useStore((s) => s.addFood);
  const removeFood = useStore((s) => s.removeFood);
  const restoreFood = useStore((s) => s.restoreFood);
  const saveCustomFood = useStore((s) => s.saveCustomFood);
  const removeCustomFood = useStore((s) => s.removeCustomFood);
  const toast = useStore((s) => s.toast);
  const [date, setDate] = useState(view.today);
  const [meal, setMeal] = useState<MealSlot>(defaultMeal());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Pickable | null>(null);
  const [servings, setServings] = useState<number | ''>(1);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [editingMine, setEditingMine] = useState<FoodItem | null>(null);
  const [savingMeal, setSavingMeal] = useState<MealSlot | null>(null);
  const [qa, setQa] = useState<{ name: string; calories: number | ''; protein: number | ''; save: boolean }>({ name: '', calories: '', protein: '', save: false });

  const d = view.stats.day(date);
  const entries = state.foods.filter((f) => f.date === date).sort((a, b) => a.loggedAt - b.loggedAt);
  const yesterday = addDays(date, -1);
  const yEntries = state.foods.filter((f) => f.date === yesterday);

  const recents: Pickable[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Pickable[] = [];
    for (const f of [...state.foods].sort((a, b) => b.loggedAt - a.loggedAt)) {
      const key = f.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const sv = f.servings || 1;
      out.push({ id: `recent_${key}`, name: f.name, serving: '1 serving', calories: Math.round(f.calories / sv), protein: Math.round((f.protein / sv) * 10) / 10, source: 'recent' });
      if (out.length >= 15) break;
    }
    return out;
  }, [state.foods]);

  const mine: Pickable[] = state.customFoods.map((f) => ({ ...f, source: 'mine' as const }));
  const q = query.trim().toLowerCase();
  const results: Pickable[] = useMemo(() => {
    if (!q) return [];
    const words = q.split(/\s+/);
    const match = (f: FoodItem) => words.every((w) => f.name.toLowerCase().includes(w));
    const names = new Set<string>();
    const out: Pickable[] = [];
    for (const f of [...mine, ...recents, ...FOOD_DB.map((f) => ({ ...f, source: 'db' as const }))]) {
      if (!match(f) || names.has(f.name.toLowerCase())) continue;
      names.add(f.name.toLowerCase());
      out.push(f);
    }
    return out.slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, state.customFoods, recents]);

  const remainingCal = d.targets.calories - d.calories;
  const remainingP = d.targets.protein - d.protein;
  const smartPicks: Pickable[] = useMemo(() => {
    if (remainingP < 15 || remainingCal < 80) return [];
    const pool: Pickable[] = [...mine, ...FOOD_DB.map((f) => ({ ...f, source: 'db' as const }))];
    return pool
      .filter((f) => f.calories > 0 && f.calories <= remainingCal && f.protein >= 10)
      .sort((a, b) => b.protein / b.calories - a.protein / a.calories)
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingCal, remainingP, state.customFoods]);

  const sv = Number(servings) || 0;
  const logPicked = () => {
    if (!picked || sv <= 0) return;
    addFood({
      date,
      meal,
      name: picked.name,
      calories: Math.round(picked.calories * sv),
      protein: Math.round(picked.protein * sv * 10) / 10,
      servings: sv,
      foodId: picked.id,
    });
    toast({ icon: '🍽️', title: `Logged ${picked.name}`, detail: `${fmt(picked.calories * sv)} kcal · ${fmt(picked.protein * sv, 1)} g protein`, tone: 'good' });
    setPicked(null);
    setServings(1);
    setQuery('');
  };

  const quickAdd = () => {
    const cals = Number(qa.calories) || 0;
    const prot = Number(qa.protein) || 0;
    if (!qa.name.trim() && !cals) return;
    const name = qa.name.trim() || 'Quick add';
    addFood({ date, meal, name, calories: Math.round(cals), protein: prot, servings: 1 });
    if (qa.save && qa.name.trim()) saveCustomFood({ name, serving: '1 serving', calories: Math.round(cals), protein: prot });
    toast({ icon: '🍽️', title: `Logged ${name}`, detail: `${fmt(cals)} kcal · ${fmt(prot, 1)} g protein`, tone: 'good' });
    setQa({ name: '', calories: '', protein: '', save: false });
  };

  const copyMeal = (slot: MealSlot) => {
    const src = yEntries.filter((f) => f.meal === slot);
    for (const f of src) addFood({ date, meal: slot, name: f.name, calories: f.calories, protein: f.protein, servings: f.servings, foodId: f.foodId });
    toast({ icon: '📋', title: `Copied ${src.length} item${src.length === 1 ? '' : 's'} from yesterday`, tone: 'good' });
  };

  const renderList = (items: Pickable[], testPrefix: string) => (
    <div className="search-results">
      {items.map((f) => (
        <div key={`${f.source}-${f.id}`} className={`result ${picked?.id === f.id ? 'sel' : ''}`} onClick={() => setPicked(f)} data-testid={`${testPrefix}-${f.name}`}>
          <div style={{ minWidth: 0 }}>
            <div className="nm">
              {f.name} {f.source === 'mine' && <span className="pill gold">Mine</span>}
              {f.source === 'recent' && <span className="pill">Recent</span>}
            </div>
            <div className="tiny muted">{f.serving}</div>
          </div>
          <div className="small num" style={{ textAlign: 'right' }}>
            {fmt(f.calories)} kcal
            <div className="green tiny">{fmt(f.protein, 1)} g protein</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>🍽️ Food Log</h1>
          <p>Fast logging: search, tap, add. Recents and your own foods float to the top.</p>
        </div>
        <DateNav date={date} today={view.today} onChange={setDate} />
      </div>

      <div className="grid dash">
        <div className="stack" style={{ gap: 18 }}>
          <div className="panel">
            <NutritionSummary d={d} today={view.today} />
          </div>
          {MEALS.map((m) => {
            const list = entries.filter((f) => f.meal === m.key);
            const tot = d.meals[m.key];
            const canCopy = yEntries.some((f) => f.meal === m.key);
            return (
              <div key={m.key} className="meal-block">
                <div className="meal-head">
                  <span>
                    {m.icon} {m.label}
                  </span>
                  <span className="row small" style={{ gap: 8 }}>
                    {list.length >= 2 && (
                      <button className="btn xs ghost" onClick={() => setSavingMeal(m.key)} title="Save this whole meal as one favorite" data-testid={`save-meal-${m.key}`}>
                        ⭐ Save meal
                      </button>
                    )}
                    {canCopy && (
                      <button className="btn xs ghost" onClick={() => copyMeal(m.key)} title="Copy this meal from yesterday">
                        📋 Same as yesterday
                      </button>
                    )}
                    <span className="muted num">
                      {fmt(tot.calories)} kcal · {fmt(tot.protein)} g
                    </span>
                    <button className="btn xs" onClick={() => setMeal(m.key)}>
                      + Add
                    </button>
                  </span>
                </div>
                {list.map((f) => (
                  <div key={f.id} className="entry" data-testid="food-entry">
                    <div className="nm" style={{ cursor: 'pointer' }} onClick={() => setEditing(f)} title="Tap to edit">
                      {f.name}
                      {f.servings && f.servings !== 1 ? <span className="dim small"> × {f.servings}</span> : null}
                      <span className="dim tiny"> ✎</span>
                    </div>
                    <div className="num small">{fmt(f.calories)} kcal</div>
                    <div className="num small green hide-sm">{fmt(f.protein, 1)} g</div>
                    <button
                      className="btn xs ghost"
                      onClick={() => {
                        removeFood(f.id);
                        toast({ icon: '🗑️', title: `Removed ${f.name}`, tone: 'info', action: { label: 'Undo', run: () => restoreFood(f) } });
                      }}
                      aria-label={`Remove ${f.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="panel stack" style={{ position: 'sticky', top: 76 }}>
            <div className="panel-head" style={{ marginBottom: 0 }}>
              <h2>Add food</h2>
            </div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {MEALS.map((m) => (
                <button key={m.key} className={`tab ${meal === m.key ? 'active' : ''}`} onClick={() => setMeal(m.key)}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <input type="search" placeholder="Search foods (e.g. chicken, greek yogurt, chipotle)…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="food-search" />

            {picked && (
              <div className="panel tight" style={{ borderColor: '#6b5420' }} data-testid="picked">
                <div className="row between">
                  <b>{picked.name}</b>
                  <button className="btn xs ghost" onClick={() => setPicked(null)}>
                    ✕
                  </button>
                </div>
                <div className="tiny muted">Per {picked.serving}: {fmt(picked.calories)} kcal · {fmt(picked.protein, 1)} g protein</div>
                <div className="row mt nowrap">
                  <div style={{ width: 90 }}>
                    <NumberField value={servings} onChange={setServings} step={0.25} min={0} testId="servings" />
                  </div>
                  <span className="small muted">servings</span>
                  {[0.5, 1, 1.5, 2].map((n) => (
                    <button key={n} className={`btn xs ${servings === n ? 'primary' : ''}`} onClick={() => setServings(n)}>
                      {n}×
                    </button>
                  ))}
                </div>
                <div className="row between mt">
                  <span className="num">
                    {fmt(picked.calories * sv)} kcal · <span className="green">{fmt(picked.protein * sv, 1)} g</span>
                  </span>
                  <button className="btn primary" onClick={logPicked} disabled={sv <= 0} data-testid="add-picked">
                    Add to {meal}
                  </button>
                </div>
              </div>
            )}

            {q ? (
              results.length ? renderList(results, 'result') : <div className="empty">No match — use Quick add below and save it to My Foods.</div>
            ) : (
              <>
                {smartPicks.length > 0 && (
                  <div>
                    <div className="small muted mb">
                      🧠 <b>Smart picks</b> — high protein, fits your remaining {fmt(remainingCal)} kcal
                    </div>
                    {renderList(smartPicks, 'pick')}
                  </div>
                )}
                {recents.length > 0 && (
                  <div>
                    <div className="small muted mb">🕘 Recent</div>
                    {renderList(recents.slice(0, 8), 'recent')}
                  </div>
                )}
              </>
            )}

            <hr className="sep" style={{ margin: '4px 0' }} />
            <div>
              <b>⚡ Quick add</b>
              <div className="fields mt">
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  Name
                  <input type="text" value={qa.name} onChange={(e) => setQa({ ...qa, name: e.target.value })} placeholder="e.g. Mom's lasagna" data-testid="qa-name" />
                </label>
                <NumberField label="Calories" value={qa.calories} onChange={(v) => setQa({ ...qa, calories: v })} testId="qa-cal" />
                <NumberField label="Protein" suffix="g" value={qa.protein} onChange={(v) => setQa({ ...qa, protein: v })} testId="qa-protein" />
              </div>
              <div className="row between mt">
                <label className="row small muted" style={{ gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={qa.save} onChange={(e) => setQa({ ...qa, save: e.target.checked })} /> Save to My Foods
                </label>
                <button className="btn primary" onClick={quickAdd} data-testid="qa-add">
                  Add to {meal}
                </button>
              </div>
            </div>

            {mine.length > 0 && !q && (
              <details>
                <summary className="small muted" style={{ cursor: 'pointer' }}>
                  ⭐ My Foods ({mine.length})
                </summary>
                <div className="stack mt" style={{ gap: 6 }}>
                  {mine.map((f) => (
                    <div key={f.id} className="row between small">
                      <span style={{ cursor: 'pointer' }} onClick={() => setPicked(f)}>
                        {f.name} <span className="dim">· {fmt(f.calories)} kcal · {fmt(f.protein, 1)} g</span>
                      </span>
                      <span className="row" style={{ gap: 4 }}>
                        <button className="btn xs ghost" onClick={() => setEditingMine(f)} aria-label={`Edit ${f.name}`}>
                          ✎
                        </button>
                        <button className="btn xs ghost" onClick={() => removeCustomFood(f.id)} aria-label={`Delete ${f.name}`}>
                          ✕
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
      {editing && <FoodEntryEditor entry={editing} onClose={() => setEditing(null)} />}
      {editingMine && <CustomFoodEditor food={editingMine} onClose={() => setEditingMine(null)} />}
      {savingMeal && <SaveMealModal meal={savingMeal} entries={entries.filter((f) => f.meal === savingMeal)} onClose={() => setSavingMeal(null)} />}
    </div>
  );
}
