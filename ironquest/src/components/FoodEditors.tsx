import { useState } from 'react';
import type { FoodEntry, FoodItem, MealSlot } from '../game/types';
import { useStore } from '../store/store';
import { Modal, NumberField } from './ui';
import { fmt } from '../lib/format';

export const MEAL_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

/** Edit a logged food: rename, move to another meal, change servings (rescales macros), or fix numbers. */
export function FoodEntryEditor({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const updateFood = useStore((s) => s.updateFood);
  const removeFood = useStore((s) => s.removeFood);
  const baseServings = entry.servings || 1;
  const perCal = entry.calories / baseServings;
  const perPro = entry.protein / baseServings;
  const [name, setName] = useState(entry.name);
  const [meal, setMeal] = useState<MealSlot>(entry.meal);
  const [servings, setServings] = useState<number | ''>(baseServings);
  const [calories, setCalories] = useState<number | ''>(entry.calories);
  const [protein, setProtein] = useState<number | ''>(entry.protein);

  const onServings = (v: number | '') => {
    setServings(v);
    if (v !== '' && v > 0) {
      setCalories(Math.round(perCal * v));
      setProtein(Math.round(perPro * v * 10) / 10);
    }
  };

  const save = () => {
    updateFood(entry.id, {
      name: name.trim() || entry.name,
      meal,
      servings: Number(servings) || 1,
      calories: Math.max(0, Math.round(Number(calories) || 0)),
      protein: Math.max(0, Number(protein) || 0),
    });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="stack" data-testid="food-editor">
        <h2>Edit food</h2>
        <label className="field">
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="fields">
          <label className="field">
            Meal
            <select value={meal} onChange={(e) => setMeal(e.target.value as MealSlot)}>
              {(Object.keys(MEAL_LABEL) as MealSlot[]).map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <NumberField label="Servings" value={servings} onChange={onServings} step={0.25} testId="edit-servings" />
          <NumberField label="Calories" value={calories} onChange={setCalories} testId="edit-cal" />
          <NumberField label="Protein" suffix="g" value={protein} onChange={setProtein} testId="edit-protein" />
        </div>
        <div className="row between">
          <button
            className="btn danger"
            onClick={() => {
              removeFood(entry.id);
              onClose();
            }}
          >
            Delete
          </button>
          <div className="row">
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" onClick={save} data-testid="edit-save">
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Edit or delete one of "My Foods". */
export function CustomFoodEditor({ food, onClose }: { food: FoodItem; onClose: () => void }) {
  const update = useStore((s) => s.updateCustomFood);
  const remove = useStore((s) => s.removeCustomFood);
  const [f, setF] = useState({ name: food.name, serving: food.serving, calories: food.calories as number | '', protein: food.protein as number | '' });
  return (
    <Modal onClose={onClose}>
      <div className="stack">
        <h2>Edit “{food.name}”</h2>
        <div className="fields">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            Name
            <input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <label className="field">
            Serving
            <input type="text" value={f.serving} onChange={(e) => setF({ ...f, serving: e.target.value })} />
          </label>
          <NumberField label="Calories" value={f.calories} onChange={(v) => setF({ ...f, calories: v })} />
          <NumberField label="Protein" suffix="g" value={f.protein} onChange={(v) => setF({ ...f, protein: v })} />
        </div>
        <div className="row between">
          <button
            className="btn danger"
            onClick={() => {
              remove(food.id);
              onClose();
            }}
          >
            Delete
          </button>
          <button
            className="btn primary"
            onClick={() => {
              update(food.id, { name: f.name.trim() || food.name, serving: f.serving || '1 serving', calories: Math.round(Number(f.calories) || 0), protein: Number(f.protein) || 0 });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Bundle everything in a meal into one tap-to-log favorite. */
export function SaveMealModal({ entries, meal, onClose }: { entries: FoodEntry[]; meal: MealSlot; onClose: () => void }) {
  const save = useStore((s) => s.saveCustomFood);
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState(`My usual ${MEAL_LABEL[meal].toLowerCase().replace(/s$/, '')}`);
  const calories = entries.reduce((s, e) => s + e.calories, 0);
  const protein = Math.round(entries.reduce((s, e) => s + e.protein, 0) * 10) / 10;
  return (
    <Modal onClose={onClose}>
      <div className="stack" data-testid="save-meal">
        <h2>Save meal as a favorite</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {entries.map((e) => e.name).join(' + ')}
          <br />
          <b>
            {fmt(calories)} kcal · {fmt(protein, 1)} g protein
          </b>
        </p>
        <label className="field">
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} data-testid="save-meal-name" autoFocus />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            data-testid="save-meal-confirm"
            onClick={() => {
              save({ name: name.trim() || 'My meal', serving: `1 meal (${entries.length} items)`, calories, protein, category: 'Meals' });
              toast({ icon: '⭐', title: `Saved “${name.trim() || 'My meal'}” to My Foods`, detail: 'Find it at the top of search and in My Foods.', tone: 'good' });
              onClose();
            }}
          >
            Save meal
          </button>
        </div>
      </div>
    </Modal>
  );
}
