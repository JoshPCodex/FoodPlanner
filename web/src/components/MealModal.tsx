import { useEffect, useState } from 'react';
import { CATEGORIES } from '../constants';
import type { IngredientCategory, Meal, MealIngredient } from '../types';
import { Modal } from './Modal';

interface MealModalProps {
  open: boolean;
  meal?: Meal | null;
  onClose: () => void;
  onSave: (input: {
    name: string;
    servingsDefault: number;
    pinned: boolean;
    ingredients: MealIngredient[];
  }) => void;
}

function emptyIngredient(): MealIngredient {
  return { name: '', qty: 1, category: 'Other' };
}

export function MealModal({ open, meal, onClose, onSave }: MealModalProps) {
  const [name, setName] = useState('');
  const [servingsDefault, setServingsDefault] = useState(2);
  const [pinned, setPinned] = useState(true);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([emptyIngredient()]);

  useEffect(() => {
    if (!open) return;
    if (meal) {
      setName(meal.name);
      setServingsDefault(meal.servingsDefault);
      setPinned(Boolean(meal.pinned));
      setIngredients(meal.ingredients.length > 0 ? meal.ingredients : [emptyIngredient()]);
    } else {
      setName('');
      setServingsDefault(2);
      setPinned(true);
      setIngredients([emptyIngredient()]);
    }
  }, [meal, open]);

  return (
    <Modal title={meal ? `Meal: ${meal.name}` : 'Add Meal'} open={open} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const cleaned = ingredients
            .map((item) => ({
              name: item.name.trim(),
              qty: Math.max(1, Math.floor(item.qty ?? 1)),
              category: item.category ?? 'Other'
            }))
            .filter((item) => item.name.length > 0);

          if (!name.trim() || cleaned.length === 0) return;

          onSave({
            name: name.trim(),
            servingsDefault: Math.max(1, Math.floor(servingsDefault)),
            pinned,
            ingredients: cleaned
          });
          onClose();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Meal Name</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Spicy Chicken Bowl"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Default servings</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={servingsDefault}
              onChange={(event) => setServingsDefault(Number(event.target.value))}
            />
          </label>

          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
            Pin in favorites
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Ingredients</h3>
            <button
              type="button"
              onClick={() => setIngredients((current) => [...current, emptyIngredient()])}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
            >
              + Add Line
            </button>
          </div>

          <div className="space-y-2">
            {ingredients.map((item, index) => (
              <div key={`meal-ingredient-${index}`} className="grid grid-cols-12 gap-2">
                <input
                  className="col-span-6 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Ingredient"
                  value={item.name}
                  onChange={(event) =>
                    setIngredients((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, name: event.target.value } : row))
                    )
                  }
                />
                <input
                  type="number"
                  min={1}
                  className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={item.qty ?? 1}
                  onChange={(event) =>
                    setIngredients((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, qty: Number(event.target.value) } : row
                      )
                    )
                  }
                />
                <select
                  className="col-span-3 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={item.category ?? 'Other'}
                  onChange={(event) =>
                    setIngredients((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, category: event.target.value as IngredientCategory } : row
                      )
                    )
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="col-span-1 rounded-md border border-red-200 text-sm text-red-600"
                  onClick={() =>
                    setIngredients((current) => (current.length <= 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)))
                  }
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Cancel
          </button>
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            Save Meal
          </button>
        </div>
      </form>
    </Modal>
  );
}
