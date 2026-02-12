import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../constants';
import type { Ingredient, IngredientCategory } from '../types';
import { Modal } from './Modal';

interface IngredientModalProps {
  open: boolean;
  ingredient?: Ingredient | null;
  onClose: () => void;
  onSave: (values: {
    name: string;
    category: IngredientCategory;
    count: number;
    servingsPerCount?: number;
    expirationDate?: string;
    notes?: string;
    pinned?: boolean;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  }) => void;
}

function toOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, parsed);
}

export function IngredientModal({ open, ingredient, onClose, onSave }: IngredientModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<IngredientCategory>('Other');
  const [count, setCount] = useState(1);
  const [servingsPerCount, setServingsPerCount] = useState(1);
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [pinned, setPinned] = useState(false);
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');

  const title = useMemo(() => (ingredient ? `Ingredient: ${ingredient.name}` : 'Add Ingredient'), [ingredient]);

  useEffect(() => {
    if (!open) return;
    if (ingredient) {
      setName(ingredient.name);
      setCategory(ingredient.category);
      setCount(ingredient.count);
      setServingsPerCount(ingredient.servingsPerCount ?? 1);
      setExpirationDate(ingredient.expirationDate ?? '');
      setNotes(ingredient.notes ?? '');
      setPinned(Boolean(ingredient.pinned));
      setCalories(ingredient.calories === undefined ? '' : String(ingredient.calories));
      setProteinG(ingredient.protein_g === undefined ? '' : String(ingredient.protein_g));
      setCarbsG(ingredient.carbs_g === undefined ? '' : String(ingredient.carbs_g));
      setFatG(ingredient.fat_g === undefined ? '' : String(ingredient.fat_g));
    } else {
      setName('');
      setCategory('Other');
      setCount(1);
      setServingsPerCount(1);
      setExpirationDate('');
      setNotes('');
      setPinned(false);
      setCalories('');
      setProteinG('');
      setCarbsG('');
      setFatG('');
    }
  }, [ingredient, open]);

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSave({
            name: name.trim(),
            category,
            count: Math.max(0, count),
            servingsPerCount: Math.max(0.01, servingsPerCount),
            expirationDate: expirationDate || undefined,
            notes: notes || undefined,
            pinned,
            calories: toOptionalNumber(calories),
            protein_g: toOptionalNumber(proteinG),
            carbs_g: toOptionalNumber(carbsG),
            fat_g: toOptionalNumber(fatG)
          });
          onClose();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="frost-input w-full px-3 py-2"
            placeholder="Ingredient name"
            required
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as IngredientCategory)}
              className="frost-input w-full px-3 py-2"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Count</span>
            <input
              type="number"
              min={0}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="frost-input w-full px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Servings per count</span>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={servingsPerCount}
              onChange={(event) => setServingsPerCount(Number(event.target.value))}
              className="frost-input w-full px-3 py-2"
            />
          </label>
        </div>

        <div className="glass-panel rounded-xl p-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">Nutrition Per 1 Serving (optional)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Calories</span>
              <input
                type="number"
                min={0}
                value={calories}
                onChange={(event) => setCalories(event.target.value)}
                className="frost-input w-full px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Protein g</span>
              <input
                type="number"
                min={0}
                value={proteinG}
                onChange={(event) => setProteinG(event.target.value)}
                className="frost-input w-full px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Carbs g</span>
              <input
                type="number"
                min={0}
                value={carbsG}
                onChange={(event) => setCarbsG(event.target.value)}
                className="frost-input w-full px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fat g</span>
              <input
                type="number"
                min={0}
                value={fatG}
                onChange={(event) => setFatG(event.target.value)}
                className="frost-input w-full px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Expiration Date</span>
          <input
            type="date"
            value={expirationDate}
            onChange={(event) => setExpirationDate(event.target.value)}
            className="frost-input w-full px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="frost-input min-h-20 w-full px-3 py-2"
            placeholder="Optional notes"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
          Pin ingredient in list
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-glass btn-md"
          >
            Cancel
          </button>
          <button type="submit" className="btn-glass btn-md btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
